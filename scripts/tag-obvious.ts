import 'dotenv/config';
import { loadVocab, saveVocab } from '../src/vocab.js';
import { tagObviousWords } from '../src/curate.js';

// Tag every vocab word with obvious=true/false so lesson selection skips words the
// learner already knows (hello, thank you, go...). Idempotent: re-running only tags
// words that have no tag yet, so run it again after seeding new words.
// Run: npm run tag

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY in .env');

  const vocab = await loadVocab();
  const tagged = await tagObviousWords(vocab, {
    onProgress: (done, total) => console.log(`Tagged ${done}/${total}`),
  });

  const obvious = tagged.filter((w) => w.obvious);
  await saveVocab(tagged);

  console.log(`\n${obvious.length} of ${tagged.length} words tagged obvious (will be skipped):`);
  console.log(obvious.map((w) => w.thai).join(' '));
  console.log('\nDisagree with a tag? Edit "obvious" in data/vocab.json by hand.');
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
