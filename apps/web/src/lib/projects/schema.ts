
import { z } from "zod";

const projectNameSchema = z
  .string()
  .trim()
  .min(2, "Project name must contain at least 2 characters")
  .max(120, "Project name must not exceed 120 characters");

const projectDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Project description must not exceed 2000 characters")
  .nullable()
  .optional();

const projectDateSchema = z
  .iso
  .datetime({ offset: true })
  .nullable()
  .optional();

export const createProjectSchema = z
  .object({
    name: projectNameSchema,
    description: projectDescriptionSchema,
    startDate: projectDateSchema,
    dueDate: projectDateSchema,
  })
  .strict()
  .refine(
    (data) =>
      !data.startDate ||
      !data.dueDate ||
      new Date(data.dueDate) >= new Date(data.startDate),
    {
      message: "Due date cannot be earlier than start date",
      path: ["dueDate"],
    },
  );

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: projectDescriptionSchema,
    startDate: projectDateSchema,
    dueDate: projectDateSchema,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one project field must be provided",
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.dueDate ||
      new Date(data.dueDate) >= new Date(data.startDate),
    {
      message: "Due date cannot be earlier than start date",
      path: ["dueDate"],
    },
  );

export const updateProjectStatusSchema = z
  .object({
    status: z.enum(["active", "archived"]),
  })
  .strict();
