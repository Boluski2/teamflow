
import { z } from "zod";

const taskTitleSchema = z
  .string()
  .trim()
  .min(2, "Task title must be at least 2 characters")
  .max(200, "Task title must not exceed 200 characters");

const taskDescriptionSchema = z
  .string()
  .trim()
  .max(5000, "Task description must not exceed 5000 characters")
  .nullable()
  .optional();

const taskDateSchema = z.iso.datetime({ offset: true }).nullable().optional();

const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

const taskPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

const taskReferenceSchema = z.uuid().nullable().optional();

export const createTaskSchema = z
  .object({
    title: taskTitleSchema,
    description: taskDescriptionSchema,
    priority: taskPrioritySchema.default("normal"),
    status: taskStatusSchema.default("todo"),
    assigneeId: taskReferenceSchema,
    parentTaskId: taskReferenceSchema,
    dueDate: taskDateSchema,
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    description: taskDescriptionSchema,
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: taskReferenceSchema,
    parentTaskId: taskReferenceSchema,
    dueDate: taskDateSchema,
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one task field must be provided" },
  );

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
