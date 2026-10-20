import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** Detect broken in-repo Markdown links and stale portfolio screenshots. */
const repo = process.cwd();
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const markdown = tracked.filter((name) => name.endsWith('.md'));
const violations = [];

for (const file of markdown) {
  const contents = readFileSync(path.join(repo, file), 'utf8');
  const links = contents.matchAll(/!?\[[^\]]*\]\((<?[^)\s]+>?)(?:\s+["'][^"']*["'])?\)/g);
  for (const [, rawLink] of links) {
    const link = rawLink.replace(/^<|>$/g, '').split('#')[0].split('?')[0];
    if (!link || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link)) continue;
    let decoded = link;
    try {
      decoded = decodeURIComponent(link);
    } catch {
      violations.push(file + ': invalid URL encoding: ' + link);
      continue;
    }
    const absolute = path.resolve(repo, path.dirname(file), decoded);
    if (absolute !== repo && !absolute.startsWith(repo + path.sep)) {
      violations.push(file + ': link leaves repository: ' + link);
    } else if (!existsSync(absolute)) {
      violations.push(file + ': missing linked path: ' + link);
    }
  }
}

const images = [
  ['docs/assets/chemview-1366x768.png', 1366, 768],
  ['docs/assets/chemview-dashboard.png', 1440, 900],
  ['docs/assets/chemview-1920x1080.png', 1920, 1080],
];
for (const [name, targetWidth, minHeight] of images) {
  const filename = path.join(repo, name);
  if (!existsSync(filename)) {
    violations.push('Missing committed screenshot ' + name);
    continue;
  }
  const bytes = readFileSync(filename);
  if (
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.length < 24 ||
    bytes.readUInt32BE(16) !== targetWidth ||
    bytes.readUInt32BE(20) < minHeight
  ) {
    violations.push(name + ': invalid PNG signature or capture dimensions');
  }
}

for (const redundant of ['docs/blueprint.md', 'docs/scientific-model.md']) {
  if (existsSync(path.join(repo, redundant))) {
    violations.push('Redundant legacy document must be consolidated: ' + redundant);
  }
}

if (violations.length) {
  for (const item of violations) console.error('DOC CHECK: ' + item);
  process.exitCode = 1;
} else {
  console.log(
    'Verified ' +
      markdown.length +
      ' Markdown files and ' +
      images.length +
      ' committed HMI screenshots.',
  );
}
