
import "server-only";

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { emailOutbox } from "@/lib/db/schema";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LEASE_MINUTES = 5;
const DEFAULT_MAX_ATTEMPTS = 5;

const DEFAULT_MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 5 * 60 * 1000;

type EmailJobResultInput = {
  jobId: string;
  leaseExpiresAt: Date;
  now?: Date;
};

type MarkEmailJobFailedInput = EmailJobResultInput & {
  attempts: number;
  error: unknown;
  maxAttempts?: number;
};


export type ClaimedEmailJob = Pick<
  typeof emailOutbox.$inferSelect,
  "id" | "notificationId" | "template" | "payload" | "attempts" | "leaseExpiresAt"
>;

type ClaimEmailJobsOptions = {
  now?: Date;
  batchSize?: number;
  leaseMinutes?: number;
  maxAttempts?: number;
};

export async function claimEmailJobs(
  options: ClaimEmailJobsOptions = {},
): Promise<ClaimedEmailJob[]> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const leaseMinutes = options.leaseMinutes ?? DEFAULT_LEASE_MINUTES;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  if (!Number.isInteger(leaseMinutes) || leaseMinutes < 1) {
    throw new Error("leaseMinutes must be a positive integer");
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  const leaseExpiresAt = new Date(
    now.getTime() + leaseMinutes * 60 * 1000,
  );

  return db.transaction(async (tx) => {
    // Permanently fail jobs that have exhausted their attempts
    // and are no longer actively leased.
    await tx
      .update(emailOutbox)
      .set({
        status: "failed",
        leaseExpiresAt: null,
        lastError: "Maximum delivery attempts exceeded",
        updatedAt: now,
      })
      .where(
        and(
          lte(emailOutbox.attempts, maxAttempts),
          eq(emailOutbox.status, "processing"),
          lte(emailOutbox.leaseExpiresAt, now),
          sql`${emailOutbox.attempts} >= ${maxAttempts}`,
        ),
      );

    await tx
      .update(emailOutbox)
      .set({
        status: "failed",
        lastError: "Maximum delivery attempts exceeded",
        updatedAt: now,
      })
      .where(
        and(
          eq(emailOutbox.status, "pending"),
          sql`${emailOutbox.attempts} >= ${maxAttempts}`,
        ),
      );

    // Lock eligible jobs so another worker cannot claim them.
    const eligibleJobs = await tx
      .select({
        id: emailOutbox.id,
      })
      .from(emailOutbox)
      .where(
        and(
          sql`${emailOutbox.attempts} < ${maxAttempts}`,
          or(
            and(
              eq(emailOutbox.status, "pending"),
              lte(emailOutbox.nextAttemptAt, now),
            ),
            and(
              eq(emailOutbox.status, "processing"),
              lte(emailOutbox.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(emailOutbox.nextAttemptAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    const jobIds = eligibleJobs.map((job) => job.id);

    if (jobIds.length === 0) {
      return [];
    }

    // Claim the selected jobs and renew their leases.
        return tx
        .update(emailOutbox)
        .set({
            status: "processing",
            attempts: sql`${emailOutbox.attempts} + 1`,
            leaseExpiresAt,
            updatedAt: now,
            lastError: null,
        })
        .where(inArray(emailOutbox.id, jobIds))
        .returning({
            id: emailOutbox.id,
            notificationId: emailOutbox.notificationId,
            template: emailOutbox.template,
            payload: emailOutbox.payload,
            attempts: emailOutbox.attempts,
            leaseExpiresAt: emailOutbox.leaseExpiresAt,
        });
  });
}


function getSafeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error);

  return message.slice(0, 1000);
}

export async function markEmailJobSent(
  input: EmailJobResultInput & {
    providerMessageId?: string | null;
  },
): Promise<boolean> {
  const now = input.now ?? new Date();

  const [updatedJob] = await db
    .update(emailOutbox)
    .set({
      status: "sent",
      providerMessageId: input.providerMessageId ?? null,
      sentAt: now,
      leaseExpiresAt: null,
      lastError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(emailOutbox.id, input.jobId),
        eq(emailOutbox.status, "processing"),
        eq(emailOutbox.leaseExpiresAt, input.leaseExpiresAt),
        gt(emailOutbox.leaseExpiresAt, now),
      ),
    )
    .returning({
      id: emailOutbox.id,
    });

  return Boolean(updatedJob);
}


export async function markEmailJobCancelled(
  input: EmailJobResultInput,
): Promise<boolean> {
  const now = input.now ?? new Date();

  const [updatedJob] = await db
    .update(emailOutbox)
    .set({
      status: "cancelled",
      leaseExpiresAt: null,
      lastError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(emailOutbox.id, input.jobId),
        eq(emailOutbox.status, "processing"),
        eq(emailOutbox.leaseExpiresAt, input.leaseExpiresAt),
        gt(emailOutbox.leaseExpiresAt, now),
      ),
    )
    .returning({
      id: emailOutbox.id,
    });

  return Boolean(updatedJob);
}


export async function markEmailJobFailed(
  input: MarkEmailJobFailedInput,
): Promise<boolean> {
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  if (!Number.isInteger(input.attempts) || input.attempts < 1) {
    throw new Error("attempts must be a positive integer");
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  const permanentlyFailed = input.attempts >= maxAttempts;

  const retryDelay = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** (input.attempts - 1),
    DEFAULT_MAX_RETRY_DELAY_MS,
  );

  const [updatedJob] = await db
    .update(emailOutbox)
    .set({
      status: permanentlyFailed ? "failed" : "pending",
      nextAttemptAt: permanentlyFailed
        ? now
        : new Date(now.getTime() + retryDelay),
      leaseExpiresAt: null,
      lastError: getSafeErrorMessage(input.error),
      updatedAt: now,
    })
    .where(
      and(
        eq(emailOutbox.id, input.jobId),
        eq(emailOutbox.status, "processing"),
        eq(emailOutbox.leaseExpiresAt, input.leaseExpiresAt),
        gt(emailOutbox.leaseExpiresAt, now),
      ),
    )
    .returning({
      id: emailOutbox.id,
    });

  return Boolean(updatedJob);
}