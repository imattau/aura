import { describe, expect, it } from "vitest";
import { extToMime } from "./mime";

describe("extToMime", () => {
  it("returns text/html for .html", () =>
    expect(extToMime("/index.html")).toBe("text/html"));
  it("returns text/css for .css", () =>
    expect(extToMime("/style.css")).toBe("text/css"));
  it("returns application/javascript for .js", () =>
    expect(extToMime("/app.js")).toBe("application/javascript"));
  it("returns application/javascript for .mjs", () =>
    expect(extToMime("/mod.mjs")).toBe("application/javascript"));
  it("returns image/png for .png", () =>
    expect(extToMime("/img.png")).toBe("image/png"));
  it("returns image/jpeg for .jpg", () =>
    expect(extToMime("/img.jpg")).toBe("image/jpeg"));
  it("returns image/svg+xml for .svg", () =>
    expect(extToMime("/icon.svg")).toBe("image/svg+xml"));
  it("returns application/wasm for .wasm", () =>
    expect(extToMime("/mod.wasm")).toBe("application/wasm"));
  it("returns application/json for .json", () =>
    expect(extToMime("/data.json")).toBe("application/json"));
  it("returns application/octet-stream for unknown ext", () =>
    expect(extToMime("/binary.bin")).toBe("application/octet-stream"));
});
