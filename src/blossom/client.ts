import { verifySha256 } from "./verify";

export async function fetchBlob(
  sha256: string,
  servers: string[],
): Promise<Blob | null> {
  for (const server of servers) {
    try {
      const url = `${server.replace(/\/$/, "")}/${sha256}`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const blob = await response.blob();
      if (!(await verifySha256(blob, sha256))) continue;
      return blob;
    } catch {}
  }

  return null;
}
