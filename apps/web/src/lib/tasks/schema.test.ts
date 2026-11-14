
import { describe, expect, it } from "vitest";
import {
  createTaskSchema,
  updateTaskSchema,
} from "./schema";

describe("createTaskSchema", () => {
  const validInput = {
    title: "Implement authentication",
    description: "Build the authentication flow",
  };

  it("accepts valid task input", () => {
    const result = createTaskSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it("trims the task title", () => {
    const result = createTaskSchema.parse({
      ...validInput,
      title: "  Implement authentication  ",
    });

    expect(result.title).toBe("Implement authentication");
  });

  it("applies default status and priority", () => {
    const result = createTaskSchema.parse(validInput);

    expect(result.status).toBe("todo");
    expect(result.priority).toBe("normal");
  });

  it("accepts valid optional task fields", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      status: "in_progress",
      priority: "high",
      assigneeId: "550e8400-e29b-41d4-a716-446655440000",
      parentTaskId: null,
      dueDate: "2026-12-15T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects titles shorter than two characters", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        title: "A",
      }).success,
    ).toBe(false);
  });

  it("rejects titles longer than 200 characters", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        title: "A".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("rejects descriptions longer than 5000 characters", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        description: "A".repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid task status", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        status: "pending",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid task priority", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        priority: "critical",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid assignee UUID", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        assigneeId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid parent task UUID", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        parentTaskId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("rejects dates without timezone offsets", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        dueDate: "2026-12-15T12:00:00",
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected properties", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("accepts partial updates", () => {
    expect(
      updateTaskSchema.safeParse({
        title: "Updated task title",
      }).success,
    ).toBe(true);
  });

  it("accepts null values for optional nullable fields", () => {
    expect(
      updateTaskSchema.safeParse({
        description: null,
        assigneeId: null,
        parentTaskId: null,
        dueDate: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unexpected properties", () => {
    expect(
      updateTaskSchema.safeParse({
        title: "Updated task",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid status updates", () => {
    expect(
      updateTaskSchema.safeParse({
        status: "pending",
      }).success,
    ).toBe(false);
  });
});
