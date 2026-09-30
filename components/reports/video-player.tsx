"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2, VideoOff } from "lucide-react";

export type RecordingPart = { part_index: number; offset_ms: number; duration_seconds: number | null; mime_type: string; url: string };
export type VideoPlayerHandle = { seek: (ms: number, play?: boolean) => void };

/**
 * Plays a recording made of one or more parts (a new part starts if the
 * candidate reconnected). Positions are on the interview clock (ms since start).
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, { parts: RecordingPart[] | null; error?: string | null; onTime?: (ms: number) => void }>(
  function VideoPlayer({ parts, error, onTime }, ref) {
    const video = useRef<HTMLVideoElement>(null);
    const [active, setActive] = useState(0);
    const pendingSeek = useRef<{ sec: number; play: boolean } | null>(null);
    const current = parts?.[active];

    const partFor = useCallback((ms: number) => {
      if (!parts?.length) return 0;
      let idx = 0;
      parts.forEach((p, i) => { if (p.offset_ms <= ms) idx = i; });
      return idx;
    }, [parts]);

    useImperativeHandle(ref, () => ({
      seek(ms, play = true) {
        if (!parts?.length || !video.current) return;
        const idx = partFor(ms);
        const sec = Math.max(0, (ms - parts[idx].offset_ms) / 1000);
        if (idx !== active) {
          pendingSeek.current = { sec, play };
          setActive(idx);
        } else {
          video.current.currentTime = sec;
          if (play) void video.current.play().catch(() => {});
        }
      },
    }), [parts, active, partFor]);

    useEffect(() => {
      const v = video.current;
      if (!v) return;
      const fixDuration = () => {
        // MediaRecorder WebM files often lack a duration header; force the browser to compute it.
        if (v.duration === Infinity) {
          const restore = () => { v.removeEventListener("durationchange", restore); v.currentTime = pendingSeek.current?.sec ?? 0; };
          v.addEventListener("durationchange", restore);
          v.currentTime = 1e101;
        } else if (pendingSeek.current) {
          v.currentTime = pendingSeek.current.sec;
        }
        if (pendingSeek.current?.play) void v.play().catch(() => {});
        pendingSeek.current = null;
      };
      v.addEventListener("loadedmetadata", fixDuration);
      return () => v.removeEventListener("loadedmetadata", fixDuration);
    }, [current?.url]);

    if (error) {
      return <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground"><VideoOff className="size-6" />{error}</div>;
    }
    if (!parts) {
      return <div className="flex aspect-video items-center justify-center rounded-xl bg-muted"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
    }
    if (!parts.length || !current) {
      return <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground"><VideoOff className="size-6" />No recording available</div>;
    }
    return (
      <div className="space-y-2">
        <video
          ref={video}
          key={current.url}
          src={current.url}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full rounded-xl bg-black"
          onTimeUpdate={(e) => onTime?.(current.offset_ms + e.currentTarget.currentTime * 1000)}
          onEnded={() => { if (active < parts.length - 1) { pendingSeek.current = { sec: 0, play: true }; setActive(active + 1); } }}
        />
        {parts.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            Recording parts (reconnections):
            {parts.map((p, i) => (
              <button key={p.part_index} type="button" onClick={() => setActive(i)} className={`rounded px-1.5 py-0.5 ${i === active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
