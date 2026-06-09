# Build Plan

Build order for the Daily Thai Podcast. See DESIGN.md for the locked decisions and
the reasons behind them.

## Project layout

```
thai-class/
  package.json
  .env.example              # names of required env vars (no values)
  .gitignore
  data/
    vocab.json              # the word store (committed back daily)
  src/
    config.js               # env vars, constants (intervals, counts, voice, paths)
    vocab.js                # load/save vocab.json, schema check
    srs.js                  # calendar ladder: pick due reviews + new words, advance
    script.js               # call OpenAI -> structured JSON lesson chunks
    tts.js                  # join chunks -> Google TTS -> one MP3
    feed.js                 # build feed.xml with `podcast` package
    publish.js              # upload MP3 to GitHub Releases, write feed + cover to Pages
    cover.js                # generate 1400x1400 placeholder cover (once)
    episode.js              # build title + description from chosen words
    run.js                  # the daily pipeline (wires it all, failure-safe order)
  scripts/
    seed.js                 # one-time: Anki deck -> vocab.json
  docs/                     # GitHub Pages root (feed.xml, cover.jpg)
  .github/workflows/
    daily.yml               # cron 0 2 * * * UTC, runs src/run.js, commits state last
  test/                     # vitest unit tests (srs, vocab, episode, feed)
```

## Phases

### Phase 1 — core logic (no network), test-first
- `config.js` — constants: `INTERVALS_DAYS = [1, 3, 7, 14, 30]`, `NEW_PER_LESSON`,
  `REVIEWS_PER_LESSON`, voice name, paths, email.
- `vocab.js` — load, save (stable key order + pretty-print for clean diffs), schema check.
- `srs.js` — `getDueWords(words, today)`, `getNewWords(words, n)`, `advanceWord(word, today)`.
- `episode.js` — `buildTitle(words, epNo)`, `buildDescription(words, script)`.
- Tests for srs (ladder math, overdue order), vocab (round-trip, schema), episode.

### Phase 2 — seed data
- `scripts/seed.js` — read Anki deck export (CSV), map to vocab record shape, write
  `data/vocab.json`. Spot-check top 100 words by hand.

### Phase 3 — LLM script
- `script.js` — prompt + OpenAI JSON mode -> array of `{lang, text, role}`. Pin dataset
  example sentences when available. Validate output shape.

### Phase 4 — audio
- `tts.js` — concat chunk text (one th-TH voice for v1), Google TTS -> MP3, force
  96-320 kbps. Soft duration check (warn if <40s or >100s).

### Phase 5 — feed + publish
- `cover.js` — generate placeholder cover once.
- `feed.js` — `podcast` package, channel tags (title, language, itunes:image,
  itunes:category, itunes:explicit, owner email), one `<item>` per episode with
  enclosure pointing at the Release URL.
- `publish.js` — upload MP3 to GitHub Releases (octokit), write feed.xml + cover to docs/.

### Phase 6 — pipeline + schedule
- `run.js` — wire the failure-safe order (DESIGN.md "Daily run order"). State commits last.
- `.github/workflows/daily.yml` — cron, secrets, run, commit vocab.json on success only,
  email on failure (Actions default).

### Phase 7 — first run + Spotify
- Run workflow once -> episode #1 live, feed reachable.
- Submit feed to Spotify (below).

## Spotify submission (one-time, manual — author does this)

Verified June 2026. Do this **after** episode #1 is live in the feed.

1. Go to **Spotify for Creators**, log in (or sign up).
2. **Add a show** -> **"I host somewhere else"** (RSS).
3. Paste feed URL: `https://<user>.github.io/<repo>/feed.xml`.
4. Spotify emails a **verification code** to the email in the feed -> enter it.
5. Fill **category, language (Thai/English), country**.
6. Review -> **Submit**.

Requirements (already handled in build): at least 1 published episode, MP3 96-320 kbps,
a real email in the feed.

Sources:
- https://support.spotify.com/us/creators/article/your-rss-feed/
- https://support.spotify.com/us/creators/article/finding-and-enabling-your-rss-feed/
- https://rss.com/blog/how-to-upload-a-podcast-to-spotify/

## Secrets (GitHub Actions, never committed)

- `OPENAI_API_KEY`
- `GOOGLE_TTS_KEY` — service-account JSON (author already has it)
