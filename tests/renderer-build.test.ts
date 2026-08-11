import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('renderer packaging', () => {
  it('uses relative assets so packaged file URLs resolve inside app.asar', () => {
    const config = readFileSync(new URL('../vite.renderer.config.mjs', import.meta.url), 'utf8');
    assert.match(config, /base:\s*['"]\.\/['"]/);
  });

  it('loads CommonJS main and preload bundles with unambiguous extensions', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { type: string; main: string };
    const mainConfig = readFileSync(new URL('../vite.main.config.mjs', import.meta.url), 'utf8');
    const preloadConfig = readFileSync(new URL('../vite.preload.config.mjs', import.meta.url), 'utf8');
    assert.equal(packageJson.type, 'module');
    assert.equal(packageJson.main, '.vite/build/main.cjs');
    assert.match(mainConfig, /entryFileNames:\s*['"]main\.cjs['"]/);
    assert.match(preloadConfig, /entryFileNames:\s*['"]preload\.cjs['"]/);
  });
});
