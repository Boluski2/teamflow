import { describe, expect, it } from "vitest";

import { getSafeRedirectUrl } from "./redirect-url";

describe("getSafeRedirectUrl", () => {
  it("preserves a valid internal invitation URL", () => {
    const token = "a".repeat(43);

    expect(
      getSafeRedirectUrl(
        `/invitations/accept?token=${token}`,
      ),
    ).toBe(`/invitations/accept?token=${token}`);
  });

  it("preserves a valid internal path and query", () => {
    expect(
      getSafeRedirectUrl("/dashboard/example?tab=projects"),
    ).toBe("/dashboard/example?tab=projects");
  });

  it("rejects external URLs", () => {
    expect(
      getSafeRedirectUrl("https://malicious-site.com"),
    ).toBeUndefined();
  });

  it("rejects protocol-relative URLs", () => {
    expect(
      getSafeRedirectUrl("//malicious-site.com"),
    ).toBeUndefined();
  });

  it("rejects backslash-based URLs", () => {
    expect(
      getSafeRedirectUrl("/\\malicious-site.com"),
    ).toBeUndefined();
  });

  it("rejects missing or invalid values", () => {
    expect(getSafeRedirectUrl(undefined)).toBeUndefined();
    expect(getSafeRedirectUrl(["/dashboard"])).toBeUndefined();
    expect(getSafeRedirectUrl("dashboard")).toBeUndefined();
  });
});