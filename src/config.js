import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// SRS calendar ladder. A word advances one rung each time it appears in a lesson.
// After the last rung it repeats at the last interval forever (review-forever).
export const INTERVALS_DAYS = [1, 3, 7, 14, 30];

// How many of each kind go into one lesson. Reviews are filled first, then new words.
export const REVIEWS_PER_LESSON = 2;
export const NEW_PER_LESSON = 3;

// Soft audio length guard (seconds). Outside this range we warn but still publish.
export const MIN_SECONDS = 40;
export const MAX_SECONDS = 100;

// Google TTS — one native Thai voice for v1. Chunks already carry a `lang` tag so a
// future two-voice upgrade only changes tts.js, not the script format.
export const THAI_VOICE = 'th-TH-Chirp3-HD-Achernar';
export const THAI_LANGUAGE_CODE = 'th-TH';
// MP3 bitrate must be 96-320 kbps for Spotify.
export const MP3_SAMPLE_RATE_HZ = 24000;

export const OPENAI_MODEL = 'gpt-4o';

export const PATHS = {
  root: ROOT,
  vocab: join(ROOT, 'data', 'vocab.json'),
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
