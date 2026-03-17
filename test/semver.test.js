'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const semver = require('../lib/semver');

describe('semver.parse', () => {
  it('parses a simple release version', () => {
    const r = semver.parse('1.2.3');
    assert.deepEqual(r, { major: 1, minor: 2, patch: 3, prerelease: [], buildmetadata: [] });
  });

  it('parses a version with pre-release', () => {
    const r = semver.parse('1.0.0-alpha.1');
    assert.deepEqual(r, { major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'], buildmetadata: [] });
  });

  it('parses a version with build metadata', () => {
    const r = semver.parse('1.0.0+build.20130313');
    assert.deepEqual(r, { major: 1, minor: 0, patch: 0, prerelease: [], buildmetadata: ['build', '20130313'] });
  });

  it('parses a full version with both pre-release and build metadata', () => {
    const r = semver.parse('1.0.0-beta.2+exp.sha.5114f85');
    assert.ok(r !== null);
    assert.deepEqual(r.prerelease, ['beta', '2']);
    assert.deepEqual(r.buildmetadata, ['exp', 'sha', '5114f85']);
  });

  it('parses the dev-bump format', () => {
    const r = semver.parse('1.2.3-dev.202603171950.abc1234');
    assert.ok(r !== null);
    assert.deepEqual(r.prerelease, ['dev', '202603171950', 'abc1234']);
  });

  it('returns null for invalid input', () => {
    assert.equal(semver.parse('not-semver'), null);
    assert.equal(semver.parse(''), null);
    assert.equal(semver.parse('01.2.3'), null);       // leading zero in major
    assert.equal(semver.parse('1.2.3-0123'), null);   // leading zero in numeric pre-release id
  });

  it('returns null for non-string input', () => {
    assert.equal(semver.parse(null), null);
    assert.equal(semver.parse(123), null);
  });
});

describe('semver.valid', () => {
  it('returns true for valid versions', () => {
    assert.ok(semver.valid('0.0.0'));
    assert.ok(semver.valid('1.2.3'));
    assert.ok(semver.valid('1.0.0-alpha'));
    assert.ok(semver.valid('1.0.0-alpha.1'));
    assert.ok(semver.valid('1.0.0-0'));
    assert.ok(semver.valid('1.0.0+build'));
    assert.ok(semver.valid('1.2.3-dev.202603171950.abc1234'));
  });

  it('returns false for invalid versions', () => {
    assert.ok(!semver.valid(''));
    assert.ok(!semver.valid('1.2'));
    assert.ok(!semver.valid('1.2.3.4'));
    assert.ok(!semver.valid('01.2.3'));
    assert.ok(!semver.valid('1.2.3-'));
    assert.ok(!semver.valid('1.2.3-.foo'));
  });
});

describe('semver.base', () => {
  it('extracts MAJOR.MINOR.PATCH from a release version', () => {
    assert.equal(semver.base('1.2.3'), '1.2.3');
  });

  it('strips pre-release identifiers', () => {
    assert.equal(semver.base('1.2.3-alpha.1'), '1.2.3');
    assert.equal(semver.base('1.0.0-dev.202603171950.abc1234'), '1.0.0');
  });

  it('strips build metadata', () => {
    assert.equal(semver.base('1.0.0+build.123'), '1.0.0');
  });

  it('returns null for invalid input', () => {
    assert.equal(semver.base('not-semver'), null);
  });
});

describe('semver.compare', () => {
  it('compares MAJOR.MINOR.PATCH', () => {
    assert.ok(semver.compare('2.0.0', '1.0.0') > 0);
    assert.ok(semver.compare('1.0.0', '2.0.0') < 0);
    assert.equal(semver.compare('1.0.0', '1.0.0'), 0);
    assert.ok(semver.compare('1.10.0', '1.9.0') > 0);
  });

  it('release > pre-release with same MAJOR.MINOR.PATCH', () => {
    assert.ok(semver.compare('1.0.0', '1.0.0-alpha') > 0);
    assert.ok(semver.compare('1.0.0-alpha', '1.0.0') < 0);
  });

  it('compares pre-release identifiers numerically', () => {
    assert.ok(semver.compare('1.0.0-alpha.11', '1.0.0-alpha.2') > 0);
  });

  it('compares pre-release identifiers lexically when alphanumeric', () => {
    assert.ok(semver.compare('1.0.0-alpha.beta', '1.0.0-alpha.alpha') > 0);
  });

  it('numeric identifiers < alphanumeric identifiers', () => {
    assert.ok(semver.compare('1.0.0-alpha', '1.0.0-1') > 0);
  });

  it('matches official SemVer ordering example', () => {
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      assert.ok(
        semver.lt(ordered[i], ordered[i + 1]),
        `Expected ${ordered[i]} < ${ordered[i + 1]}`
      );
    }
  });

  it('dev-bump versions sort chronologically via timestamp', () => {
    const v1 = '1.0.0-dev.202603171800.aaa0000';
    const v2 = '1.0.0-dev.202603171950.bbb0000';
    assert.ok(semver.lt(v1, v2));
    assert.ok(semver.gt(v2, v1));
  });

  it('throws for invalid versions', () => {
    assert.throws(() => semver.compare('1.0.0', 'bad'), /Invalid SemVer/);
  });
});

describe('semver.maxSatisfying', () => {
  it('returns null for empty array', () => {
    assert.equal(semver.maxSatisfying([]), null);
  });

  it('returns the greatest version', () => {
    assert.equal(semver.maxSatisfying(['1.0.0', '2.0.0', '1.5.0']), '2.0.0');
  });

  it('skips invalid versions', () => {
    assert.equal(semver.maxSatisfying(['bad', '1.0.0']), '1.0.0');
  });

  it('handles pre-release correctly (release > pre-release)', () => {
    assert.equal(
      semver.maxSatisfying(['1.0.0-alpha', '1.0.0', '0.9.0']),
      '1.0.0'
    );
  });
});
