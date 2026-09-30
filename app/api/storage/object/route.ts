import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { storage } from "@/lib/storage";
import { LocalStorageDriver } from "@/lib/storage/local";

/**
 * Serves private objects for the local storage driver. Access requires an
 * unexpired HMAC signature issued after a server-side authorization check.
 * Supports HTTP Range requests so video seeking works.
 */
export async function GET(req: NextRequest) {
  const driver = storage();
  if (!(driver instanceof LocalStorageDriver)) return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const p = driver.verify(sp.get("p") ?? "", sp.get("e") ?? "0", sp.get("t") ?? "", sp.get("s") ?? "");
  if (!p) return new NextResponse("Link expired or invalid", { status: 403 });
  let full: string;
  let size: number;
  try {
    full = driver.resolve(p);
    size = (await stat(full)).size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": sp.get("t") || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };
  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    if (!m[1]) end = size - 1;
    start = Math.min(start, size - 1);
    end = Math.min(end, size - 1);
    if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new NextResponse(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new NextResponse(stream, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
}
