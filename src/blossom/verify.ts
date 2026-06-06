import { sha256Hex } from "../crypto/hash";

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  if (typeof FileReader !== "undefined") {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () =>
        reject(reader.error ?? new Error("Failed to read blob"));
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
          return;
        }
        reject(new Error("Unexpected FileReader result"));
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  if (typeof blob.stream === "function") {
    const reader = blob.stream().getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }

    const buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return buffer.buffer;
  }

  throw new Error("Unable to read blob contents");
}

export async function verifySha256(
  blob: Blob,
  expectedHex: string,
): Promise<boolean> {
  const buffer = await blobToArrayBuffer(blob);
  const actual = await sha256Hex(buffer);
  return actual === expectedHex.toLowerCase();
}
