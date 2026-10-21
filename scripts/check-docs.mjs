import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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

// SHA-256 fingerprints of actual CI-origin full-page and focused captures.
// Update these only with the source workflow evidence in docs/design-qa.md.
const images = [
  [
    'docs/assets/chemview-1366x768.png',
    1366,
    768,
    '0ea89b4194fd5d1143c6f1b2426d33ac43a07783a2b9749d523ce583fe50b795',
  ],
  [
    'docs/assets/chemview-dashboard.png',
    1440,
    900,
    'f905dca5a94c3c477b00dc8456f21b68b2b1e11a192d418adf8b2d302b845342',
  ],
  [
    'docs/assets/chemview-engineering-evidence.png',
    1440,
    900,
    'de7405f6f67df801df473275fede552254a16e8ad3bad69c152e4544660299cd',
  ],
  [
    'docs/assets/chemview-1920x1080.png',
    1920,
    1080,
    '669685f4c7f68eb588835ed074c5b3f33e5ce8a56d2125c32b7471237b381887',
  ],
];
for (const [name, targetWidth, minHeight, expectedSha256] of images) {
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
    bytes.readUInt32BE(20) < minHeight ||
    createHash('sha256').update(bytes).digest('hex') !== expectedSha256
  ) {
    violations.push(
      name + ': invalid PNG signature, dimensions or reviewed screenshot fingerprint',
    );
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
