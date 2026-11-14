
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";

import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "./schema";

type CreateProjectInput = z.infer<typeof createProjectSchema>;
type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
type UpdateProjectStatusInput = z.infer<
  typeof updateProjectStatusSchema
>;

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function validateProjectDates(
  startDate: Date | null,
  dueDate: Date | null,
) {
  if (startDate && dueDate && dueDate < startDate) {
    throw new Error("Due date cannot be earlier than start date");
  }
}

export async function createProject(
  organizationId: string,
  userId: string,
  input: CreateProjectInput,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "projects.create",
  );

  const startDate = toDate(input.startDate);
  const dueDate = toDate(input.dueDate);

  validateProjectDates(startDate, dueDate);

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: input.name,
      description: input.description ?? null,
      startDate,
      dueDate,
      createdById: userId,
    })
    .returning();

  return project;
}

export async function listProjects(
  organizationId: string,
  userId: string,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "projects.view",
  );

  return db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organization.id))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(
  organizationId: string,
  projectId: string,
  userId: string,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "projects.view",
  );

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organization.id),
      ),
    )
    .limit(1);

  return project ?? null;
}

export async function updateProject(
  organizationId: string,
  projectId: string,
  userId: string,
  input: UpdateProjectInput,
) {
  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    "projects.update",
  );

  const [existingProject] = await db
    .select({
      id: projects.id,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organization.id),
      ),
    )
    .limit(1);

  if (!existingProject) {
    return null;
  }

  const startDate =
    input.startDate !== undefined
      ? toDate(input.startDate)
      : existingProject.startDate;

  const dueDate =
    input.dueDate !== undefined
      ? toDate(input.dueDate)
      : existingProject.dueDate;

  validateProjectDates(startDate, dueDate);

  const [updatedProject] = await db
    .update(projects)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.startDate !== undefined && { startDate }),
      ...(input.dueDate !== undefined && { dueDate }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organization.id),
      ),
    )
    .returning();

  return updatedProject ?? null;
}

export async function updateProjectStatus(
  organizationId: string,
  projectId: string,
  userId: string,
  input: UpdateProjectStatusInput,
) {
  const permission =
    input.status === "archived"
      ? "projects.archive"
      : "projects.update";

  const organization = await requireOrganizationPermission(
    organizationId,
    userId,
    permission,
  );

  const [updatedProject] = await db
    .update(projects)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organization.id),
      ),
    )
    .returning();

  return updatedProject ?? null;
}
