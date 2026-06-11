// Shared domain types for the Thai lesson pipeline.

// A vocabulary record. Stored as JSON in data/vocab.json and hand-editable. `english`
// may be empty until the word is first used and translated lazily (see translate.ts).
// `obvious` is absent until the curate pass tags it (see curate.ts).
export interface Word {
  id: string;
  thai: string;
  english: string;
  category: string;
  dateAdded: string;
  timesTaught: number;
  lastSeen: string | null;
  intervalIndex: number;
  nextReviewDate: string | null;
  exampleSentences: string[];
  obvious?: boolean;
}

export type Lang = 'th' | 'en';

// "cue" is not a person — it marks a short audio cue (the chunk's text holds the cue name).
export type Speaker = 'teacher' | 'student1' | 'student2' | 'cue';

// One line of a lesson: a single speaker, a single language. `rate` is the optional
// speaking speed; when absent the language default applies.
export interface Chunk {
  speaker: Speaker;
  lang: Lang;
  text: string;
  pauseAfter: number;
  rate?: number;
}

// One synthesized audio segment from a TTS provider. Providers return different formats
// (Google WAV, ElevenLabs MP3); the stitcher normalizes them, so `ext` records which.
export interface SynthesizedAudio {
  buffer: Buffer;
  ext: string;
}

// A published-episode record. Stored in data/episodes.json and used to rebuild the feed.
export interface Episode {
  number: number;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  durationSeconds: number | null;
  fileSizeBytes: number;
}

// How lesson types are chosen per episode (data/lesson-plan.json). All fields are
// optional because the file is hand-editable and chooseLessonType falls back to a default.
export interface LessonPlan {
  mode?: string;
  type?: string;
  rotation?: string[];
}
