import 'dotenv/config';
import { loadEpisodes, lastEpisodeNumber } from '../src/episodes.js';
import { getEpisodeNumber } from '../src/episode.js';
import { hasTranscript, readTranscriptChunks, transcriptPath } from '../src/transcript.js';
import { makeAudio } from '../src/tts.js';

// Voice the saved (and possibly edited) transcript — no regeneration.
// Run: npm run audio          (next episode, after npm run text)
//      npm run audio -- 2     (a specific episode, e.g. to re-voice an edited transcript)
// Makes build/lesson.mp3 so you can hear it.

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in .env');

  const number = getEpisodeNumber(process.argv[2], lastEpisodeNumber(await loadEpisodes()));
  if (!hasTranscript(number)) {
    throw new Error(`No transcript for episode #${number}. Run "npm run text" first.`);
  }

  const chunks = await readTranscriptChunks(number);
  console.log(`Voicing ${chunks.length} lines from ${transcriptPath(number)}...`);
  const { mp3Path, durationSeconds } = await makeAudio(chunks);
  console.log(`Done. ${mp3Path} (${durationSeconds?.toFixed(1) ?? '?'}s)`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
