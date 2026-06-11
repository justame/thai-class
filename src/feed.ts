import { writeFile, mkdir } from 'node:fs/promises';
import { Podcast } from 'podcast';
import { SHOW, PATHS } from './config.js';
import type { Episode } from './types.js';

// Build the podcast RSS from the full episode log. Spotify reads this feed on its own
// schedule; every required iTunes tag (image, category, explicit, owner email,
// enclosure, duration) is emitted by the `podcast` package.

interface FeedUrls {
  feedUrl: string;
  siteUrl: string;
  imageUrl: string;
}

function feedUrls(siteBaseUrl: string): FeedUrls {
  const base = siteBaseUrl.replace(/\/$/, '');
  return { feedUrl: `${base}/feed.xml`, siteUrl: base, imageUrl: `${base}/cover.jpg` };
}

export interface FeedOptions {
  siteBaseUrl: string;
  ownerEmail: string;
}

export function buildFeedXml(episodes: Episode[], { siteBaseUrl, ownerEmail }: FeedOptions): string {
  const { feedUrl, siteUrl, imageUrl } = feedUrls(siteBaseUrl);
  const feed = new Podcast({
    title: SHOW.title,
    description: SHOW.description,
    feedUrl,
    siteUrl,
    imageUrl,
    author: SHOW.author,
    language: SHOW.language,
    itunesAuthor: SHOW.author,
    itunesExplicit: false,
    itunesOwner: { name: SHOW.author, email: ownerEmail },
    itunesImage: imageUrl,
    itunesCategory: [{ text: SHOW.categoryName, subcats: [{ text: SHOW.categorySub }] }],
  });

  // Newest first.
  const ordered = [...episodes].sort((a, b) => b.number - a.number);
  for (const ep of ordered) {
    feed.addItem({
      title: ep.title,
      description: ep.description,
      url: `${siteUrl}#ep-${ep.number}`,
      guid: `daily-thai-${ep.number}`,
      date: new Date(ep.pubDate),
      enclosure: { url: ep.audioUrl, type: 'audio/mpeg', size: ep.fileSizeBytes },
      itunesDuration: Math.round(ep.durationSeconds ?? 0),
      itunesExplicit: false,
    });
  }
  return feed.buildXml();
}

export async function writeFeed(episodes: Episode[], opts: FeedOptions): Promise<string> {
  const xml = buildFeedXml(episodes, opts);
  await mkdir(PATHS.docs, { recursive: true });
  await writeFile(PATHS.feed, xml, 'utf8');
  return PATHS.feed;
}
