
import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
} from "./schema";

describe("createProjectSchema", () => {
  it("accepts valid project data", () => {
    const result = createProjectSchema.safeParse({
      name: "Website Redesign",
      description: "Redesign the company website",
      startDate: "2026-11-09T09:00:00.000Z",
      dueDate: "2026-12-09T09:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("trims the project name", () => {
    const result = createProjectSchema.parse({
      name: "  Website Redesign  ",
    });

    expect(result.name).toBe("Website Redesign");
  });

  it("rejects project names shorter than two characters", () => {
    expect(
      createProjectSchema.safeParse({ name: "A" }).success,
    ).toBe(false);
  });

  it("rejects project names longer than 120 characters", () => {
    expect(
      createProjectSchema.safeParse({
        name: "A".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("rejects descriptions longer than 2000 characters", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Website Redesign",
        description: "A".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("rejects a due date earlier than the start date", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Website Redesign",
        startDate: "2026-12-10T09:00:00.000Z",
        dueDate: "2026-12-09T09:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid date values", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Website Redesign",
        startDate: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Website Redesign",
        organizationId: "unauthorized-value",
      }).success,
    ).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts a partial update", () => {
    expect(
      updateProjectSchema.safeParse({
        name: "Updated project name",
      }).success,
    ).toBe(true);
  });

  it("accepts an explicit null description", () => {
    expect(
      updateProjectSchema.safeParse({
        description: null,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a due date earlier than the supplied start date", () => {
    expect(
      updateProjectSchema.safeParse({
        startDate: "2026-12-10T09:00:00.000Z",
        dueDate: "2026-12-09T09:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("updateProjectStatusSchema", () => {
  it("accepts active status", () => {
    expect(
      updateProjectStatusSchema.safeParse({
        status: "active",
      }).success,
    ).toBe(true);
  });

  it("accepts archived status", () => {
    expect(
      updateProjectStatusSchema.safeParse({
        status: "archived",
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported statuses", () => {
    expect(
      updateProjectStatusSchema.safeParse({
        status: "completed",
      }).success,
    ).toBe(false);
  });
});
