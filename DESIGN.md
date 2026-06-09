# Daily Thai Podcast — Design

A small service that makes a ~60-90 second Thai lesson every day and puts it on
Spotify automatically. Free. For one person (the author).

## Goal

- One short audio lesson per day.
- A few new Thai words + a few older words due for review.
- Real example sentences, short English explanations, a quick recap.
- Lands in Spotify in the author's normal app.

## How it reaches Spotify (important)

Spotify has **no upload API** (verified — the Web API is read-only for podcasts).
The only way in is an **RSS feed** that Spotify reads on its own schedule.

So: GitHub hosts the audio + the feed for free. Spotify is told the feed URL
**once, by hand**. After that, every new episode shows up in Spotify on its own.

```
GitHub Actions (daily cron)
   -> pick words (code)
   -> write script (GPT)
   -> make audio (Google TTS)
   -> upload MP3 to GitHub Releases
   -> rebuild feed.xml on GitHub Pages
   -> Spotify pulls the feed -> episode appears in the app
```

No paid podcast host. GitHub plays that role for $0.

## Locked decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Publish path | GitHub Actions + Pages + Releases -> Spotify pulls RSS | Free, no middleman |
| 2 | Stack | Node.js | Author preference |
| 3 | RSS library | `podcast` (npm) | Only lib with full iTunes tags; freshness rule waived (see note) |
| 4 | Audio storage | GitHub **Releases** | No git history bloat |
| 5 | Feed + cover storage | GitHub **Pages** | Free static hosting |
| 6 | Vocab store | **JSON** file in repo, committed back each run | Tiny data, human-editable, no DB engine |
| 7 | Seed words | "Thai frequency 4000" Anki deck -> vocab.json | Pre-paired thai+english, ranked |
| 8 | TTS | **Google Chirp 3 HD, th-TH**, one voice, MP3 96-320 kbps | Native Thai, correct tones, free at this volume |
| 9 | Script format | LLM returns **structured JSON chunks** `{lang, text, role}` | Future-proofs 2-voice upgrade |
| 10 | SRS | **Calendar fixed ladder**: +1, +3, +7, +14, +30d, then every 30d | No feedback channel exists; see note |
| 11 | Words per lesson | ~2-3 new + ~2 due review, each with an example sentence | Fits 60-90s, avoids word-list feel |
| 12 | Script LLM | **OpenAI GPT**, JSON output mode | Author has key; structured output |
| 13 | Schedule | Daily ~09:00 ICT (`0 2 * * *` UTC) | Buffer so Spotify has it by ~11am |
| 14 | Title + description | **Code-built** from chosen words | Pure data, no LLM needed |
| 15 | Cover art | **Code-generated** placeholder 1400x1400 | Unblock now, swap later |
| 16 | Repo visibility | **Public** | Free Pages + Spotify must fetch feed/audio |
| 17 | Failure handling | **Publish first, commit state last** + notify on fail | No half-done side effects; missed day self-heals |

## Known limitations (surfaced, not hidden)

- **LLM can produce subtly wrong Thai** (wrong tone mark, unnatural phrasing). The
  author is the learner and cannot catch it. Mitigations: prefer dataset example
  sentences when present, source words only from the real list (LLM writes *around*
  given words, never invents vocabulary), keep sentences short.
- **SRS is not adaptive.** A podcast is one-way; there is no recall feedback. The
  schedule is a fixed calendar ladder, not real spaced repetition. `difficulty` and
  score fields are intentionally omitted.
- **Spotify pull timing is not controllable.** Best-effort; the episode appears in
  the app at Spotify's next poll, not exactly at publish time.
- **Exact episode duration is not guaranteed.** LLM text length varies; only a soft
  length check warns when far off.
- **GitHub Actions cron is UTC-only and best-effort** (can slip 5-15+ min, rarely
  skip). Fine for a daily lesson.
- **`podcast` npm package is old (2022).** Waived the "updated within 3 months" rule
  because podcast RSS is a frozen spec (Apple iTunes tags, unchanged for years) and
  the package is feature-complete, not abandoned (~2k downloads/week).

## One-time manual setup

1. Create a **public** GitHub repo, push this project.
2. Add **Actions Secrets**: `OPENAI_API_KEY`, `GOOGLE_TTS_KEY` (the service-account
   JSON). Never commit keys.
3. Seed `vocab.json` from the Anki deck (seed script).
4. Enable **GitHub Pages** (serve `/docs` or `gh-pages`).
5. Run the workflow once -> episode #1 live, `feed.xml` reachable.
6. Submit the feed to **Spotify for Creators** (steps in PLAN.md). One-time, by hand.

## Daily run order (failure-safe)

```
load vocab.json
  -> pick due reviews + new words      (code, deterministic)
  -> GPT writes JSON script             (LLM)
  -> Google TTS -> one MP3 (96-320kbps) (audio)
  -> upload MP3 to Releases
  -> rebuild feed.xml on Pages
  -> IF all above ok: commit advanced vocab.json   <-- state changes LAST
```

If any step fails: abort, commit nothing, send failure notification, retry tomorrow.
A missed day is harmless — due words stay due.
