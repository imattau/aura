import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { fetchBlob } from "./client";

describe("fetchBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches blob from first server that succeeds", async () => {
    const blob = new Blob([new TextEncoder().encode("data")]);
    const hash =
      "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    mockFetch.mockResolvedValueOnce({ ok: true, blob: async () => blob });

    await expect(
      fetchBlob(hash, ["https://server1.example.com"]),
    ).resolves.toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://server1.example.com/${hash}`,
    );
  });

  it("tries next server on failure", async () => {
    const blob = new Blob([new TextEncoder().encode("data")]);
    const hash =
      "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    mockFetch
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ ok: true, blob: async () => blob });

    await expect(
      fetchBlob(hash, [
        "https://server1.example.com",
        "https://server2.example.com",
      ]),
    ).resolves.toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when all servers fail", async () => {
    const hash =
      "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    mockFetch.mockRejectedValue(new Error("network error"));
    await expect(
      fetchBlob(hash, ["https://server1.example.com"]),
    ).resolves.toBeNull();
  });

  it("returns null when verification fails", async () => {
    const hash =
      "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new TextEncoder().encode("wrong content")]),
    });

    await expect(
      fetchBlob(hash, ["https://server1.example.com"]),
    ).resolves.toBeNull();
  });
});
