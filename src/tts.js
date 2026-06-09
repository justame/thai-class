import { spawn } from 'node:child_process';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import textToSpeech from '@google-cloud/text-to-speech';
import { THAI_VOICE, THAI_LANGUAGE_CODE, PATHS, MIN_SECONDS, MAX_SECONDS } from './config.js';

// Each lesson chunk is synthesized separately, then the audio segments are stitched
// together. This is required, not optional: Thai sentences have no ending punctuation,
// so Google's sentence splitter treats a whole-lesson blob as one over-long sentence
// and rejects it. Per-chunk synthesis keeps every request short.
//
// v1 uses one Thai voice for every chunk (English parts sound Thai-accented — accepted).
// Because the chunks carry a `lang` tag, switching English chunks to an English voice
// later is a one-line change in voiceForChunk().
//
// NOTE: Google TTS MP3 output is fixed at ~32 kbps, below Spotify's 96 kbps minimum, so
// we synthesize LINEAR16 (WAV) and re-encode the stitched result to 128 kbps MP3.

const MP3_BITRATE = '128k';
const SAMPLE_RATE = 24000;
const PAUSE_SECONDS = 0.35; // gap added after each chunk so it sounds like a lesson

function voiceForChunk() {
  // v1: one voice for all chunks. Future: return en-US voice when chunk.lang === 'en'.
  return THAI_VOICE;
}

async function synthesizeChunk(client, chunk) {
  const [response] = await client.synthesizeSpeech({
    input: { text: chunk.text.trim() },
    voice: { languageCode: THAI_LANGUAGE_CODE, name: voiceForChunk(chunk) },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: SAMPLE_RATE },
  });
  return Buffer.from(response.audioContent);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

// ffmpeg prints "Duration: HH:MM:SS.xx" to stderr; parse the first one to seconds.
// Only call this on a single-input probe — with multiple inputs ffmpeg prints one
// Duration line per input, so the first would be an input, not the output.
function parseDuration(stderr) {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Measure a finished audio file by probing it alone (one input -> one Duration line).
// `ffmpeg -i` with no output exits non-zero by design, so capture stderr directly
// instead of treating the exit code as failure.
function getDurationSeconds(audioPath) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', audioPath]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', () => resolve(null));
    proc.on('close', () => resolve(parseDuration(stderr)));
  });
}

// Stitch WAV segments into one MP3, normalizing each and padding a short pause after it.
async function stitchToMp3(segmentPaths, mp3Path) {
  const inputs = segmentPaths.flatMap((p) => ['-i', p]);
  const filters = segmentPaths
    .map(
      (_, i) =>
        `[${i}:a]aresample=${SAMPLE_RATE},aformat=sample_fmts=s16:channel_layouts=mono,apad=pad_dur=${PAUSE_SECONDS}[a${i}]`,
    )
    .join(';');
  const concat = `${segmentPaths.map((_, i) => `[a${i}]`).join('')}concat=n=${segmentPaths.length}:v=0:a=1[out]`;

  await runFfmpeg([
    '-y',
    ...inputs,
    '-filter_complex', `${filters};${concat}`,
    '-map', '[out]',
    '-codec:a', 'libmp3lame',
    '-b:a', MP3_BITRATE,
    mp3Path,
  ]);
}

// Build the lesson MP3 from the chunks. Returns { mp3Path, durationSeconds }.
export async function makeAudio(chunks, { outPath } = {}) {
  await mkdir(PATHS.build, { recursive: true });
  const mp3Path = outPath ?? join(PATHS.build, 'lesson.mp3');
  const client = new textToSpeech.TextToSpeechClient();

  const segmentPaths = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const wav = await synthesizeChunk(client, chunks[i]);
    const segPath = join(PATHS.build, `seg-${i}.wav`);
    await writeFile(segPath, wav);
    segmentPaths.push(segPath);
  }

  await stitchToMp3(segmentPaths, mp3Path);
  const durationSeconds = await getDurationSeconds(mp3Path);
  await Promise.all(segmentPaths.map((p) => rm(p, { force: true })));

  if (durationSeconds != null && (durationSeconds < MIN_SECONDS || durationSeconds > MAX_SECONDS)) {
    console.warn(
      `WARN: lesson is ${durationSeconds.toFixed(1)}s, outside ${MIN_SECONDS}-${MAX_SECONDS}s target`,
    );
  }
  return { mp3Path, durationSeconds };
}

export { parseDuration };
