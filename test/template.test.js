'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  render,
  isValidIdentifier,
  sanitizeIdentifier,
  timestamp,
  shortTimestamp,
  dateStamp,
} = require('../lib/template');

// Fixed date used across tests for deterministic output
const FIXED_DATE = new Date('2026-03-17T19:50:00Z');

describe('timestamp helpers', () => {
  it('timestamp returns YYYYMMDDHHmm in local time', () => {
    // We can only assert the length and digit-only constraint since the
    // exact value depends on the local timezone.
    const ts = timestamp(FIXED_DATE);
    assert.match(ts, /^\d{12}$/);
  });

  it('shortTimestamp returns YYMMDDHHmm (10 digits)', () => {
    const ts = shortTimestamp(FIXED_DATE);
    assert.match(ts, /^\d{10}$/);
  });

  it('dateStamp returns YYYYMMDD (8 digits)', () => {
    const ds = dateStamp(FIXED_DATE);
    assert.match(ds, /^\d{8}$/);
    assert.ok(ds.startsWith('2026'));
  });

  it('timestamp has correct year prefix', () => {
    const ts = timestamp(FIXED_DATE);
    assert.ok(ts.startsWith('2026'));
  });
});

describe('isValidIdentifier', () => {
  it('accepts alphanumeric identifiers', () => {
    assert.ok(isValidIdentifier('alpha'));
    assert.ok(isValidIdentifier('dev'));
    assert.ok(isValidIdentifier('abc1234'));
    assert.ok(isValidIdentifier('42'));
    assert.ok(isValidIdentifier('0'));
    assert.ok(isValidIdentifier('A-B-C'));
  });

  it('rejects empty string', () => {
    assert.ok(!isValidIdentifier(''));
  });

  it('rejects identifiers with invalid characters', () => {
    assert.ok(!isValidIdentifier('feat/login'));
    assert.ok(!isValidIdentifier('foo_bar'));
    assert.ok(!isValidIdentifier('foo.bar'));
    assert.ok(!isValidIdentifier('foo bar'));
  });

  it('rejects pure-numeric identifiers with leading zeros', () => {
    assert.ok(!isValidIdentifier('01'));
    assert.ok(!isValidIdentifier('007'));
  });

  it('accepts single zero', () => {
    assert.ok(isValidIdentifier('0'));
  });
});

describe('sanitizeIdentifier', () => {
  it('replaces slashes with hyphens', () => {
    assert.equal(sanitizeIdentifier('feat/login'), 'feat-login');
  });

  it('replaces underscores with hyphens', () => {
    assert.equal(sanitizeIdentifier('my_branch'), 'my-branch');
  });

  it('collapses consecutive hyphens', () => {
    assert.equal(sanitizeIdentifier('foo--bar'), 'foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    assert.equal(sanitizeIdentifier('-foo-'), 'foo');
  });

  it('handles branch names with multiple slashes', () => {
    assert.equal(sanitizeIdentifier('feature/user/login'), 'feature-user-login');
  });

  it('returns empty string for all-invalid input', () => {
    assert.equal(sanitizeIdentifier('___'), '');
  });
});

describe('render', () => {
  const baseVars = {
    preid: 'dev',
    hash: 'abc1234',
    hashLong: 'abc1234567890abcdef',
    branch: 'main',
    base: '1.2.3',
    inc: 5,
    now: FIXED_DATE,
  };

  it('renders the default template', () => {
    const result = render('{preid}.{timestamp}.{hash}', baseVars);
    assert.match(result, /^dev\.\d{12}\.abc1234$/);
  });

  it('substitutes {preid}', () => {
    const result = render('{preid}.0', { ...baseVars, preid: 'alpha' });
    assert.ok(result.startsWith('alpha.'));
  });

  it('substitutes {hash-long}', () => {
    const result = render('{preid}.{hash-long}', baseVars);
    assert.equal(result, 'dev.abc1234567890abcdef');
  });

  it('substitutes {branch}', () => {
    const result = render('{branch}.{timestamp}.{hash}', baseVars);
    assert.match(result, /^main\.\d{12}\.abc1234$/);
  });

  it('substitutes {base}', () => {
    const result = render('{base}.{hash}', baseVars);
    // {base} contains dots — each segment is validated independently
    // "1", "2", "3", "<hash>" — all valid
    assert.equal(result, '1.2.3.abc1234');
  });

  it('substitutes {inc}', () => {
    const result = render('{preid}.{inc}', baseVars);
    assert.equal(result, 'dev.5');
  });

  it('substitutes {ts}', () => {
    const result = render('{preid}.{ts}.{hash}', baseVars);
    assert.match(result, /^dev\.\d{10}\.abc1234$/);
  });

  it('substitutes {date}', () => {
    const result = render('{preid}.{date}.{hash}', baseVars);
    assert.match(result, /^dev\.2026\d{4}\.abc1234$/);
  });

  it('defaults {inc} to "0" when not supplied', () => {
    const vars = { ...baseVars };
    delete vars.inc;
    const result = render('{preid}.{inc}', vars);
    assert.equal(result, 'dev.0');
  });

  it('defaults {preid} to "dev" when not supplied', () => {
    const vars = { ...baseVars };
    delete vars.preid;
    const result = render('{preid}.{hash}', vars);
    assert.ok(result.startsWith('dev.'));
  });

  it('sanitizes {branch} automatically', () => {
    const result = render('{branch}.{hash}', { ...baseVars, branch: 'feat/login' });
    assert.equal(result, 'feat-login.abc1234');
  });

  it('throws for identifiers with invalid characters after substitution', () => {
    // If preid somehow contains illegal chars after substitution they show up
    // In practice the user controls preid — simulate an edge case where the
    // rendered segment ends up empty (e.g. hash is empty string)
    assert.throws(
      () => render('{preid}..{hash}', baseVars),
      /not SemVer 2\.0\.0 compliant/
    );
  });

  it('throws when a pure-numeric identifier has a leading zero', () => {
    // Provide an inc value with a leading zero that bypasses template vars
    // by crafting a format that includes a literal leading-zero number
    assert.throws(
      () => render('01.{hash}', baseVars),
      /not SemVer 2\.0\.0 compliant/
    );
  });
});
