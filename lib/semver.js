'use strict';

/**
 * Minimal SemVer 2.0.0 compliant parser and utilities.
 * Zero external dependencies — uses only Node.js native logic.
 *
 * Reference: https://semver.org/
 */

// Official SemVer 2.0.0 regex (from semver.org)
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Parse a SemVer string into its components.
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[], buildmetadata: string[] } | null}
 */
function parse(version) {
  if (typeof version !== 'string') return null;
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ? match[4].split('.') : [],
    buildmetadata: match[5] ? match[5].split('.') : [],
  };
}

/**
 * Return true if the given string is a valid SemVer version.
 * @param {string} version
 * @returns {boolean}
 */
function valid(version) {
  return parse(version) !== null;
}

/**
 * Extract the MAJOR.MINOR.PATCH core from a version string.
 * @param {string} version
 * @returns {string | null}
 */
function base(version) {
  const parsed = parse(version);
  if (!parsed) return null;
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

/**
 * Compare two pre-release identifier segments.
 * Rules (SemVer §11):
 *   - Numeric identifiers are compared numerically.
 *   - Alphanumeric identifiers are compared lexically in ASCII order.
 *   - Numeric identifiers always have lower precedence than alphanumeric identifiers.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, 0 if equal, positive if a > b
 */
function compareIdentifier(a, b) {
  const aIsNum = /^\d+$/.test(a);
  const bIsNum = /^\d+$/.test(b);
  if (aIsNum && bIsNum) return parseInt(a, 10) - parseInt(b, 10);
  if (aIsNum) return -1; // numeric < alphanumeric
  if (bIsNum) return 1;  // alphanumeric > numeric
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Compare two SemVer strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, 0 if equal, positive if a > b
 * @throws {Error} if either version is invalid
 */
function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa) throw new Error(`Invalid SemVer version: "${a}"`);
  if (!pb) throw new Error(`Invalid SemVer version: "${b}"`);

  // Compare MAJOR.MINOR.PATCH numerically
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // A version without pre-release has higher precedence than one with pre-release
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;

  // Both have pre-release: compare identifiers left to right
  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    if (i >= pa.prerelease.length) return -1; // fewer identifiers = lower precedence
    if (i >= pb.prerelease.length) return 1;
    const cmp = compareIdentifier(pa.prerelease[i], pb.prerelease[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/**
 * Return true if version a is strictly greater than version b.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function gt(a, b) {
  return compare(a, b) > 0;
}

/**
 * Return true if version a is strictly less than version b.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function lt(a, b) {
  return compare(a, b) < 0;
}

/**
 * Return the maximum version from an array of version strings.
 * Invalid versions are silently skipped.
 * @param {string[]} versions
 * @returns {string | null}
 */
function maxSatisfying(versions) {
  let max = null;
  for (const v of versions) {
    if (!valid(v)) continue;
    if (max === null || gt(v, max)) max = v;
  }
  return max;
}

module.exports = { parse, valid, base, compare, gt, lt, maxSatisfying };
