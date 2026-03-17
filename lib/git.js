'use strict';

const { execSync } = require('child_process');
const { sanitizeIdentifier } = require('./template');

/**
 * Execute a git command and return its stdout, trimmed.
 * @param {string} cmd
 * @param {string} cwd
 * @returns {string}
 */
function gitExec(cmd, cwd) {
  return execSync(cmd, {
    encoding: 'utf8',
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Return the short git commit hash (7 hex chars).
 * @param {string} [cwd=process.cwd()]
 * @returns {string}
 * @throws {Error} if not inside a git repository or git is unavailable
 */
function shortHash(cwd = process.cwd()) {
  try {
    return gitExec('git rev-parse --short HEAD', cwd);
  } catch {
    throw new Error(
      'Failed to get git commit hash. Make sure you are inside a git repository and git is installed.'
    );
  }
}

/**
 * Return the full 40-char git commit hash.
 * @param {string} [cwd=process.cwd()]
 * @returns {string}
 * @throws {Error} if not inside a git repository or git is unavailable
 */
function fullHash(cwd = process.cwd()) {
  try {
    return gitExec('git rev-parse HEAD', cwd);
  } catch {
    throw new Error(
      'Failed to get git commit hash. Make sure you are inside a git repository and git is installed.'
    );
  }
}

/**
 * Return the current git branch name, sanitized for use as a SemVer identifier.
 * Detached HEAD state yields "HEAD".
 * @param {string} [cwd=process.cwd()]
 * @returns {string}
 * @throws {Error} if git is unavailable
 */
function branch(cwd = process.cwd()) {
  try {
    const raw = gitExec('git rev-parse --abbrev-ref HEAD', cwd);
    return sanitizeIdentifier(raw) || 'HEAD';
  } catch {
    throw new Error(
      'Failed to get git branch name. Make sure you are inside a git repository and git is installed.'
    );
  }
}

module.exports = { shortHash, fullHash, branch };
