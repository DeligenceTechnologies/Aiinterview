import "server-only";

// Central model configuration. Change models here (or via env) — never
// hard-code model names in services. Defaults reflect the OpenAI model
// catalogue at the time of writing; override with OPENAI_MODEL_* if needed.
const FAST = process.env.OPENAI_MODEL_FAST || "gpt-6-luna";
const REASONING = process.env.OPENAI_MODEL_REASONING || "gpt-6.1-sol";

export const AI_CONFIG = {
  resumeParser: FAST,
  jobParser: FAST,
  interviewPlanner: REASONING,
  answerAnalyzer: FAST,
  followupEngine: FAST,
  evaluator: REASONING,
  reportGenerator: REASONING,
  realtime: process.env.OPENAI_MODEL_REALTIME || "gpt-realtime-2.1",
  transcription: process.env.OPENAI_MODEL_TRANSCRIBE || "gpt-live-transcribe",
  voice: process.env.OPENAI_REALTIME_VOICE || "marin",
  /** Per-request timeout for text model calls. */
  timeoutMs: 45_000,
  /** Attempts for structured calls (validation failures count as attempts). */
  maxAttempts: 3,
} as const;

export type AIFeature =
  | "resume_parser"
  | "job_parser"
  | "interview_planner"
  | "answer_analyzer"
  | "followup_engine"
  | "section_evaluator"
  | "report_generator"
  | "realtime_session";
