import "server-only";
// Recording is uploaded as numbered chunks per "part" (a part = one
// MediaRecorder session; a browser refresh starts a new part). Chunks are
// idempotent by index and assembled into one private file per part.

import { withOrg } from "@/lib/database/db";
import { ApiError } from "@/lib/api";
import { log } from "@/lib/logger";
import { paths, storage } from "@/lib/storage";
import { resolveToken } from "./controller";

export const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = /^video\/webm|^video\/mp4|^audio\/webm/;

export async function startRecordingPart(token: string, input: { offset_ms: number; mime_type: string }) {
  const ctx = await resolveToken(token);
  if (!["in_progress", "completing"].includes(ctx.status)) throw new ApiError(409, "The interview is not in progress.");
  if (!ALLOWED_MIME.test(input.mime_type)) throw new ApiError(415, "Unsupported recording format.");
  return withOrg(ctx.orgId, async (tx) => {
    await tx`select id from interviews where id = ${ctx.id} for update`;
    const [{ next }] = await tx<{ next: number }[]>`select coalesce(max(part_index), -1) + 1 as next from recordings where interview_id = ${ctx.id}`;
    const mime = input.mime_type.split(";")[0];
    await tx`insert into recordings (organization_id, interview_id, part_index, offset_ms, storage_path, mime_type, status)
      values (${ctx.orgId}, ${ctx.id}, ${next}, ${Math.max(0, Math.round(input.offset_ms))}, ${paths.recordingFile(ctx.orgId, ctx.id, next)}, ${mime}, 'uploading')`;
    return { part_index: next };
  });
}

export async function uploadRecordingChunk(token: string, part: number, index: number, bytes: Uint8Array) {
  if (bytes.byteLength === 0) return { stored: false };
  if (bytes.byteLength > MAX_CHUNK_BYTES) throw new ApiError(413, "Chunk too large.");
  const ctx = await resolveToken(token);
  const [rec] = await withOrg(ctx.orgId, (tx) => tx<{ status: string }[]>`select status from recordings where interview_id = ${ctx.id} and part_index = ${part}`);
  if (!rec) throw new ApiError(404, "Recording part not found.");
  if (rec.status !== "uploading") return { stored: false };
  const path = paths.recordingChunk(ctx.orgId, ctx.id, part, index);
  const existed = await storage().exists(path);
  await storage().put(path, bytes, "application/octet-stream");
  if (!existed) {
    await withOrg(ctx.orgId, (tx) => tx`update recordings set chunks_received = chunks_received + 1, file_size = file_size + ${bytes.byteLength}
      where interview_id = ${ctx.id} and part_index = ${part}`);
  }
  return { stored: true };
}

export async function finalizeRecordingPart(token: string, part: number, input: { duration_ms: number | null; total_chunks: number }) {
  const ctx = await resolveToken(token);
  return assemblePart(ctx.orgId, ctx.id, part, input);
}

/** Concatenate chunks into the final object. Safe to call more than once. */
export async function assemblePart(orgId: string, interviewId: string, part: number, input: { duration_ms: number | null; total_chunks: number | null }) {
  const [rec] = await withOrg(orgId, (tx) => tx<{ status: string; storage_path: string; mime_type: string }[]>`
    select status, storage_path, mime_type from recordings where interview_id = ${interviewId} and part_index = ${part}`);
  if (!rec) throw new ApiError(404, "Recording part not found.");
  if (rec.status === "stored") return { status: "stored" as const };

  const prefix = paths.recordingChunkPrefix(orgId, interviewId, part);
  const files = await storage().list(prefix);
  if (input.total_chunks != null && files.length < input.total_chunks) {
    // Some chunks are still in flight or failed: do not claim the recording is stored.
    return { status: "incomplete" as const, missing: input.total_chunks - files.length };
  }
  if (!files.length) {
    await withOrg(orgId, (tx) => tx`update recordings set status = 'failed' where interview_id = ${interviewId} and part_index = ${part}`);
    return { status: "failed" as const };
  }
  const buffers: Uint8Array[] = [];
  for (const f of files) buffers.push(await storage().get(f));
  const total = buffers.reduce((a, b) => a + b.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    merged.set(b, offset);
    offset += b.byteLength;
  }
  await storage().put(rec.storage_path, merged, rec.mime_type);
  await withOrg(orgId, (tx) => tx`update recordings set status = 'stored', file_size = ${total},
    duration_seconds = coalesce(${input.duration_ms != null ? Math.round(input.duration_ms / 1000) : null}, duration_seconds)
    where interview_id = ${interviewId} and part_index = ${part}`);
  await storage().deletePrefix(prefix);
  log.info("recording.stored", { interviewId, part, bytes: total, chunks: files.length });
  return { status: "stored" as const };
}

/** Called after completion: assemble any parts the browser didn't finalize (e.g. tab closed). */
export async function finalizeAllParts(orgId: string, interviewId: string) {
  const parts = await withOrg(orgId, (tx) => tx<{ part_index: number }[]>`
    select part_index from recordings where interview_id = ${interviewId} and status = 'uploading'`);
  for (const p of parts) {
    try {
      await assemblePart(orgId, interviewId, p.part_index, { duration_ms: null, total_chunks: null });
    } catch (err) {
      log.warn("recording.finalize_failed", { interviewId, part: p.part_index, err });
    }
  }
}

/** Signed, expiring URLs for an authorized recruiter. */
export async function recordingUrls(orgId: string, interviewId: string) {
  const parts = await withOrg(orgId, (tx) => tx<{ part_index: number; offset_ms: number; storage_path: string; mime_type: string; duration_seconds: number | null; status: string }[]>`
    select part_index, offset_ms, storage_path, mime_type, duration_seconds, status from recordings
    where interview_id = ${interviewId} and organization_id = ${orgId} and status = 'stored' order by part_index`);
  return Promise.all(parts.map(async (p) => ({
    part_index: p.part_index,
    offset_ms: p.offset_ms,
    duration_seconds: p.duration_seconds,
    mime_type: p.mime_type,
    url: await storage().signedUrl(p.storage_path, 60 * 60, p.mime_type),
  })));
}
