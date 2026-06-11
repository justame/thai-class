# Lesson Charisma Redesign — Design

**Date:** 2026-06-11
**Status:** Approved (design), pending implementation plan

## Problem

Listening to a generated lesson (ep-4, [docs/transcripts/ep-4.md](../../transcripts/ep-4.md)) it feels
boring, flat, hard to focus on. User's ranked complaint: **dead delivery** — teacher and
students sound robotic, no warmth, no humor, no real reactions.

Verified causes from the real transcript + config:

1. **Form, not scene.** Generation uses `gpt-4o` with a strict JSON schema
   ([script.ts:26](../../../src/script.ts#L26)). The model fills a rigid form instead of writing a
   scene — a big driver of flatness.
2. **Flat praise, no Thai warmth.** All praise is generic English ("Good try", "Great job",
   "Well done"). The Thai reactions the template asks for (เก่งมาก, เยี่ยมเลย) never appear. No
   personality lines.
3. **Recall pause capped too short.** `maxPauseSeconds: 3.0` ([config.jsonc:13](../../../config.jsonc))
   clamps at [tts.ts:53](../../../src/tts.ts#L53). The recall beat ("How do you say…?") gets exactly
   3.0s — not enough to produce a full Thai sentence — even though the template asks for "3s+".
4. **Choppy audio.** Sentences shredded into fragments glued by 0.2s pauses (the "split every
   heard Thai word into its own line" rule chopping English prose mid-sentence).
5. **Robotic rhythm.** Every Thai line rate 0.78, every English 0.92, pauses cluster at 0.2/1.5.

## Decisions

- **Appetite:** Go big — rethink generation (prose-first + critic + model upgrade).
- **Model:** Stay OpenAI (keep SDK + `OPENAI_API_KEY`). Move off `gpt-4o` to the **newest GPT
  model**, set via `openaiModel` in config.jsonc / `OPENAI_MODEL` env. The exact model id is
  chosen and verified live at implementation time — not hardcoded from memory now.
- **Primary fix target:** dead delivery (content), with pacing fixes bundled in.

## Architecture — 3 stages, each one job

Replaces the single `gpt-4o + strict-schema` generate call. `generateScript()`
([script.ts:71](../../../src/script.ts#L71)) keeps its signature and becomes the orchestrator, so
`scripts/text.ts` is untouched.

```
writeScene → directScene (×directorPasses) → formatScene
  → fixGenderParticles → reviewThai → splitMixedScriptLines → checkNoMixedScript → save
```

### Stage 1 — Writer (`src/write-scene.ts`)
- Free-form, **no JSON schema.** Writes the lesson as a natural screenplay so the model writes
  a scene, not a form.
- Uses the newest GPT model.
- Output = screenplay text (format below).

### Stage 2 — Director (`src/direct-scene.ts`)
- Critic pass. Reads the screenplay, grades it on the rubric, rewrites flat lines.
- Loops `directorPasses` times (NEW config key, default 1 — distinct from `reviewsPerLesson`,
  which counts review words, not critic passes).
- Mirrors how `reviewThai` ([verify.ts](../../../src/verify.ts)) works.

### Stage 3 — Formatter (`src/format-scene.ts`)
- Converts final screenplay → chunks. **Deterministic — no LLM call, pure function, fully
  unit-tested.**
- Parses each row (`SPEAKER (mood): text`, `[CUE: name]`), strips the mood tag, splits Thai
  out of mixed text into `th` pieces by reusing `splitText` ([split-script.ts](../../../src/split-script.ts)).
- Sets `pauseAfter` from an optional trailing `[wait Ns]` hint on the screenplay row (set by
  the Writer/Director, who know the beat); the wait lands on the last piece of the row, other
  pieces of the same row get a small 0.2s intra-line pause. No hint → default by lang. All
  clamped to [0.2, 6.0].
- An English sentence with no Thai stays one whole chunk — no 0.2s-glued fragments (the ep-4
  disease).

### Kept unchanged (post-format)
`fixGenderParticles` → `reviewThai` (Thai correctness) → `splitMixedScriptLines` →
`checkNoMixedScript` (audio contract guard) → write transcript / HTML / feedback template.

## Screenplay format

One spoken line per row. Plain text — easy for the model to write naturally, easy to parse.

```
TEACHER (warm): สวัสดีค่ะ! I'm Kru Nan.
TEACHER: Imagine you're hungry in a Bangkok market...
STUDENT1 (hesitant): Hmm... let me think...
STUDENT1 (unsure): ผม อาหาร ต้องการ ครับ
TEACHER (encouraging): เกือบแล้ว! Almost. Listen: ผมต้องการอาหาร ครับ
[CUE: new_word]
TEACHER: How do you say "I want food"? [wait 5s]
```

- Thai stays in Thai script inline.
- Mood in `()` is optional, guides the Writer's delivery, **dropped before TTS.**
- Optional trailing `[wait Ns]` sets the pause after that row (used for recall beats and
  repeat-after-me). No hint → Formatter uses the lang default.
- Cues as `[CUE: name]` where name ∈ start/new_word/try/correct/practice/recap.
- Also more readable for `feedback.md` notes than the chunk format.

## Director rubric

Grades + rewrites against the exact ep-4 failures:

- **Varied praise** — never reuse "good job/great"; teacher reacts in **Thai first**
  (เก่งมาก / เยี่ยมเลย / ใกล้แล้ว) then English.
- **Personality** — at least one human aside per lesson (a small joke, Kru Nan likes the
  market too).
- **Real hesitation** — students think in their own words, not canned "Hmm let me think."
- **Rhythm** — flag monotone; vary sentence length and pacing.
- **No dead lines** — pure-filler lines get cut or warmed up.

The rubric lives in the Director prompt. The same rules are also seeded into
`lessons/feedback-rules.md` as one-liners so the Writer (Stage 1) starts warmer.

## Pause plan

The Writer/Director set pauses via `[wait Ns]` hints on screenplay rows, guided by the rubric
(the creative stage knows which line is the recall beat). The Formatter reads the hint; with no
hint it uses the lang default. Target values the rubric asks for:

| Line role | Pause | Why |
|---|---|---|
| Recall question ("How do you say…?") | 5–6s | learner produces a full sentence; 3s too short |
| Thai word/sentence to repeat | 1.5–2s | room to echo |
| Normal speech | 0.5–0.9s (lang default) | natural breath |
| Mid-sentence beat (extra pieces of one row) | 0.2s | the only place tiny pauses belong |
| After a cue | 0.3s | as today |

**Config change:** raise `maxPauseSeconds` 3.0 → **6.0** ([config.jsonc:13](../../../config.jsonc)) so the
recall beat can breathe. Code clamps pauses to the new [0.2, 6.0] range as a safety net
([tts.ts:53](../../../src/tts.ts#L53)).

## Testing

TDD — test first. (Per testing rules: mock only at the network boundary.)

- **`format-scene`** — deterministic, pure, most tested. Cases: Thai-inline splits to own `th`
  line; `[CUE: x]` → cue chunk; mood tag stripped; recall line gets long pause; empty/malformed
  line rejected.
- **Pause clamp** — value >6 clamps to 6, <0.2 clamps to 0.2 (lock the new ceiling).
- **`write-scene` / `direct-scene`** — LLM calls mocked at the boundary. Assert the prompt
  carries the rubric. Not asserting "is it warm" — charisma is not unit-testable.

**Real quality gate = the ear:** `npm run text -- --word=อาหาร` → read transcript →
`npm run audio` → listen. Same word as ep-4, so old vs new can be A/B compared.

## Known limits (mark with NOTE in code)

- 3 LLM calls = ~3× generation cost + slower than today's 1 call.
- Charisma is not unit-testable — gated by the Director rubric + the ear, not a test.
- Mood tags can't change Google's voice yet (Chirp3-HD has no style control).
