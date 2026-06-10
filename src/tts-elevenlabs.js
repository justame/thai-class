import {
  ELEVEN_MODEL,
  ELEVEN_VOICES,
  DEFAULT_SPEAKER,
  ELEVEN_MIN_SPEED,
  ELEVEN_MAX_SPEED,
  THAI_SPEAKING_RATE,
  ENGLISH_SPEAKING_RATE,
} from './config.js';

// ElevenLabs TTS provider — more human, expressive delivery. Per-speaker voice, with the
// speaking speed driven by the chunk's rate. Returns MP3 bytes (the shared stitcher
// handles mixed wav/mp3 segments). Throws on any API error so the caller can fall back.

const API_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
const OUTPUT_FORMAT = 'mp3_44100_128'; // already in Spotify's 96-320 kbps range

function speedFor(chunk) {
  const rate = chunk.rate ?? (chunk.lang === 'en' ? ENGLISH_SPEAKING_RATE : THAI_SPEAKING_RATE);
  return Math.min(ELEVEN_MAX_SPEED, Math.max(ELEVEN_MIN_SPEED, rate));
}

export async function synthesizeChunk(chunk) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');
  const voiceId = ELEVEN_VOICES[chunk.speaker] ?? ELEVEN_VOICES[DEFAULT_SPEAKER];

  const res = await fetch(`${API_BASE}/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: chunk.text.trim(),
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: speedFor(chunk) },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, ext: 'mp3' };
}
