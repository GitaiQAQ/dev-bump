'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { computeInc, readPackageJson, resolveBaseVersion } = require('../lib/version');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory, write a package.json into it, and return the
 * directory path + a cleanup function.
 */
function makeTempPkg(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-bump-test-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(content), 'utf8');
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

// ---------------------------------------------------------------------------
// computeInc
// ---------------------------------------------------------------------------

describe('computeInc', () => {
  it('returns 0 when there are no matching versions', () => {
    assert.equal(computeInc([], '1.2.3', 'dev'), 0);
    assert.equal(computeInc(['2.0.0', '1.0.0-alpha.0'], '1.2.3', 'dev'), 0);
  });

  it('returns 1 when only inc=0 exists', () => {
    assert.equal(computeInc(['1.2.3-dev.0'], '1.2.3', 'dev'), 1);
  });

  it('finds the maximum numeric tail across multiple matching versions', () => {
    const versions = [
      '1.2.3-dev.0',
      '1.2.3-dev.1',
      '1.2.3-dev.2',
    ];
    assert.equal(computeInc(versions, '1.2.3', 'dev'), 3);
  });

  it('correctly skips versions for a different preid', () => {
    const versions = ['1.2.3-alpha.5', '1.2.3-dev.2'];
    assert.equal(computeInc(versions, '1.2.3', 'alpha'), 6);
    assert.equal(computeInc(versions, '1.2.3', 'dev'), 3);
  });

  it('handles non-numeric tails gracefully (returns 0)', () => {
    // No numeric tail found → maxInc stays -1 → returns 0
    assert.equal(computeInc(['1.2.3-dev.abc1234'], '1.2.3', 'dev'), 0);
  });

  it('handles multi-segment pre-release with numeric tail', () => {
    // "1.2.3-dev.202603171950.abc1234.3" — rightmost numeric segment is "3"
    // Note: "202603171950" is also numeric; the rightmost numeric wins.
    // Since the loop goes right-to-left and "3" is rightmost: inc = 4
    const versions = ['1.2.3-dev.202603171950.abc1234.3'];
    assert.equal(computeInc(versions, '1.2.3', 'dev'), 4);
  });
});

// ---------------------------------------------------------------------------
// readPackageJson
// ---------------------------------------------------------------------------

describe('readPackageJson', () => {
  it('reads and parses package.json successfully', () => {
    const { dir, cleanup } = makeTempPkg({ name: 'my-pkg', version: '1.2.3' });
    try {
      const pkg = readPackageJson(dir);
      assert.equal(pkg.name, 'my-pkg');
      assert.equal(pkg.version, '1.2.3');
    } finally {
      cleanup();
    }
  });

  it('throws when package.json is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-bump-nofile-'));
    try {
      assert.throws(
        () => readPackageJson(dir),
        /No package\.json found/
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when version field is absent', () => {
    const { dir, cleanup } = makeTempPkg({ name: 'no-version' });
    try {
      assert.throws(
        () => readPackageJson(dir),
        /"version" field missing/
      );
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// resolveBaseVersion
// ---------------------------------------------------------------------------

describe('resolveBaseVersion', () => {
  it('uses --base option and strips pre-release', async () => {
    const pkg = { name: 'my-pkg', version: '1.0.0' };
    const opts = { base: '2.0.0-alpha.1', fromRegistry: false };
    const result = await resolveBaseVersion(opts, pkg);
    assert.equal(result, '2.0.0');
  });

  it('uses explicit --base=MAJOR.MINOR.PATCH directly', async () => {
    const pkg = { name: 'my-pkg', version: '1.0.0' };
    const opts = { base: '3.1.4', fromRegistry: false };
    assert.equal(await resolveBaseVersion(opts, pkg), '3.1.4');
  });

  it('falls back to local package.json version', async () => {
    const pkg = { name: 'my-pkg', version: '1.5.2-beta.3' };
    const opts = { base: null, fromRegistry: false };
    const result = await resolveBaseVersion(opts, pkg);
    assert.equal(result, '1.5.2');
  });

  it('throws for an invalid --base value', async () => {
    const pkg = { name: 'my-pkg', version: '1.0.0' };
    const opts = { base: 'not-semver', fromRegistry: false };
    await assert.rejects(
      () => resolveBaseVersion(opts, pkg),
      /Invalid base version/
    );
  });

  it('throws for --from-registry without package name', async () => {
    const pkg = { version: '1.0.0' }; // no name
    const opts = { base: null, fromRegistry: true, tag: 'latest', registry: 'https://registry.npmjs.org' };
    await assert.rejects(
      () => resolveBaseVersion(opts, pkg),
      /requires the "name" field/
    );
  });
});
