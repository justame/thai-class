// A deterministic guard run before any audio is made. The Google Chirp3-HD voices read
// one script per voice: the Thai voice mangles Latin letters, the English voice mangles
// Thai script. So a single line must never mix the two. There is no TTS setting that
// fixes this (custom pronunciation is not available for Thai), so we reject such lines
// instead of voicing garbage. Romanization (e.g. 'jà pai') is Latin and belongs only in
// English lines; Thai script belongs only in Thai lines.

const THAI_PATTERN = /[฀-๿]/;
const LATIN_PATTERN = /[A-Za-z]/;

// Return one problem per offending line: { index, speaker, lang, text, reason }.
// Cue lines are skipped — their text is a marker name (e.g. "new_word"), not speech.
export function findMixedScriptLines(chunks) {
  const problems = [];
  chunks.forEach((c, index) => {
    if (c.speaker === 'cue') return;
    if (c.lang === 'th' && LATIN_PATTERN.test(c.text)) {
      problems.push({ index, speaker: c.speaker, lang: c.lang, text: c.text, reason: 'Latin letters in a Thai line' });
    } else if (c.lang === 'en' && THAI_PATTERN.test(c.text)) {
      problems.push({ index, speaker: c.speaker, lang: c.lang, text: c.text, reason: 'Thai script in an English line' });
    }
  });
  return problems;
}

// Throw if any line mixes scripts; otherwise return the chunks unchanged.
export function checkNoMixedScript(chunks) {
  const problems = findMixedScriptLines(chunks);
  if (problems.length === 0) return chunks;
  const lines = problems.map((p) => `  line ${p.index} (${p.speaker}/${p.lang}): ${p.reason} — "${p.text}"`).join('\n');
  throw new Error(`Mixed script — the voice cannot read these lines correctly:\n${lines}`);
}
