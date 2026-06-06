import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("returns correct lowercase hex for known input", async () => {
    const data = new TextEncoder().encode("hello").buffer as ArrayBuffer;
    await expect(sha256Hex(data)).resolves.toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("returns 64-character hex string", async () => {
    await expect(sha256Hex(new ArrayBuffer(0))).resolves.toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
