'use strict';

/**
 * Template rendering for SemVer pre-release strings.
 *
 * Supported variables:
 *   {preid}      - Pre-release identifier (e.g. "dev", "alpha")
 *   {timestamp}  - YYYYMMDDHHmm  (e.g. "202603171950")
 *   {ts}         - YYMMDDHHmm    (e.g. "2603171950")
 *   {date}       - YYYYMMDD      (e.g. "20260317")
 *   {hash}       - Short git commit hash (7 chars, e.g. "abc1234")
 *   {hash-long}  - Full git commit hash (40 chars)
 *   {branch}     - Sanitized git branch name (e.g. "feat-login")
 *   {base}       - Base version MAJOR.MINOR.PATCH (e.g. "1.2.3")
 *   {inc}        - Auto-incrementing counter based on existing registry versions
 */

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as YYYYMMDDHHmm.
 * @param {Date} now
 * @returns {string}
 */
function timestamp(now) {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}`;
}

/**
 * Format a Date as YYMMDDHHmm (2-digit year).
 * @param {Date} now
 * @returns {string}
 */
function shortTimestamp(now) {
  const y = String(now.getFullYear()).slice(-2);
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}`;
}

/**
 * Format a Date as YYYYMMDD.
 * @param {Date} now
 * @returns {string}
 */
function dateStamp(now) {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${mo}${d}`;
}

// ---------------------------------------------------------------------------
// Identifier compliance
// ---------------------------------------------------------------------------

/**
 * Validate that a single pre-release identifier segment is SemVer 2.0.0 compliant.
 *   - Non-empty
 *   - Only [0-9A-Za-z-] characters
 *   - Pure-numeric identifiers must not have leading zeros
 *
 * @param {string} id
 * @returns {boolean}
 */
function isValidIdentifier(id) {
  if (id === '') return false;
  if (!/^[0-9A-Za-z-]+$/.test(id)) return false;
  if (/^\d+$/.test(id) && id.length > 1 && id[0] === '0') return false;
  return true;
}

/**
 * Sanitize a raw string (e.g. branch name) so it can be used as a SemVer
 * pre-release identifier segment:
 *   - Replace characters outside [0-9A-Za-z-] with '-'
 *   - Collapse consecutive '-' into a single '-'
 *   - Strip leading/trailing '-'
 *
 * @param {string} str
 * @returns {string}
 */
function sanitizeIdentifier(str) {
  return str
    .replace(/[^0-9A-Za-z-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

/**
 * Render a pre-release template string with variable substitution.
 *
 * The template is a dot-separated sequence of identifier segments, each of
 * which may contain one or more {variable} placeholders.  After substitution
 * every resulting segment is validated for SemVer 2.0.0 compliance.
 *
 * @param {string} format - Template, e.g. "{preid}.{timestamp}.{hash}"
 * @param {Object} vars
 * @param {string}      vars.preid      Pre-release label (default "dev")
 * @param {string}      vars.hash       Short git hash
 * @param {string}      vars.hashLong   Full git hash
 * @param {string}      vars.branch     Sanitized git branch name
 * @param {string}      vars.base       MAJOR.MINOR.PATCH base version
 * @param {number}      vars.inc        Auto-increment counter
 * @param {Date}       [vars.now]       Override current date/time
 * @returns {string}  The rendered pre-release string (without the leading "-")
 * @throws {Error}    If any resulting identifier is SemVer non-compliant
 */
function render(format, vars) {
  const now = vars.now instanceof Date ? vars.now : new Date();

  const result = format
    .replace(/\{preid\}/g, vars.preid != null ? String(vars.preid) : 'dev')
    .replace(/\{timestamp\}/g, timestamp(now))
    .replace(/\{ts\}/g, shortTimestamp(now))
    .replace(/\{date\}/g, dateStamp(now))
    .replace(/\{hash-long\}/g, vars.hashLong != null ? String(vars.hashLong) : '')
    .replace(/\{hash\}/g, vars.hash != null ? String(vars.hash) : '')
    .replace(/\{branch\}/g, vars.branch != null ? sanitizeIdentifier(String(vars.branch)) : '')
    .replace(/\{base\}/g, vars.base != null ? String(vars.base) : '')
    .replace(/\{inc\}/g, vars.inc != null ? String(vars.inc) : '0');

  // Validate each dot-separated identifier segment for SemVer compliance
  const identifiers = result.split('.');
  for (const id of identifiers) {
    if (!isValidIdentifier(id)) {
      throw new Error(
        `Generated pre-release identifier "${id}" is not SemVer 2.0.0 compliant ` +
        `(template: "${format}"). ` +
        `Identifiers must only contain [0-9A-Za-z-], must not be empty, ` +
        `and pure-numeric identifiers must not have leading zeros.`
      );
    }
  }

  return result;
}

module.exports = {
  render,
  isValidIdentifier,
  sanitizeIdentifier,
  timestamp,
  shortTimestamp,
  dateStamp,
};
