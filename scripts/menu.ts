import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { PATHS } from '../src/config.js';
import { htmlPath, audioPath, listEpisodeNumbers, latestTranscriptNumber } from '../src/transcript.js';
import { startServer, openUrl, type RunningServer } from '../src/serve.js';

// Interactive menu — `npm run menu`. Pick an action instead of remembering script names.
// Pages are opened through a local web server (not file://) so the audio actually plays.

const MENU = `
Daily Thai — what do you want to do?

  1) New lesson      (make text, voice it, open the page)
  2) Text only       (write the transcript so you can edit it)
  3) Voice audio     (turn an episode's transcript into mp3)
  4) Open a page     (open an episode's reading page)
  5) List episodes
  6) Quit
`;

// Run a compiled script and wait for it to finish, streaming its output to the screen.
function runScript(file: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('node', [join('dist', 'scripts', file), ...args], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('close', (code) => resolve(code ?? 0));
  });
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  let server: RunningServer | null = null;

  // Open an episode page through the shared local server, starting it on first use.
  async function openEpisode(n: number): Promise<void> {
    if (!existsSync(htmlPath(n))) {
      stdout.write(`No page for episode ${n} yet.\n`);
      return;
    }
    if (!server) server = await startServer(PATHS.episodes);
    const url = `http://127.0.0.1:${server.port}/ep-${n}/index.html`;
    stdout.write(`Opening ${url}\n`);
    openUrl(url);
  }

  try {
    for (;;) {
      stdout.write(MENU);
      const choice = (await rl.question('> ')).trim();

      if (choice === '1' || choice === '2') {
        const word = (await rl.question('Force a Thai word? (blank = scheduled) ')).trim();
        const args = word ? [`--word=${word}`] : [];
        if ((await runScript('text.js', args)) !== 0) continue;
        if (choice === '1' && (await runScript('audio.js')) !== 0) continue;
        await openEpisode(latestTranscriptNumber());
      } else if (choice === '3') {
        const n = (await rl.question('Episode number to voice (blank = newest): ')).trim();
        if ((await runScript('audio.js', n ? [n] : [])) !== 0) continue;
        await openEpisode(n ? Number(n) : latestTranscriptNumber());
      } else if (choice === '4') {
        const nums = listEpisodeNumbers();
        if (!nums.length) {
          stdout.write('No episodes yet. Make one first (option 1 or 2).\n');
          continue;
        }
        stdout.write(`Episodes: ${nums.join(', ')}\n`);
        await openEpisode(Number((await rl.question('Open which episode? ')).trim()));
      } else if (choice === '5') {
        const nums = listEpisodeNumbers();
        stdout.write(nums.length ? 'Episodes:\n' : 'No episodes yet.\n');
        for (const n of nums) {
          stdout.write(`  ep-${n}${existsSync(audioPath(n)) ? '' : '  (no audio yet)'}\n`);
        }
      } else if (choice === '6' || choice.toLowerCase() === 'q') {
        break;
      } else {
        stdout.write('Pick 1-6.\n');
      }
    }
  } finally {
    rl.close();
    (server as RunningServer | null)?.close();
  }
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
