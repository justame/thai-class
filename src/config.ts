import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ROOT is the repo root. It is anchored to the current working directory rather than to
// this file's location because the compiled output lives under dist/ — a __dirname-based
// path would resolve to dist/ and miss data/, assets/, and docs/. Every entry point (the
// daily run and the npm scripts) is launched from the repo root, so cwd is the repo root.
const ROOT = process.cwd();

// User-editable defaults live in config.jsonc at the repo root. The values below are the
// FALLBACKS — config.jsonc only needs the keys you want to change, the rest fall back
// here. Secrets (API keys, tokens) never go in config.jsonc; they stay in .env.
export interface AppConfig {
  // Speaking speed. 1.0 = normal, lower = slower. Both slowed for beginners.
  thaiSpeakingRate: number;
  englishSpeakingRate: number;
  // Default silence after a line (seconds). A lesson line can set a longer pause; it is
  // clamped to [minPauseSeconds, maxPauseSeconds].
  defaultPauseSeconds: number;
  minPauseSeconds: number;
  maxPauseSeconds: number;
  // How many words of each kind go into one lesson. More than one new word overloads a
  // 60-90s episode.
  newPerLesson: number;
  reviewsPerLesson: number;
  // How many Director (charisma critic) passes run over the screenplay. 0 = skip the
  // critic. Distinct from reviewsPerLesson, which counts review WORDS, not passes.
  directorPasses: number;
  // A word needs ~10-12 spaced exposures to be learned (Nation). The audit flags started
  // words still under this.
  targetExposures: number;
  // SRS calendar ladder. A word advances one rung each time it appears in a lesson.
  intervalsDays: number[];
  // TTS provider: 'google' (native Thai voices) or 'elevenlabs'. Env TTS_PROVIDER wins.
  ttsProvider: string;
  // Generation/review model. Env OPENAI_MODEL wins.
  openaiModel: string;
  // Each speaker keeps the same Chirp3-HD voice name across Thai and English.
  speakerVoices: Record<string, string>;
  // Soft audio length guard (seconds). Outside the range we warn but still publish.
  minSeconds: number;
  maxSeconds: number;
  mp3SampleRateHz: number;
}

export const CONFIG_DEFAULTS: AppConfig = {
  thaiSpeakingRate: 0.78,
  englishSpeakingRate: 0.92,
  defaultPauseSeconds: 0.9,
  minPauseSeconds: 0.2,
  maxPauseSeconds: 3.0,
  newPerLesson: 1,
  reviewsPerLesson: 1,
  directorPasses: 1,
  targetExposures: 10,
  intervalsDays: [1, 3, 7, 14, 30],
  ttsProvider: 'google',
  openaiModel: 'gpt-4o',
  speakerVoices: {
    teacher: 'Achernar', // female, warm
    student1: 'Charon', // male, beginner
    student2: 'Kore', // female, stronger learner
  },
  minSeconds: 30,
  maxSeconds: 300,
  mp3SampleRateHz: 24000,
};

const CONFIG_FILE = join(ROOT, 'config.jsonc');

// Strip // line comments so a .jsonc file parses as JSON. A char scanner is used (not a
// regex) so a // inside a string value — e.g. a URL — is left untouched.
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text[i + 1] ?? '';
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    out += ch;
  }
  return out;
}

// Take the user's overrides and fill any missing key from the defaults. Unknown keys are
// dropped so a typo in config.jsonc can never inject a stray field.
export function mergeConfig(defaults: AppConfig, overrides: Record<string, unknown>): AppConfig {
  const out = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    if (overrides[key] !== undefined) out[key] = overrides[key];
  }
  return out as unknown as AppConfig;
}

// Read config.jsonc once at startup. A missing file means "use all defaults". A malformed
// file fails loudly — a silent fallback would hide a typo and quietly change the lessons.
function loadConfig(): AppConfig {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_FILE, 'utf8');
  } catch {
    return CONFIG_DEFAULTS;
  }
  let overrides: Record<string, unknown>;
  try {
    overrides = JSON.parse(stripJsonComments(raw)) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`config.jsonc is not valid: ${(err as Error).message}`);
  }
  return mergeConfig(CONFIG_DEFAULTS, overrides);
}

export const CONFIG = loadConfig();

// SRS calendar ladder. After the last rung a word repeats at the last interval forever.
export const INTERVALS_DAYS = CONFIG.intervalsDays;

