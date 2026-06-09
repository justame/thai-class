// Title and description are built from data, not an LLM call — they are just the
// chosen words plus the recap, which we already have.

export function buildTitle(words, episodeNumber) {
  const thaiList = words.map((w) => w.thai).join(', ');
  return `Daily Thai #${episodeNumber} — ${thaiList}`;
}

export function buildDescription(reviews, news) {
  const lines = ['Today:', ''];
  if (news.length) {
    lines.push('New words:');
    for (const w of news) lines.push(`  ${w.thai} = ${w.english}`);
    lines.push('');
  }
  if (reviews.length) {
    lines.push('Review words:');
    for (const w of reviews) lines.push(`  ${w.thai} = ${w.english}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

// Episode number = how many episodes already exist, plus one. Stored alongside vocab
// so it never depends on Spotify or the feed being reachable.
export function nextEpisodeNumber(lastEpisodeNumber) {
  return (lastEpisodeNumber ?? 0) + 1;
}
