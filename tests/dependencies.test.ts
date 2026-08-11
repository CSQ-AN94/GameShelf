import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('dependency reproducibility', () => {
  it('pins every direct dependency to the exact version recorded in the lockfile', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')) as { packages: Record<string, { version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }> };
    const declared = { ...packageJson.dependencies, ...packageJson.devDependencies };
    assert.deepEqual({ ...lock.packages['']?.dependencies, ...lock.packages['']?.devDependencies }, declared);
    for (const [name, version] of Object.entries(declared)) {
      assert.match(version, /^\d+\.\d+\.\d+(?:[-+].+)?$/);
      assert.equal(lock.packages[`node_modules/${name}`]?.version, version);
    }
  });
});
