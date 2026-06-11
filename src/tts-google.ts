import textToSpeech from '@google-cloud/text-to-speech';
import {
  THAI_LANGUAGE_CODE,
  THAI_SPEAKING_RATE,
  ENGLISH_LANGUAGE_CODE,
  ENGLISH_SPEAKING_RATE,
  SPEAKER_VOICES,
  DEFAULT_SPEAKER,
  MP3_SAMPLE_RATE_HZ,
} from './config.js';
import type { Chunk, SynthesizedAudio } from './types.js';

// Google Cloud TTS provider. A chunk's voice = `<lang>-Chirp3-HD-<speaker's name>`, so a
// character keeps the same voice name across Thai and English (consistent gender/identity).
// Returns LINEAR16 (WAV) bytes — Google's MP3 is only ~32 kbps, below Spotify's minimum,
// so the shared stitcher re-encodes the final mix to 128 kbps.

let client: textToSpeech.TextToSpeechClient | undefined;

interface Voice {
  languageCode: string;
  name: string;
  rate: number;
}

function voiceForChunk(chunk: Chunk): Voice {
  const speakerName = SPEAKER_VOICES[chunk.speaker] ?? SPEAKER_VOICES[DEFAULT_SPEAKER];
  if (chunk.lang === 'en') {
    return { languageCode: ENGLISH_LANGUAGE_CODE, name: `${ENGLISH_LANGUAGE_CODE}-Chirp3-HD-${speakerName}`, rate: chunk.rate ?? ENGLISH_SPEAKING_RATE };
  }
  return { languageCode: THAI_LANGUAGE_CODE, name: `${THAI_LANGUAGE_CODE}-Chirp3-HD-${speakerName}`, rate: chunk.rate ?? THAI_SPEAKING_RATE };
}

export async function synthesizeChunk(chunk: Chunk): Promise<SynthesizedAudio> {
  if (!client) client = new textToSpeech.TextToSpeechClient();
  const voice = voiceForChunk(chunk);
  const [response] = await client.synthesizeSpeech({
    input: { text: chunk.text.trim() },
    voice: { languageCode: voice.languageCode, name: voice.name },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: MP3_SAMPLE_RATE_HZ, speakingRate: voice.rate },
  });
  if (!response.audioContent) throw new Error('Google TTS returned no audio');
  return { buffer: Buffer.from(response.audioContent), ext: 'wav' };
}