export const REVIEWS_PER_LESSON = CONFIG.reviewsPerLesson;
export const DIRECTOR_PASSES = CONFIG.directorPasses;
export const NEW_PER_LESSON = CONFIG.newPerLesson;
export const TARGET_EXPOSURES = CONFIG.targetExposures;

// Soft audio length guard (seconds). Quality over duration — wide bounds.
export const MIN_SECONDS = CONFIG.minSeconds;
export const MAX_SECONDS = CONFIG.maxSeconds;

// Google TTS — Chirp3-HD voices are per-language; the voice used is
// `<lang>-Chirp3-HD-<speaker's name>`.
export const THAI_LANGUAGE_CODE = 'th-TH';
export const ENGLISH_LANGUAGE_CODE = 'en-US';
export const SPEAKER_VOICES: Record<string, string> = CONFIG.speakerVoices;
export const DEFAULT_SPEAKER = 'teacher';

// MP3 bitrate must be 96-320 kbps for Spotify.
export const MP3_SAMPLE_RATE_HZ = CONFIG.mp3SampleRateHz;

// Both slowed for beginners; Thai slower than English. 1.0 = normal, lower = slower.
export const THAI_SPEAKING_RATE = CONFIG.thaiSpeakingRate;
export const ENGLISH_SPEAKING_RATE = CONFIG.englishSpeakingRate;

// Default silence after a line. The lesson can set a longer pauseAfter per line, clamped
// to this range. Seconds.
export const DEFAULT_PAUSE_SECONDS = CONFIG.defaultPauseSeconds;
export const MIN_PAUSE_SECONDS = CONFIG.minPauseSeconds;
export const MAX_PAUSE_SECONDS = CONFIG.maxPauseSeconds;

// Generation/review model. Env OPENAI_MODEL overrides config.jsonc, which overrides the
// default — so a one-off run can swap models without editing the committed config.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || CONFIG.openaiModel;

// TTS provider: 'google' (native Thai voices, correct tones, free) or 'elevenlabs'
// (rejected 2026-06 — generic voices speak Thai with a bad accent). Env wins.
export const TTS_PROVIDER = process.env.TTS_PROVIDER || CONFIG.ttsProvider;

// ElevenLabs: multilingual_v2 is the most reliable for Thai. These stay code-level (the
// provider is rejected for now) — promote to config.jsonc if it is ever revisited.
export const ELEVEN_MODEL = 'eleven_multilingual_v2';
export const ELEVEN_VOICES: Record<string, string> = {
  teacher: '21m00Tcm4TlvDq8ikWAM', // Rachel (female)
  student1: 'pNInz6obpgDQGcFmaJgB', // Adam (male)
  student2: 'EXAVITQu4vr4xnSDxMaL', // Bella (female)
};
export const ELEVEN_MIN_SPEED = 0.7;
export const ELEVEN_MAX_SPEED = 1.2;

// Short audio cues mark section starts. Generated placeholder tones (see make-cues).
export const CUE_NAMES = ['start', 'new_word', 'try', 'correct', 'practice', 'recap'];

export const PATHS = {
  root: ROOT,
  vocab: join(ROOT, 'data', 'vocab.json'),
  cues: join(ROOT, 'assets', 'cues'),
  docs: join(ROOT, 'docs'),
  feed: join(ROOT, 'docs', 'feed.xml'),
  cover: join(ROOT, 'docs', 'cover.jpg'),
  build: join(ROOT, 'build'),
  episodes: join(ROOT, 'episodes'),
};

export const SHOW = {
  title: 'Daily Thai',
  description:
    'A short daily Thai lesson. A few new words, a few review words, real example sentences.',
  language: 'th',
  author: 'Daily Thai',
  categoryName: 'Education',
  categorySub: 'Language Learning',
};

export interface Env {
  openaiKey?: string;
  githubToken?: string;
  siteBaseUrl?: string;
  githubRepo?: string;
  ownerEmail?: string;
}

// Required environment variables. Read lazily so unit tests need no secrets.
export function getEnv(): Env {
  return {
    openaiKey: process.env.OPENAI_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    siteBaseUrl: process.env.SITE_BASE_URL,
    githubRepo: process.env.GITHUB_REPO,
    ownerEmail: process.env.PODCAST_OWNER_EMAIL,
  };
}
