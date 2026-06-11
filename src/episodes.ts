import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { PATHS } from './config.js';
import type { Episode } from './types.js';

// The published-episode log. The feed is rebuilt from this every run, so it must hold
// every episode ever published (Spotify expects the full back catalogue in the feed).
// Committed alongside vocab.json.
const EPISODES_PATH = join(PATHS.root, 'data', 'episodes.json');

export async function loadEpisodes(path: string = EPISODES_PATH): Promise<Episode[]> {
  if (!existsSync(path)) return [];
  return JSON.parse(await readFile(path, 'utf8')) as Episode[];
}

export async function saveEpisodes(episodes: Episode[], path: string = EPISODES_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(episodes, null, 2)}\n`, 'utf8');
}

export function lastEpisodeNumber(episodes: Episode[]): number {
  return episodes.reduce((max, e) => Math.max(max, e.number), 0);
}

export function makeEpisode({
  number,
  title,
  description,
  pubDate,
  audioUrl,
  durationSeconds,
  fileSizeBytes,
}: Episode): Episode {
  return { number, title, description, pubDate, audioUrl, durationSeconds, fileSizeBytes };
}

export { EPISODES_PATH };
