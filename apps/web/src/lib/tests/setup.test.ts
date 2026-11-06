
import { describe, expect, it } from "vitest";

describe("TeamFlow test environment", () => {
  it("runs Vitest successfully", () => {
    expect(1 + 1).toBe(2);
  });

  it("recognizes the Node.js test environment", () => {
    expect(typeof process).toBe("object");
  });
});
