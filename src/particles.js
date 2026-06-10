// Thai politeness particles are gendered: men end with ครับ, women with ค่ะ (statement)
// or คะ (question). LLMs get this wrong often, so we fix it deterministically by speaker
// instead of trusting the model. Pronouns (ผม/ฉัน) are left alone — ผม also means "hair",
// so a blind swap would be unsafe.

const FEMALE_SPEAKERS = new Set(['teacher', 'student2']);
const MALE_SPEAKERS = new Set(['student1']);

const QUESTION_MARKERS = ['ไหม', 'มั้ย', 'ไหน', 'หรือ', 'เหรอ', 'อะไร', '?'];

function looksLikeQuestion(text) {
  return QUESTION_MARKERS.some((m) => text.includes(m));
}

// Fix the gendered particle at the speaker level for Thai lines. Returns new chunks.
export function fixGenderParticles(chunks) {
  return chunks.map((c) => {
    if (c.lang !== 'th') return c;
    let text = c.text;
    if (MALE_SPEAKERS.has(c.speaker)) {
      text = text.replace(/ค่ะ|คะ/g, 'ครับ');
    } else if (FEMALE_SPEAKERS.has(c.speaker)) {
      text = text.replace(/ครับ/g, looksLikeQuestion(text) ? 'คะ' : 'ค่ะ');
    }
    return text === c.text ? c : { ...c, text };
  });
}
