import { beforeEach, describe, expect, it } from "vitest";
import {
  blockPubkey,
  isPubkeyBlocked,
  listBlockedPubkeys,
  unblockPubkey,
} from "./moderation";

describe("moderation store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores blocked pubkeys", () => {
    blockPubkey("a".repeat(64));
    expect(isPubkeyBlocked("a".repeat(64))).toBe(true);
    expect(listBlockedPubkeys()).toEqual(["a".repeat(64)]);
  });

  it("does not duplicate blocked pubkeys", () => {
    blockPubkey("a".repeat(64));
    blockPubkey("a".repeat(64));
    expect(listBlockedPubkeys()).toEqual(["a".repeat(64)]);
  });

  it("removes blocked pubkeys", () => {
    blockPubkey("a".repeat(64));
    unblockPubkey("a".repeat(64));
    expect(isPubkeyBlocked("a".repeat(64))).toBe(false);
    expect(listBlockedPubkeys()).toEqual([]);
  });
});
