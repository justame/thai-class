import { spawn } from 'node:child_process';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { DEFAULT_PAUSE_SECONDS, MIN_PAUSE_SECONDS, MAX_PAUSE_SECONDS, PATHS, MIN_SECONDS, MAX_SECONDS, TTS_PROVIDER } from './config.js';
import * as google from './tts-google.js';
import * as elevenlabs from './tts-elevenlabs.js';
import { checkNoMixedScript } from './script-check.js';

// Each lesson chunk is synthesized separately, then the audio segments are stitched
// together. This is required, not optional: Thai sentences have no ending punctuation,
// so a whole-lesson blob is rejected as one over-long sentence. Per-chunk synthesis also
// lets each speaker have a distinct voice and each line its own pause.
//
// The voice engine is pluggable (config TTS_PROVIDER). ElevenLabs is more human; if it
// errors (e.g. quota), we fall back to Google automatically so a lesson still ships.
//
// NOTE: providers return different formats (Google WAV, ElevenLabs MP3). The stitcher
// normalizes every segment, so mixing is fine; the final mix is 128 kbps MP3 for Spotify.

const MP3_BITRATE = '128k';
const SAMPLE_RATE = 24000;

const PROVIDERS = { google, elevenlabs };

// Synthesize one chunk with the chosen provider; fall back to Google on any error.
// Once the primary fails in a run, skip it for the rest (no point retrying a dead quota).
async function synthesizeChunk(chunk, state) {
  const primary = PROVIDERS[TTS_PROVIDER] ?? google;
  if (primary === google || state.primaryDead) return google.synthesizeChunk(chunk);
  try {
    return await primary.synthesizeChunk(chunk);
  } catch (err) {
    state.primaryDead = true;
    console.warn(`WARN: ${TTS_PROVIDER} TTS failed (${err.message}); using Google for the rest of this lesson`);
    return google.synthesizeChunk(chunk);
  }
}

// LLM-provided pause, clamped so a bad value can't make a giant gap or none at all.
function pauseFor(chunk) {
  const p = typeof chunk.pauseAfter === 'number' ? chunk.pauseAfter : DEFAULT_PAUSE_SECONDS;
  return Math.min(MAX_PAUSE_SECONDS, Math.max(MIN_PAUSE_SECONDS, p));
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

// Stitch WAV segments into one MP3, normalizing each and padding its own pause after it.
async function stitchToMp3(segmentPaths, pauses, mp3Path) {
  const inputs = segmentPaths.flatMap((p) => ['-i', p]);
  const filters = segmentPaths
    .map(
      (_, i) =>
        `[${i}:a]aresample=${SAMPLE_RATE},aformat=sample_fmts=s16:channel_layouts=mono,apad=pad_dur=${pauses[i]}[a${i}]`,
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
  // Final gate, covering hand-edited transcripts: a line mixing Thai and Latin would be
  // voiced as garbage, so refuse it here rather than spend TTS on broken audio.
  checkNoMixedScript(chunks);
  await mkdir(PATHS.build, { recursive: true });
  const mp3Path = outPath ?? join(PATHS.build, 'lesson.mp3');

  const segmentPaths = [];
  const pauses = [];
  const ttsState = { primaryDead: false };
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    // A cue is a pre-made sound file, not synthesized speech.
    if (chunk.speaker === 'cue') {
      const cuePath = join(PATHS.cues, `${chunk.text}.wav`);
      if (!existsSync(cuePath)) {
        console.warn(`WARN: unknown cue "${chunk.text}", skipping`);
        continue;
      }
      segmentPaths.push(cuePath);
      pauses.push(pauseFor(chunk));
      continue;
    }
    const { buffer, ext } = await synthesizeChunk(chunk, ttsState);
    const segPath = join(PATHS.build, `seg-${i}.${ext}`);
    await writeFile(segPath, buffer);
    segmentPaths.push(segPath);
    pauses.push(pauseFor(chunk));
  }

  await stitchToMp3(segmentPaths, pauses, mp3Path);
  const durationSeconds = await getDurationSeconds(mp3Path);
  // Only remove generated segments under build/ — never the shared cue assets.
  await Promise.all(
    segmentPaths.filter((p) => p.startsWith(PATHS.build)).map((p) => rm(p, { force: true })),
  );

  if (durationSeconds != null && (durationSeconds < MIN_SECONDS || durationSeconds > MAX_SECONDS)) {
    console.warn(
      `WARN: lesson is ${durationSeconds.toFixed(1)}s, outside ${MIN_SECONDS}-${MAX_SECONDS}s target`,
    );
  }
  return { mp3Path, durationSeconds };
}

export { parseDuration };
