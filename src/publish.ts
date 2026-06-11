import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { Octokit } from '@octokit/rest';

// Audio lives in GitHub Releases (one release per episode), not in git, so the repo
// never bloats. The feed's <enclosure> points at the release asset's public URL.

export interface Repo {
  owner: string;
  repo: string;
}

export function parseRepo(ownerRepo: string): Repo {
  const [owner, repo] = ownerRepo.split('/');
  if (!owner || !repo) throw new Error(`GITHUB_REPO must be "owner/repo", got "${ownerRepo}"`);
  return { owner, repo };
}

async function getOrCreateRelease(octokit: Octokit, owner: string, repo: string, tag: string, name: string) {
  try {
    const { data } = await octokit.repos.getReleaseByTag({ owner, repo, tag });
    return data;
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err;
    const { data } = await octokit.repos.createRelease({ owner, repo, tag_name: tag, name });
    return data;
  }
}

export interface UploadOptions {
  token: string;
  repo: string;
}

export interface UploadResult {
  audioUrl: string;
  fileSizeBytes: number;
  fileName: string;
}

// Upload the MP3 and return its public URL + size for the feed enclosure.
export async function uploadAudio(
  mp3Path: string,
  episodeNumber: number,
  { token, repo }: UploadOptions,
): Promise<UploadResult> {
  const octokit = new Octokit({ auth: token });
  const { owner, repo: repoName } = parseRepo(repo);
  const tag = `ep-${episodeNumber}`;
  const release = await getOrCreateRelease(octokit, owner, repoName, tag, `Daily Thai #${episodeNumber}`);

  const data = await readFile(mp3Path);
  const fileName = `daily-thai-${episodeNumber}.mp3`;
  const asset = await octokit.repos.uploadReleaseAsset({
    owner,
    repo: repoName,
    release_id: release.id,
    name: fileName,
    // The Octokit types declare `data: string`, but the runtime accepts a Buffer for
    // binary uploads (which is required for an MP3). Cast to satisfy the type.
    data: data as unknown as string,
    headers: { 'content-type': 'audio/mpeg', 'content-length': data.length },
  });

  const { size } = await stat(mp3Path);
  return { audioUrl: asset.data.browser_download_url, fileSizeBytes: size, fileName };
}

export { basename };
