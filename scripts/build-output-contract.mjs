import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
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

const outputEntries = await readdir(outputDir).catch(() => []);
const unexpectedEntries = outputEntries.filter((entry) => !['index.html', 'sw.js'].includes(entry));
if (unexpectedEntries.length) {
  fail('dist must contain only index.html and sw.js; found ' + unexpectedEntries.join(', '));
}
if (!/^<!doctype html>/i.test(html.trim())) fail('dist/index.html is not a complete HTML document');

const outputVersion = html.match(/VERSION\s*[:=]\s*["']([^"']+)["']/);
if (!outputVersion || outputVersion[1] !== expectedVersion) {
  fail('output version does not match source VERSION (' + expectedVersion + ')');
}
if (/<script[^>]+\bsrc=/.test(html)) fail('index.html still references an external script file');
if (/\b(?:src|href)=["']\/src\//.test(html)) fail('index.html still references source files');
if (/\b(?:unpkg|jsdelivr|cdnjs)\./i.test(html)) fail('index.html contains a CDN reference');
if (/<(?:script|link|img|iframe)\b[^>]+(?:src|href)=["']https?:\/\//i.test(html)) {
  fail('index.html contains a remote runtime resource');
}
if (/url\(\s*https?:\/\//i.test(html)) fail('index.html contains a remote CSS resource');
if (/(?:src|href)=["']\/(?!\/)/i.test(html)) fail('index.html contains an absolute runtime path that breaks file://');

const expectedCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; manifest-src 'self' data:; worker-src 'self' blob:";
const cspMatch = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i);
if (!cspMatch || cspMatch[1] !== expectedCsp) fail('dist/index.html CSP does not match the required policy');

const viteConfig = await readFile(join(repoRoot, 'vite.config.js'), 'utf8');
if (!/base:\s*['"]\.\/["']/.test(viteConfig)) fail('vite.config.js must use a relative base for file:// support');
const appSource = await readFile(join(repoRoot, 'src', 'modules', 'app.js'), 'utf8');
if (!appSource.includes("window.location.protocol === 'https:'")) {
  fail('Service Worker registration is not explicitly limited to HTTPS');
}

const netlifyConfig = await readFile(join(repoRoot, 'netlify.toml'), 'utf8');
if (!/command\s*=\s*["']npm run build["']/.test(netlifyConfig) || !/publish\s*=\s*["']dist["']/.test(netlifyConfig)) {
  fail('netlify.toml must build with npm run build and publish dist');
}
const pagesWorkflow = await readFile(join(repoRoot, '.github', 'workflows', 'static.yml'), 'utf8');
for (const requiredStep of ['actions/checkout@v4', 'actions/setup-node@v4', 'run: npm ci', 'run: npm run build', "path: 'dist'"]) {
  if (!pagesWorkflow.includes(requiredStep)) fail('GitHub Pages workflow is missing: ' + requiredStep);
}

const serviceWorkerStat = await stat(serviceWorkerPath).catch(() => null);
if (!serviceWorkerStat || serviceWorkerStat.size === 0) fail('dist/sw.js is missing');
const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
if (!serviceWorker.includes("self.addEventListener('install'")) fail('dist/sw.js has no install handler');
if (!serviceWorker.includes('caches.open')) fail('dist/sw.js has no cache initialization');

const hash = createHash('sha256').update(html).digest('hex');
console.log(JSON.stringify({
  outputDir,
  version: expectedVersion,
  indexBytes: indexStat.size,
  indexSha256: hash,
  serviceWorkerBytes: serviceWorkerStat.size,
  outputEntries,
}, null, 2));
