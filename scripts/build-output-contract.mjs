import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(process.argv[2] || join(repoRoot, 'dist'));
const indexPath = join(outputDir, 'index.html');
const serviceWorkerPath = join(outputDir, 'sw.js');

function fail(message) {
  throw new Error('[build-output-contract] ' + message);
}

const sourceConstants = await readFile(join(repoRoot, 'src', 'constants.js'), 'utf8');
const versionMatch = sourceConstants.match(/VERSION:\s*['"]([^'"]+)['"]/);
if (!versionMatch) fail('src/constants.js has no readable VERSION');
const expectedVersion = versionMatch[1];

const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
if (packageJson.version !== expectedVersion) {
  fail('package.json version does not match source VERSION (' + expectedVersion + ')');
}

const packageLock = JSON.parse(await readFile(join(repoRoot, 'package-lock.json'), 'utf8'));
if (packageLock.version !== expectedVersion || packageLock.packages?.['']?.version !== expectedVersion) {
  fail('package-lock.json version does not match source VERSION (' + expectedVersion + ')');
}

const indexStat = await stat(indexPath).catch(() => null);
if (!indexStat || indexStat.size < 100000) fail('dist/index.html is missing or unexpectedly small');
const html = await readFile(indexPath, 'utf8');

const outputVersion = html.match(/VERSION\s*[:=]\s*["']([^"']+)["']/);
if (!outputVersion || outputVersion[1] !== expectedVersion) {
  fail('output version does not match source VERSION (' + expectedVersion + ')');
}
if (/<script[^>]+\bsrc=/.test(html)) fail('index.html still references an external script file');
if (/\b(?:src|href)=["']\/src\//.test(html)) fail('index.html still references source files');
if (/\b(?:unpkg|jsdelivr|cdnjs)\./i.test(html)) fail('index.html contains a CDN reference');

const serviceWorkerStat = await stat(serviceWorkerPath).catch(() => null);
if (!serviceWorkerStat || serviceWorkerStat.size === 0) fail('dist/sw.js is missing');

const hash = createHash('sha256').update(html).digest('hex');
console.log(JSON.stringify({
  outputDir,
  version: expectedVersion,
  indexBytes: indexStat.size,
  indexSha256: hash,
  serviceWorkerBytes: serviceWorkerStat.size,
}, null, 2));
