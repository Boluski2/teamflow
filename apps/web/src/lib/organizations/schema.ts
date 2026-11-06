
import { z } from "zod";

export const createOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters")
      .max(200, "Organization name cannot exceed 200 characters"),

    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional(),
  })
  .strict();

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationSchema
>;


export const updateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters")
      .max(500, "Organization name cannot exceed 500 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined,
    {
      message: "At least one field must be provided",
    },
  );

export type UpdateOrganizationInput = z.infer<
  typeof updateOrganizationSchema
>;