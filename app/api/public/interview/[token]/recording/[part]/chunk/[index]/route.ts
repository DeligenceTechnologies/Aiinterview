import { ApiError, route } from "@/lib/api";
import { MAX_CHUNK_BYTES, uploadRecordingChunk } from "@/lib/interview/recording";

export const PUT = route<{ token: string; part: string; index: string }>(async (req, { token, part, index }) => {
  const p = Number(part);
  const i = Number(index);
  if (!Number.isInteger(p) || !Number.isInteger(i) || p < 0 || i < 0 || i > 100_000) throw new ApiError(400, "Invalid chunk");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CHUNK_BYTES) throw new ApiError(413, "Chunk too large.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  return uploadRecordingChunk(token, p, i, bytes);
}, { rateLimit: { key: "pub-rec-chunk", limit: 300, windowMs: 60_000 } });
