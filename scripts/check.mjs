import { build } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const node = process.execPath;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let outputDir;

function quoteWindowsArg(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? '"' + text.replaceAll('"', '\\"') + '"' : text;
}

function run(command, args, extraEnv) {
  const isWindows = process.platform === 'win32';
  const spawnCommand = isWindows ? process.env.ComSpec || 'cmd.exe' : command;
  const spawnArgs = isWindows
    ? ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')]
    : args;
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: repoRoot,
      env: { ...process.env, ...(extraEnv || {}) },
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(command + ' exited with ' + (signal || code)));
    });
  });
}

try {
  outputDir = await mkdtemp(join(tmpdir(), 'poker-table-agent-check-'));
  console.log('[check] building disposable output: ' + outputDir);
  await build({
    root: repoRoot,
    configFile: join(repoRoot, 'vite.config.js'),
    build: { outDir: outputDir, emptyOutDir: true },
  });
  await run(npm, ['run', 'test:contracts']);
  // [V7.8.0 修改] 浏览器冒烟打刚构建的生产产物（vite preview），覆盖 CSP 与内联产物的真实行为。
  await run(npm, ['run', 'test:e2e'], { E2E_OUT_DIR: outputDir });
  await run(node, ['scripts/build-output-contract.mjs', outputDir]);
  console.log('[check] all checks passed');
} finally {
  if (outputDir) await rm(outputDir, { recursive: true, force: true });
}
