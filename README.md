# Daily Thai

Makes a short Thai lesson every day and publishes it to Spotify automatically. Free.
Runs on GitHub Actions. See [DESIGN.md](DESIGN.md) for the decisions and [PLAN.md](PLAN.md)
for the build.

## How it works

```
GitHub Actions (daily cron)
  -> pick words (code: a few due reviews + a few new)
  -> write script (OpenAI, structured JSON chunks)
  -> make audio (Google TTS th-TH -> WAV -> ffmpeg MP3 128k)
  -> upload MP3 to GitHub Releases
  -> rebuild feed.xml on GitHub Pages
  -> commit advanced vocab + episode log   (only on success)
Spotify reads the feed on its own schedule and shows the new episode.
```

Spotify has no upload API; it pulls an RSS feed. GitHub hosts the audio and the feed
for free, so no paid podcast host is needed.

## Local development

```bash
npm install
npm test                 # 46 unit tests, no network/secrets needed
npm run seed             # build data/vocab.json from scripts/starter-words.csv
npm run cover            # generate the placeholder show cover
```

To run the full pipeline locally, copy `.env.example` to `.env` and fill it in
(needs OpenAI + Google keys), then `npm start`.

## One-time setup

1. **Create a public GitHub repo** and push this project. (Public is required for free
   Pages + so Spotify can fetch the feed and audio.)
2. **Enable GitHub Pages**: Settings -> Pages -> Source = `main` branch, `/docs` folder.
   Your feed will be at `https://<user>.github.io/<repo>/feed.xml`.
3. **Add Actions Secrets** (Settings -> Secrets and variables -> Actions -> Secrets):
   - `OPENAI_API_KEY`
   - `GOOGLE_TTS_KEY` — the full service-account JSON (paste the file contents)
   - `GITHUB_TOKEN` is built in; no need to add it.
4. **Add Actions Variables** (same page -> Variables):
   - `SITE_BASE_URL` = `https://<user>.github.io/<repo>`
   - `PODCAST_OWNER_EMAIL` = a real email you control (Spotify emails the verify code here)
5. **Seed the words**: run `npm run seed` and commit `data/vocab.json`. Replace the
   starter list with the full Anki deck CSV whenever you like (see `scripts/seed.js`).
6. **Run the workflow once**: Actions tab -> "Daily Thai lesson" -> Run workflow.
   This publishes episode #1 and writes `feed.xml`.
7. **Submit to Spotify** (after episode #1 is live):
   - Go to **Spotify for Creators**, log in.
   - **Add a show** -> **"I host somewhere else"** (RSS).
   - Paste `https://<user>.github.io/<repo>/feed.xml`.
   - Enter the **verification code** Spotify emails to `PODCAST_OWNER_EMAIL`.
   - Fill category / language / country -> Submit.

After that, every daily episode appears in Spotify on its own.

## Known limits

See DESIGN.md "Known limitations". In short: the LLM can produce subtly wrong Thai
(can't be auto-caught), the SRS is a fixed calendar ladder (no recall feedback exists),
and Spotify controls exactly when a new episode appears.

## Secrets

API keys live only in GitHub Actions Secrets, never in the repo. `.gitignore` blocks
`.env` and key files.
