import type { Chunk } from './types.js';

// Thai politeness particles are gendered: men end with ครับ, women with ค่ะ (statement)
// or คะ (question). LLMs get this wrong often, so we fix it deterministically instead of
// trusting the model. Pronouns (ผม/ฉัน) are left alone — ผม also means "hair", so a blind
// swap would be unsafe.

const FEMALE_SPEAKERS = new Set(['teacher', 'student2']);
const MALE_SPEAKERS = new Set(['student1']);

const QUESTION_MARKERS = ['ไหม', 'มั้ย', 'ไหน', 'หรือ', 'เหรอ', 'อะไร', '?'];
const MALE_PRONOUN = /ผม/;

function looksLikeQuestion(text: string): boolean {
  return QUESTION_MARKERS.some((m) => text.includes(m));
}

// The particle a Thai line should end with. The pronoun inside the line wins over the
// speaker: a female teacher modeling a male sentence ("ผมชอบอาหาร…") must end ครับ so the
// pronoun and particle agree. Only when no male pronoun is present do we fall back to the
// speaker's own gender.
// NOTE: this treats any ผม as the male pronoun. ผม can also mean "hair"; in these
// pronoun-led beginner sentences that case does not occur, but a "hair" line by a female
// speaker would be wrongly switched to ครับ.
function targetParticle(speaker: string, text: string): string {
  if (MALE_SPEAKERS.has(speaker) || MALE_PRONOUN.test(text)) return 'ครับ';
  return looksLikeQuestion(text) ? 'คะ' : 'ค่ะ';
}

// Fix the gendered particle for every Thai line so pronoun and particle agree. New chunks.
//
// NOTE: this runs on student1's lines too, including the line with his INTENTIONAL beginner
// mistake — but it is safe against that. It only REPLACES an existing ครับ/ค่ะ/คะ, never adds
// one, so a "missing particle" mistake passes through. The allowed mistakes are word order,
// literal English-to-Thai, and missing particle (see classroom.md) — none is a particle swap.
// A wrong-gender particle is explicitly forbidden as a mistake, so the only thing this would
// change is a case the lesson never produces. Do NOT exempt student1 here: he is male, so
// forcing ครับ is always correct for him, and exempting him would let real model errors through.
export function fixGenderParticles(chunks: Chunk[]): Chunk[] {
  return chunks.map((c) => {
    if (c.lang !== 'th') return c;
    const text = c.text.replace(/ครับ|ค่ะ|คะ/g, targetParticle(c.speaker, c.text));
    return text === c.text ? c : { ...c, text };
  });
}
