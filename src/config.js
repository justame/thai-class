import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// SRS calendar ladder. A word advances one rung each time it appears in a lesson.
// After the last rung it repeats at the last interval forever (review-forever).
export const INTERVALS_DAYS = [1, 3, 7, 14, 30];

// How many of each kind go into one lesson. A focused lesson teaches ONE new word well
// and reinforces ONE review word — more than that overloads a 60-90s episode.
export const REVIEWS_PER_LESSON = 1;
export const NEW_PER_LESSON = 1;

// A word needs roughly 10-12 spaced exposures to be learned (Nation, "How Vocabulary
// is Learned"). The audit (npm run audit) flags started words still under this, and a
// growing review backlog — both mean words are being added faster than they recycle.
export const TARGET_EXPOSURES = 10;

// Soft audio length guard (seconds). Quality over duration — wide bounds, only catches
// truly broken output (empty or runaway). Outside the range we warn but still publish.
export const MIN_SECONDS = 30;
export const MAX_SECONDS = 300;

// Google TTS — each lesson line has a speaker (teacher/student1/student2) and a language.
// Chirp3-HD voices are per-language, so a speaker keeps the SAME voice name in both
// languages (same gender + identity across Thai and English). The voice used is
// `<lang>-Chirp3-HD-<speaker's name>`.
export const THAI_LANGUAGE_CODE = 'th-TH';
export const ENGLISH_LANGUAGE_CODE = 'en-US';
export const SPEAKER_VOICES = {
  teacher: 'Achernar', // female, warm
  student1: 'Charon', // male, beginner
  student2: 'Kore', // female, stronger learner
};
export const DEFAULT_SPEAKER = 'teacher';

// MP3 bitrate must be 96-320 kbps for Spotify.
export const MP3_SAMPLE_RATE_HZ = 24000;

// Both slowed for beginners; Thai slower than English. 1.0 = normal, lower = slower.
export const THAI_SPEAKING_RATE = 0.78;
export const ENGLISH_SPEAKING_RATE = 0.92;

// Default silence after a line. The lesson can set a longer pauseAfter per line (e.g. to
// let the listener repeat). Clamped to this range. Seconds.
export const DEFAULT_PAUSE_SECONDS = 0.9;
export const MIN_PAUSE_SECONDS = 0.2;
export const MAX_PAUSE_SECONDS = 3.0;

// Generation/review model. gpt-4o is the safe default (known to work on this account).
// To try a stronger model that follows the Thai/romanization rules better, set
// OPENAI_MODEL in .env (e.g. gpt-4.1) — no code change needed. A bad name fails the
// whole run loudly, so only set one your account can use.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// TTS provider: 'google' (native Thai voices, correct tones, free) or 'elevenlabs'
// (more human delivery but its generic voices speak Thai with a bad accent — tried and
// rejected 2026-06; revisit only with Thai-native voices from the EL voice library).
export const TTS_PROVIDER = process.env.TTS_PROVIDER || 'google';

// ElevenLabs: multilingual_v2 is the most reliable for Thai. eleven_v3 is more expressive
// (supports [hesitates]/[sighs] tags) but costs more and its Thai is less proven.
export const ELEVEN_MODEL = 'eleven_multilingual_v2';
// Public default voice IDs, cast by the speaker's gender. Swap for Thai-native voices
// from your ElevenLabs library when you have voices_read access.
export const ELEVEN_VOICES = {
  teacher: '21m00Tcm4TlvDq8ikWAM', // Rachel (female)
  student1: 'pNInz6obpgDQGcFmaJgB', // Adam (male)
  student2: 'EXAVITQu4vr4xnSDxMaL', // Bella (female)
};
// ElevenLabs speaking speed is clamped to this range by the API.
export const ELEVEN_MIN_SPEED = 0.7;
export const ELEVEN_MAX_SPEED = 1.2;

// Short audio cues mark section starts (start, new_word, practice, recap). These are
// generated placeholder tones (see scripts/make-cues.js); swap the files for nicer chimes.
export const CUE_NAMES = ['start', 'new_word', 'try', 'correct', 'practice', 'recap'];

export const PATHS = {
  root: ROOT,
  vocab: join(ROOT, 'data', 'vocab.json'),
  cues: join(ROOT, 'assets', 'cues'),
  docs: join(ROOT, 'docs'),
  feed: join(ROOT, 'docs', 'feed.xml'),
  cover: join(ROOT, 'docs', 'cover.jpg'),
  build: join(ROOT, 'build'),
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

// Required environment variables. Read lazily so unit tests need no secrets.
export function getEnv() {
  return {
    openaiKey: process.env.OPENAI_API_KEY,
    githubToken: process.env.GITHUB_TOKEN,
    siteBaseUrl: process.env.SITE_BASE_URL,
    githubRepo: process.env.GITHUB_REPO,
    ownerEmail: process.env.PODCAST_OWNER_EMAIL,
  };
}
