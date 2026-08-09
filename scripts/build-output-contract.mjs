import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(process.argv[2] || join(repoRoot, 'dist'));
const indexPath = join(outputDir, 'index.html');
const serviceWorkerPath = join(outputDir, 'sw.js');
const manifestPath = join(outputDir, 'manifest.webmanifest');
const allowedOutputFiles = [
  'apple-touch-icon.png',
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'manifest.webmanifest',
  'sw.js',
];

function fail(message) {
  throw new Error('[build-output-contract] ' + message);
}

async function listFiles(directory, prefix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), relativePath));
    else if (entry.isFile()) files.push(relativePath);
    else fail('dist contains an unsupported filesystem entry: ' + relativePath);
  }
  return files;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readPngSize(buffer, relativePath) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    fail(relativePath + ' is not a valid PNG signature');
  }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') fail(relativePath + ' has no leading IHDR chunk');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
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

const outputFiles = (await listFiles(outputDir, '')).sort();
const unexpectedFiles = outputFiles.filter((file) => !allowedOutputFiles.includes(file));
const missingFiles = allowedOutputFiles.filter((file) => !outputFiles.includes(file));
if (unexpectedFiles.length) fail('dist contains files outside the PWA whitelist: ' + unexpectedFiles.join(', '));
if (missingFiles.length) fail('dist is missing required PWA files: ' + missingFiles.join(', '));
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

const requiredHtmlLinks = [
  ['manifest', './manifest.webmanifest'],
  ['icon', './favicon.ico'],
  ['apple-touch-icon', './apple-touch-icon.png'],
];
for (const [rel, href] of requiredHtmlLinks) {
  const linkPattern = new RegExp('<link[^>]+rel=["\']' + rel + '["\'][^>]+href=["\']' + href.replaceAll('.', '\\.') + '["\']', 'i');
  if (!linkPattern.test(html)) fail('index.html is missing relative ' + rel + ' link to ' + href);
}
if (!/<link[^>]+rel=["']icon["'][^>]+href=["']\.\/favicon\.ico["'][^>]+type=["']image\/x-icon["']/i.test(html)) fail('favicon link must declare image/x-icon');
if (!/<meta[^>]+name=["']theme-color["'][^>]+content=["']#0f1714["']/i.test(html)) {
  fail('index.html is missing the PWA theme-color');
}

const expectedCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; manifest-src 'self' data:; worker-src 'self' blob:";
const cspMatch = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i);
if (!cspMatch || cspMatch[1] !== expectedCsp) fail('dist/index.html CSP does not match the required policy');

const expectedManifest = {
  id: './',
  name: "Underwood's Table Agent",
  short_name: '木下牌桌助手',
  description: '离线优先的扑克学习、计时与复盘工作台。',
  lang: 'zh-CN',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#101214',
  theme_color: '#0f1714',
};
const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => fail('manifest.webmanifest is unreadable')));
for (const [key, value] of Object.entries(expectedManifest)) {
  if (manifest[key] !== value) fail('manifest field ' + key + ' does not match the PWA contract');
}
const expectedIcons = [
  { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];
if (JSON.stringify(manifest.icons) !== JSON.stringify(expectedIcons)) fail('manifest icons do not match the exact PWA icon contract');

const expectedPngSizes = {
  'apple-touch-icon.png': { width: 180, height: 180 },
  'icons/icon-192.png': { width: 192, height: 192 },
  'icons/icon-512.png': { width: 512, height: 512 },
  'icons/icon-maskable-512.png': { width: 512, height: 512 },
};
const pngEvidence = {};
for (const [relativePath, expectedSize] of Object.entries(expectedPngSizes)) {
  const buffer = await readFile(join(outputDir, ...relativePath.split('/')));
  const actualSize = readPngSize(buffer, relativePath);
  if (actualSize.width !== expectedSize.width || actualSize.height !== expectedSize.height) {
    fail(relativePath + ' dimensions do not match ' + expectedSize.width + 'x' + expectedSize.height);
  }
  pngEvidence[relativePath] = { ...actualSize, bytes: buffer.length, sha256: sha256(buffer) };
}

const favicon = await readFile(join(outputDir, 'favicon.ico'));
if (!favicon.length) fail('favicon.ico is empty');
const sourceFavicon = await readFile(join(repoRoot, 'public', 'favicon.ico'));
if (sha256(favicon) !== sha256(sourceFavicon)) fail('dist/favicon.ico differs from public/favicon.ico');

const viteConfig = await readFile(join(repoRoot, 'vite.config.js'), 'utf8');
if (!/base:\s*['"]\.\/['"]/.test(viteConfig)) fail('vite.config.js must use a relative base for file:// support');
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
const requiredWorkerFacts = [
  "self.addEventListener('install'",
  "self.addEventListener('activate'",
  "self.addEventListener('fetch'",
  "self.addEventListener('notificationclick'",
  'caches.open(CACHE_NAME)',
  "request.method !== 'GET'",
  'requestUrl.origin !== self.location.origin',
  "request.mode === 'navigate'",
  "caches.match('./index.html')",
  "key.indexOf('poker-v') === 0",
  'self.clients.claim()',
  'self.registration.scope',
];
for (const fact of requiredWorkerFacts) {
  if (!serviceWorker.includes(fact)) fail('dist/sw.js is missing required behavior: ' + fact);
}
for (const relativePath of allowedOutputFiles.filter((file) => !['sw.js'].includes(file))) {
  if (relativePath === 'index.html' && serviceWorker.includes("'./index.html'")) continue;
  if (relativePath !== 'index.html' && serviceWorker.includes("'./" + relativePath + "'")) continue;
  fail('dist/sw.js precache is missing ./' + relativePath);
}

console.log(JSON.stringify({
  outputDir,
  version: expectedVersion,
  indexBytes: indexStat.size,
  indexSha256: sha256(Buffer.from(html)),
  serviceWorkerBytes: serviceWorkerStat.size,
  outputFiles,
  manifest: { id: manifest.id, name: manifest.name, shortName: manifest.short_name, startUrl: manifest.start_url, display: manifest.display, icons: manifest.icons },
  pngEvidence,
  favicon: { bytes: favicon.length, sha256: sha256(favicon) },
}, null, 2));
