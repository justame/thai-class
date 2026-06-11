// ffmpeg-static ships no types. Its default export is the absolute path to the bundled
// ffmpeg binary (or null if the platform is unsupported).
declare module 'ffmpeg-static' {
  const path: string;
  export default path;
}
