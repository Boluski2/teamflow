
import { z } from "zod";

export const createInvitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address")
      .max(254, "Email address is too long"),

    role: z.enum(["admin", "member", "viewer"]).default("member"),
  })
  .strict();

export type CreateInvitationInput = z.infer<
  typeof createInvitationSchema
>;


export const acceptInvitationSchema = z
  .object({
    token: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{43}$/,
        "Invalid invitation token",
      ),
  })
  .strict();

export type AcceptInvitationInput = z.infer<
  typeof acceptInvitationSchema
>;
