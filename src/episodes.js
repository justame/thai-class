import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './config.js';

// The published-episode log. The feed is rebuilt from this every run, so it must hold
// every episode ever published (Spotify expects the full back catalogue in the feed).
// Committed alongside vocab.json.
const EPISODES_PATH = join(PATHS.root, 'data', 'episodes.json');

export async function loadEpisodes(path = EPISODES_PATH) {
  if (!existsSync(path)) return [];
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function saveEpisodes(episodes, path = EPISODES_PATH) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(episodes, null, 2)}\n`, 'utf8');
}

export function lastEpisodeNumber(episodes) {
  return episodes.reduce((max, e) => Math.max(max, e.number), 0);
}

export function makeEpisode({ number, title, description, pubDate, audioUrl, durationSeconds, fileSizeBytes }) {
  return { number, title, description, pubDate, audioUrl, durationSeconds, fileSizeBytes };
}

export { EPISODES_PATH };
