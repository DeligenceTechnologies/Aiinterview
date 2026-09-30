"use client";

// Records the combined interview stream (camera + candidate mic + interviewer
// voice) and uploads it in numbered chunks with retry. Never reports the
// recording as saved until the server confirms assembly.

export type UploadStatus = { state: "idle" | "recording" | "uploading" | "retrying" | "saved" | "failed"; pending: number; uploaded: number };

const TIMESLICE_MS = 4000;

function pickMime(): string {
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export class InterviewRecorder {
  private recorder: MediaRecorder | null = null;
  private queue: { index: number; blob: Blob; attempts: number }[] = [];
  private index = 0;
  private uploaded = 0;
  private part = -1;
  private startedAt = 0;
  private working = false;
  private stopped: Promise<void> | null = null;
  private audioCtx: AudioContext | null = null;
  private mixDest: MediaStreamAudioDestinationNode | null = null;

  constructor(private token: string, private onStatus: (s: UploadStatus) => void) {}

  private emit(state?: UploadStatus["state"]) {
    const s = state ?? (this.queue.length ? "uploading" : this.recorder?.state === "recording" ? "recording" : "idle");
    this.onStatus({ state: s, pending: this.queue.length, uploaded: this.uploaded });
  }

  /** Build a mixed audio track so the interviewer's voice is in the recording too. */
  addAudio(stream: MediaStream) {
    if (!this.audioCtx || !this.mixDest || !stream.getAudioTracks().length) return;
    this.audioCtx.createMediaStreamSource(stream).connect(this.mixDest);
  }

  async start(camera: MediaStream, offsetMs: number) {
    const mime = pickMime();
    this.audioCtx = new AudioContext();
    this.mixDest = this.audioCtx.createMediaStreamDestination();
    this.addAudio(new MediaStream(camera.getAudioTracks()));
    const combined = new MediaStream([...camera.getVideoTracks(), ...this.mixDest.stream.getAudioTracks()]);

    const res = await fetch(`/api/public/interview/${this.token}/recording`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset_ms: Math.round(offsetMs), mime_type: mime || "video/webm" }),
    });
    if (!res.ok) throw new Error("Could not start recording");
    this.part = (await res.json()).part_index;

    this.recorder = new MediaRecorder(combined, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 96_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.queue.push({ index: this.index++, blob: e.data, attempts: 0 });
        void this.pump();
      }
    };
    this.stopped = new Promise((resolve) => { this.recorder!.onstop = () => resolve(); });
    this.startedAt = performance.now();
    this.recorder.start(TIMESLICE_MS);
    this.emit("recording");
  }

  private async pump() {
    if (this.working) return;
    this.working = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0];
        this.emit();
        try {
          const r = await fetch(`/api/public/interview/${this.token}/recording/${this.part}/chunk/${item.index}`, { method: "PUT", body: item.blob });
          if (!r.ok && r.status !== 409) throw new Error(`HTTP ${r.status}`);
          this.queue.shift();
          this.uploaded++;
        } catch {
          item.attempts++;
          this.emit("retrying");
          await new Promise((r) => setTimeout(r, Math.min(15_000, 1000 * 2 ** Math.min(item.attempts, 4))));
        }
      }
    } finally {
      this.working = false;
      this.emit();
    }
  }

  /** Stop recording, flush all chunks, and ask the server to assemble the file. */
  async finish(timeoutMs = 90_000): Promise<boolean> {
    if (!this.recorder) return false;
    if (this.recorder.state !== "inactive") this.recorder.stop();
    await this.stopped;
    const deadline = Date.now() + timeoutMs;
    while ((this.queue.length || this.working) && Date.now() < deadline) {
      void this.pump();
      await new Promise((r) => setTimeout(r, 300));
    }
    if (this.queue.length) { this.emit("failed"); return false; }
    const durationMs = performance.now() - this.startedAt;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(`/api/public/interview/${this.token}/recording/${this.part}/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration_ms: Math.round(durationMs), total_chunks: this.index }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.status === "stored") { this.emit("saved"); this.cleanup(); return true; }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    this.emit("failed");
    return false;
  }

  cleanup() {
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }
}
