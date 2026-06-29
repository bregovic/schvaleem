export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export type PdfDecode =
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; size: number }
  | { ok: false; code: string; message: string };

// Dekóduje Base64 PDF a ověří hlavičku %PDF + velikost.
export function decodePdf(contentBase64: string): PdfDecode {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch {
    return { ok: false, code: "bad_base64", message: "contentBase64 není platný Base64." };
  }
  if (buffer.length === 0) {
    return { ok: false, code: "empty_file", message: "Dekódovaný soubor je prázdný." };
  }
  if (buffer.length > MAX_PDF_BYTES) {
    return {
      ok: false,
      code: "payload_too_large",
      message: `Soubor je příliš velký (max ${MAX_PDF_BYTES / 1024 / 1024} MB).`,
    };
  }
  if (buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    return { ok: false, code: "not_pdf", message: "Obsah není platné PDF (chybí hlavička %PDF)." };
  }
  const bytes = new Uint8Array(new ArrayBuffer(buffer.length));
  bytes.set(buffer);
  return { ok: true, bytes, size: buffer.length };
}
