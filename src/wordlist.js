import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './config.js';

// Downloads (and caches) the Thai frequency list and the PyThaiNLP dictionary, then
// returns real Thai words in frequency order: the frequency list filtered to words that
// also exist in the dictionary. This removes broken-encoding fake Thai and English
// contamination, but NOT function words — content-word filtering happens in curate.js.

const FREQ_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016/th/th_50k.txt';
const DICT_URL = 'https://raw.githubusercontent.com/PyThaiNLP/pythainlp/dev/pythainlp/corpus/words_th.txt';
const ONLY_THAI = /^[฀-๿]+$/;
const MIN_LENGTH = 2;

async function fetchText(url, cachePath) {
  if (existsSync(cachePath)) return readFile(cachePath, 'utf8');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const text = await res.text();
  await mkdir(PATHS.build, { recursive: true });
  await writeFile(cachePath, text, 'utf8');
  return text;
}

export async function getCandidateWords(max) {
  const freqText = await fetchText(FREQ_URL, join(PATHS.build, 'th_freq.txt'));
  const dictText = await fetchText(DICT_URL, join(PATHS.build, 'th_dict.txt'));
  const dict = new Set(dictText.split(/\r?\n/).map((s) => s.trim()));

  const seen = new Set();
  const words = [];
  for (const line of freqText.split(/\r?\n/)) {
    const word = line.split(' ')[0];
    if (!word || seen.has(word)) continue;
    if (!ONLY_THAI.test(word)) continue;
    if (word.length < MIN_LENGTH) continue;
    if (!dict.has(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= max) break;
  }
  return words;
}
