import { beforeEach, describe, expect, it } from "vitest";
import {
  listPetnames,
  registerPetname,
  renamePetname,
  resolveNpub,
} from "./petnames";

describe("petname store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("maps a name to an npub", () => {
    registerPetname("mysite", "npub1abc");
    expect(resolveNpub("mysite")).toBe("npub1abc");
  });

  it("first-seen wins on collision", () => {
    registerPetname("mysite", "npub1abc");
    registerPetname("mysite", "npub1xyz");
    expect(resolveNpub("mysite")).toBe("npub1abc");
  });

  it("allows user to rename a petname", () => {
    registerPetname("mysite", "npub1abc");
    renamePetname("mysite", "renamed");
    expect(resolveNpub("renamed")).toBe("npub1abc");
    expect(resolveNpub("mysite")).toBeNull();
  });

  it("returns null for unknown name", () => {
    expect(resolveNpub("unknown")).toBeNull();
  });

  it("returns all registered petnames", () => {
    registerPetname("site-a", "npub1aaa");
    registerPetname("site-b", "npub1bbb");
    const names = listPetnames();
    expect(names).toContainEqual({ name: "site-a", npub: "npub1aaa" });
    expect(names).toContainEqual({ name: "site-b", npub: "npub1bbb" });
  });
});
