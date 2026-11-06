
import { describe, expect, it } from "vitest";

import { createInvitationSchema, acceptInvitationSchema } from "./schema";

describe("createInvitationSchema", () => {
  it("normalizes the email and defaults the role to member", () => {
    const result = createInvitationSchema.parse({
      email: "  PERSON@Example.COM  ",
    });

    expect(result).toEqual({
      email: "person@example.com",
      role: "member",
    });
  });

  it.each(["admin", "member", "viewer"] as const)(
    "accepts the %s invitation role",
    (role) => {
      const result = createInvitationSchema.parse({
        email: "person@example.com",
        role,
      });

      expect(result.role).toBe(role);
    },
  );

  it("rejects owner as an invitation role", () => {
    expect(
      createInvitationSchema.safeParse({
        email: "person@example.com",
        role: "owner",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    expect(
      createInvitationSchema.safeParse({
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected properties", () => {
    expect(
      createInvitationSchema.safeParse({
        email: "person@example.com",
        role: "member",
        organizationId: "attacker-controlled",
      }).success,
    ).toBe(false);
  });
});


describe("acceptInvitationSchema", () => {
  const validToken = "a".repeat(43);

  it("accepts a valid invitation token", () => {
    const result = acceptInvitationSchema.safeParse({
      token: validToken,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a token shorter than 43 characters", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "a".repeat(42),
    });

    expect(result.success).toBe(false);
  });

  it("rejects a token longer than 43 characters", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "a".repeat(44),
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid token characters", () => {
    const result = acceptInvitationSchema.safeParse({
      token: "a".repeat(42) + "!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects additional properties", () => {
    const result = acceptInvitationSchema.safeParse({
      token: validToken,
      role: "owner",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing token", () => {
    const result = acceptInvitationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});