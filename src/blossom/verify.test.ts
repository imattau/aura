import { describe, expect, it } from "vitest";
import { verifySha256 } from "./verify";

describe("verifySha256", () => {
  it("returns true when hash matches blob content", async () => {
    const blob = new Blob([new TextEncoder().encode("hello")]);
    const expectedHex =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    await expect(verifySha256(blob, expectedHex)).resolves.toBe(true);
  });

  it("returns false when hash does not match", async () => {
    const blob = new Blob([new TextEncoder().encode("hello")]);
    await expect(verifySha256(blob, `deadbeef${"0".repeat(56)}`)).resolves.toBe(
      false,
    );
  });
});
