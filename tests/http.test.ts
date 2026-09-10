import assert from 'node:assert/strict';
import test from 'node:test';

const run = async () => {
  const { spawn } = await import('node:child_process');
  const child = spawn('node', ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '4321' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await fetch('http://127.0.0.1:4321/health');
        if (response.ok) {
          const body = await response.json() as { status?: string; service?: string };
          assert.equal(body.status, 'ok');
          assert.equal(body.service, 'freshcart-api');
          return;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`FreshCart server did not become healthy. Output: ${output}`);
  } finally {
    child.kill('SIGTERM');
  }
};

test('server exposes a healthy process endpoint', { timeout: 15000 }, run);
