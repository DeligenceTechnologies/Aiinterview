import "server-only";
import { ApiError } from "@/lib/api";

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

const TYPES = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: [0x50, 0x4b, 0x03, 0x04] }, // zip
  txt: { mime: "text/plain", magic: null },
} as const;

export type ResumeKind = keyof typeof TYPES;

/** Validate by extension AND file signature — never trust the client MIME type alone. */
export function detectResumeKind(fileName: string, bytes: Uint8Array): { kind: ResumeKind; mime: string } {
  if (bytes.byteLength === 0) throw new ApiError(400, "The file is empty.");
  if (bytes.byteLength > RESUME_MAX_BYTES) throw new ApiError(413, "Resume files must be 10 MB or smaller.");
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "doc") throw new ApiError(415, "Legacy .doc files aren't supported. Please upload a PDF or DOCX.");
  if (!(ext in TYPES)) throw new ApiError(415, "Please upload a PDF, DOCX or TXT file.");
  const kind = ext as ResumeKind;
  const magic = TYPES[kind].magic;
  if (magic && !magic.every((b, i) => bytes[i] === b)) throw new ApiError(415, "The file content doesn't match its extension.");
  if (kind === "txt" && bytes.subarray(0, 4096).includes(0)) throw new ApiError(415, "The text file appears to be binary.");
  return { kind, mime: TYPES[kind].mime };
}

export async function extractText(kind: ResumeKind, bytes: Uint8Array): Promise<string> {
  let text = "";
  if (kind === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const res = await pdfText(pdf, { mergePages: true });
    text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
  } else if (kind === "docx") {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = res.value;
  } else {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  // Normalise whitespace while keeping line structure.
  return text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
