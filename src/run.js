import 'dotenv/config';
import { existsSync } from 'node:fs';
import { loadVocab, saveVocab, mergeWords } from './vocab.js';
import { selectLessonWords, advanceWord } from './srs.js';
import { addTranslations } from './translate.js';
import { generateScript } from './script.js';
import { makeAudio } from './tts.js';
import { makeCover } from './cover.js';
import { uploadAudio } from './publish.js';
import { writeFeed } from './feed.js';
import { loadEpisodes, saveEpisodes, lastEpisodeNumber, makeEpisode } from './episodes.js';
import { buildTitle, buildDescription, nextEpisodeNumber } from './episode.js';
import { today } from './dates.js';
import { getEnv, PATHS } from './config.js';

// The daily pipeline. Order is failure-safe: the only network publish that mutates
// the outside world (uploading the MP3) happens BEFORE any local state is written.
// If any step throws, nothing is saved and nothing is committed — tomorrow retries
// cleanly. A missed day is harmless because selection is calendar-based.

function requireEnv(env) {
  const missing = Object.entries({
    OPENAI_API_KEY: env.openaiKey,
    GITHUB_TOKEN: env.githubToken,
    GITHUB_REPO: env.githubRepo,
    SITE_BASE_URL: env.siteBaseUrl,
    PODCAST_OWNER_EMAIL: env.ownerEmail,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
}

async function main() {
  const env = getEnv();
  requireEnv(env);
  const now = today();

  // 1. Load state.
  const vocab = await loadVocab();
  const episodes = await loadEpisodes();

  // 2. Pick today's words (deterministic code, no LLM).
  const selected = selectLessonWords(vocab, now);
  if (selected.all.length === 0) throw new Error('No words available — seed data/vocab.json first');
  console.log(`Lesson words: ${selected.news.length} new, ${selected.reviews.length} review`);

  // 3. Translate any chosen words that are still Thai-only (lazy, once per word).
  const filled = await addTranslations(selected.all, { apiKey: env.openaiKey });
  const byId = new Map(filled.map((w) => [w.id, w]));
  const news = selected.news.map((w) => byId.get(w.id));
  const reviews = selected.reviews.map((w) => byId.get(w.id));
  const all = filled;

  // 4. Write the script (LLM).
  const chunks = await generateScript(news, reviews, { apiKey: env.openaiKey });

  // 5. Make the audio (Google TTS -> ffmpeg MP3 128k).
  const { mp3Path, durationSeconds } = await makeAudio(chunks);

  // 6. Make sure the show cover exists (one-time; committed after first run).
  if (!existsSync(PATHS.cover)) await makeCover();

  // 7. Build the episode record.
  const number = nextEpisodeNumber(lastEpisodeNumber(episodes));
  const title = buildTitle(all, number);
  const description = buildDescription(reviews, news);

  // 8. PUBLISH: upload the MP3 to Releases (the outside-world step). Must succeed
  //    before any local state changes.
  const { audioUrl, fileSizeBytes } = await uploadAudio(mp3Path, number, {
    token: env.githubToken,
    repo: env.githubRepo,
  });
  console.log(`Uploaded episode #${number}: ${audioUrl}`);

  // 9. Append the episode and rebuild the feed.
  const newEpisodes = [...episodes, makeEpisode({ number, title, description, pubDate: now, audioUrl, durationSeconds, fileSizeBytes })];
  await writeFeed(newEpisodes, { siteBaseUrl: env.siteBaseUrl, ownerEmail: env.ownerEmail });

  // 10. STATE LAST: advance the taught words (with any new translations) and save.
  //     If the run reached here, publishing already succeeded, so it is safe to
  //     record progress.
  const advanced = all.map((w) => advanceWord(w, now));
  await saveVocab(mergeWords(vocab, advanced));
  await saveEpisodes(newEpisodes);

  console.log(`Done. Episode #${number}, ${durationSeconds?.toFixed(1) ?? '?'}s.`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
