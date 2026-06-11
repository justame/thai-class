import 'dotenv/config';
import { getEpisodeNumber } from '../src/episode.js';
import { hasTranscript, readTranscriptChunks, transcriptPath, audioPath, refreshHtml, latestTranscriptNumber } from '../src/transcript.js';
import { makeAudio } from '../src/tts.js';

// Voice the saved (and possibly edited) transcript — no regeneration.
// Run: npm run audio          (the newest draft, i.e. the one npm run text just wrote)
//      npm run audio -- 2     (a specific episode, e.g. to re-voice an edited transcript)
// Writes episodes/ep-N/lesson.mp3 next to the transcript and refreshes index.html.

async function main(): Promise<void> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in .env');

  // No arg → the newest draft on disk. With an arg → that exact episode.
  const number = process.argv[2] === undefined ? latestTranscriptNumber() : getEpisodeNumber(process.argv[2]);
  if (number === 0 || !hasTranscript(number)) {
    throw new Error(`No transcript for episode #${number || '(none)'}. Run "npm run text" first.`);
  }

  const chunks = await readTranscriptChunks(number);
  console.log(`Voicing ${chunks.length} lines from ${transcriptPath(number)}...`);
  const { mp3Path, durationSeconds } = await makeAudio(chunks, { outPath: audioPath(number) });
  await refreshHtml(number);
  console.log(`Done. ${mp3Path} (${durationSeconds?.toFixed(1) ?? '?'}s)`);
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
