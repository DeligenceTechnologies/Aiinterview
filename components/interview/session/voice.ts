"use client";

// Voice engines for the live interview. The backend decides every line; an
// engine only (a) speaks a given line and (b) reports candidate speech.

import { speakInstruction } from "@/prompts/realtime-interviewer/v1";

export type VoiceCallbacks = {
  onSpeechStart: () => void;
  onSpeechStop: () => void;
  onTranscript: (text: string, itemId: string) => void;
  onPendingChange: (pending: number) => void;
  onConnection: (state: "connected" | "reconnecting" | "failed") => void;
  onRemoteStream: (stream: MediaStream) => void;
  onEvent: (type: string, payload?: Record<string, string | number | boolean | null>) => void;
};

export interface VoiceEngine {
  readonly kind: "openai" | "browser";
  connect(): Promise<void>;
  speak(text: string): Promise<{ transcript: string }>;
  startListening(): void;
  stopListening(): void;
  close(): void;
}

type Creds = { mode: "openai"; clientSecret: string; callsUrl: string; model: string } | { mode: "mock" };

export async function fetchCredentials(token: string): Promise<Creds> {
  const res = await fetch(`/api/public/interview/${token}/realtime-session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Could not connect to the interviewer");
  return data as Creds;
}

/** OpenAI Realtime over WebRTC using a short-lived client secret minted by our server. */
export class RealtimeVoice implements VoiceEngine {
  readonly kind = "openai" as const;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  private mic: MediaStreamTrack;
  private pending = new Set<string>();
  private listening = false;
  private speaking: null | { resolve: (v: { transcript: string }) => void; reject: (e: Error) => void; transcript: string; timers: ReturnType<typeof setTimeout>[]; text: string } = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private creds: Extract<Creds, { mode: "openai" }>, micTrack: MediaStreamTrack, private cb: VoiceCallbacks) {
    this.mic = micTrack.clone();
    this.mic.enabled = false;
  }

  async connect() {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    this.audio = new Audio();
    this.audio.autoplay = true;
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.audio!.srcObject = stream;
      this.cb.onRemoteStream(stream);
    };
    pc.addTrack(this.mic, new MediaStream([this.mic]));
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.cb.onConnection("connected");
      } else if (s === "failed") {
        this.cb.onConnection("reconnecting");
      } else if (s === "disconnected") {
        this.disconnectTimer = setTimeout(() => pc.connectionState !== "connected" && this.cb.onConnection("reconnecting"), 3000);
      }
    };
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.handle(JSON.parse(e.data));
    const opened = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Timed out connecting to the interviewer")), 20_000);
      dc.onopen = () => { clearTimeout(t); resolve(); };
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch(this.creds.callsUrl, {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${this.creds.clientSecret}`, "Content-Type": "application/sdp" },
    });
    if (!res.ok) throw new Error(`Interviewer connection failed (${res.status})`);
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    await opened;
    this.cb.onConnection("connected");
    this.cb.onEvent("realtime_connected", { model: this.creds.model });
  }

  private send(event: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  private finishSpeaking() {
    const s = this.speaking;
    if (!s) return;
    s.timers.forEach(clearTimeout);
    this.speaking = null;
    s.resolve({ transcript: s.transcript || s.text });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(ev: any) {
    switch (ev.type) {
      case "output_audio_buffer.stopped":
        this.finishSpeaking();
        break;
      case "response.output_audio_transcript.done":
        if (this.speaking) this.speaking.transcript = ev.transcript ?? "";
        break;
      case "response.done": {
        // Keep the realtime context small: the backend owns the conversation.
        for (const item of ev.response?.output ?? []) if (item.id) this.send({ type: "conversation.item.delete", item_id: item.id });
        if (ev.response?.status === "failed") {
          const s = this.speaking;
          this.speaking = null;
          s?.timers.forEach(clearTimeout);
          s?.reject(new Error("The interviewer couldn't speak that line"));
          this.cb.onEvent("realtime_response_failed", { reason: String(ev.response?.status_details?.error?.code ?? "unknown") });
        } else if (this.speaking) {
          // Fallback in case the playback-stopped event never arrives.
          const words = (this.speaking.transcript || this.speaking.text).split(/\s+/).length;
          this.speaking.timers.push(setTimeout(() => this.finishSpeaking(), 2500 + words * 420));
        }
        break;
      }
      case "input_audio_buffer.speech_started":
        if (this.listening) this.cb.onSpeechStart();
        break;
      case "input_audio_buffer.speech_stopped":
        if (this.listening) this.cb.onSpeechStop();
        break;
      case "input_audio_buffer.committed":
        if (ev.item_id) { this.pending.add(ev.item_id); this.cb.onPendingChange(this.pending.size); }
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.pending.delete(ev.item_id);
        this.cb.onPendingChange(this.pending.size);
        if (ev.transcript?.trim()) this.cb.onTranscript(ev.transcript.trim(), ev.item_id);
        this.send({ type: "conversation.item.delete", item_id: ev.item_id });
        break;
      case "conversation.item.input_audio_transcription.failed":
        this.pending.delete(ev.item_id);
        this.cb.onPendingChange(this.pending.size);
        this.cb.onEvent("transcription_failed", {});
        break;
      case "error":
        // Deleting an already-removed item is harmless; ignore that noise.
        if (ev.error?.code !== "item_not_found") this.cb.onEvent("realtime_error", { code: String(ev.error?.code ?? ""), message: String(ev.error?.message ?? "").slice(0, 300) });
        break;
    }
  }

  speak(text: string) {
    return new Promise<{ transcript: string }>((resolve, reject) => {
      this.speaking = { resolve, reject, transcript: "", text, timers: [] };
      this.speaking.timers.push(setTimeout(() => this.finishSpeaking(), 90_000));
      this.send({ type: "response.create", response: { instructions: speakInstruction(text) } });
    });
  }

  startListening() {
    this.listening = true;
    this.mic.enabled = true;
  }

  stopListening() {
    this.listening = false;
    this.mic.enabled = false;
    this.send({ type: "input_audio_buffer.clear" });
  }

  close() {
    this.speaking?.timers.forEach(clearTimeout);
    this.speaking = null;
    try { this.dc?.close(); } catch { /* noop */ }
    try { this.pc?.close(); } catch { /* noop */ }
    this.mic.stop();
    if (this.audio) this.audio.srcObject = null;
  }
}

/**
 * Demo-mode engine (no OpenAI key): the browser's speech synthesis voices the
 * interviewer; the candidate types (or dictates) answers.
 */
export class BrowserVoice implements VoiceEngine {
  readonly kind = "browser" as const;
  constructor(private cb: VoiceCallbacks) {}
  async connect() {
    this.cb.onConnection("connected");
  }
  speak(text: string) {
    return new Promise<{ transcript: string }>((resolve) => {
      const done = () => resolve({ transcript: text });
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return setTimeout(done, 1500);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      let fallback = setTimeout(done, 2000 + text.split(/\s+/).length * 450);
      // Browsers without speech output (e.g. headless) never fire onstart: don't make the candidate wait.
      const noVoice = setTimeout(() => { clearTimeout(fallback); fallback = setTimeout(done, 300); }, 2500);
      u.onstart = () => clearTimeout(noVoice);
      u.onend = () => { clearTimeout(fallback); clearTimeout(noVoice); done(); };
      u.onerror = () => { clearTimeout(fallback); clearTimeout(noVoice); done(); };
      window.speechSynthesis.speak(u);
    });
  }
  startListening() {}
  stopListening() {}
  close() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}
