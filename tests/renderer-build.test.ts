import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('renderer packaging', () => {
  it('uses relative assets so packaged file URLs resolve inside app.asar', () => {
    const config = readFileSync(new URL('../vite.renderer.config.mjs', import.meta.url), 'utf8');
    assert.match(config, /base:\s*['"]\.\/['"]/);
  });
});
