import 'dotenv/config';
import { loadVocab } from '../src/vocab.js';
import { summarizeVocab } from '../src/audit.js';
import { today } from '../src/dates.js';
import { TARGET_EXPOSURES } from '../src/config.js';

// Report vocab health: how many words have started, how many are due for review right
// now (the backlog), and how many started words are still under the exposure target.
// A backlog much larger than 1 means words are being added faster than the single daily
// review slot can recycle them. Run: npm run audit

async function main() {
  const vocab = await loadVocab();
  const s = summarizeVocab(vocab, today(), TARGET_EXPOSURES);

  console.log(`Vocab: ${s.total} total — ${s.newWords} not yet started, ${s.started} started`);
  console.log(`Due for review today (backlog): ${s.due}`);
  console.log(`Started but under ${TARGET_EXPOSURES} exposures: ${s.undertaught}`);

  if (s.due > 1) {
    console.log(
      `\nNOTE: ${s.due} words are due but only ${1} is reviewed per episode. The backlog ` +
        `grows by ~1/day, so words will not reach ${TARGET_EXPOSURES} exposures. Raise ` +
        `REVIEWS_PER_LESSON, slow new-word intake, or accept the tail.`,
    );
  }
  if (s.undertaught > 0) {
    const sample = s.undertaughtWords.slice(0, 15).map((w) => `${w.thai}(${w.timesTaught})`).join(' ');
    console.log(`\nUnder target (showing up to 15): ${sample}`);
  }
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
