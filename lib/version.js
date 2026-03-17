'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const semver = require('./semver');
const git = require('./git');
const { render } = require('./template');
const registry = require('./registry');

// ---------------------------------------------------------------------------
// {inc} computation
// ---------------------------------------------------------------------------

/**
 * Given all published versions for a package, find the next auto-increment
 * value for a given base version, pre-release label, and format template.
 *
 * The function filters versions that start with `<base>-<preid>.`, parses
 * them, and returns max(existing numeric tail) + 1, or 0 if none exist yet.
 *
 * @param {string[]} versions   All published version strings
 * @param {string}   baseVer    MAJOR.MINOR.PATCH base (e.g. "1.2.3")
 * @param {string}   preid      Pre-release label (e.g. "dev")
 * @returns {number}
 */
function computeInc(versions, baseVer, preid) {
  const prefix = `${baseVer}-${preid}.`;
  let maxInc = -1;

  for (const v of versions) {
    if (!v.startsWith(prefix)) continue;
    const parsed = semver.parse(v);
    if (!parsed) continue;
    // Walk the pre-release identifiers from right to left and take the first
    // (rightmost) pure-numeric value as the inc counter.
    for (let i = parsed.prerelease.length - 1; i >= 0; i--) {
      const seg = parsed.prerelease[i];
      if (/^\d+$/.test(seg)) {
        const n = parseInt(seg, 10);
        if (n > maxInc) maxInc = n;
        break;
      }
    }
  }

  return maxInc + 1;
}

// ---------------------------------------------------------------------------
// Core generation
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GenerateOptions
 * @property {string}      cwd          Working directory
 * @property {string}      preid        Pre-release identifier (default: "dev")
 * @property {string}      format       Template string (default: "{preid}.{timestamp}.{hash}")
 * @property {string|null} base         Manual base version override
 * @property {boolean}     fromRegistry Fetch base from npm registry
 * @property {string}      tag          dist-tag for --from-registry
 * @property {string}      registry     Registry URL
 */

/**
 * Read and parse the package.json at `<cwd>/package.json`.
 * @param {string} cwd
 * @returns {{ name: string, version: string, [key: string]: unknown }}
 * @throws {Error}
 */
function readPackageJson(cwd) {
  const pkgPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`No package.json found in "${cwd}"`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.version) {
    throw new Error(`"version" field missing from package.json in "${cwd}"`);
  }
  return pkg;
}

/**
 * Determine the MAJOR.MINOR.PATCH base version from options.
 * Priority: explicit --base > --from-registry > local package.json.
 *
 * @param {GenerateOptions} options
 * @param {{ name: string, version: string }} pkg
 * @returns {Promise<string>}
 */
async function resolveBaseVersion(options, pkg) {
  if (options.base) {
    const resolved = semver.base(options.base);
    if (!resolved) {
      throw new Error(
        `Invalid base version provided with --base: "${options.base}". ` +
        `Must be a valid SemVer string.`
      );
    }
    return resolved;
  }

  if (options.fromRegistry) {
    if (!pkg.name) {
      throw new Error(
        '`--from-registry` requires the "name" field to be set in package.json.'
      );
    }
    const latest = await registry.getLatestVersion(
      pkg.name,
      options.tag,
      options.registry
    );
    const resolved = semver.base(latest);
    if (!resolved) {
      throw new Error(`Registry returned an invalid version: "${latest}"`);
    }
    return resolved;
  }

  const resolved = semver.base(pkg.version);
  if (!resolved) {
    throw new Error(
      `Current package.json version "${pkg.version}" is not a valid SemVer string.`
    );
  }
  return resolved;
}

/**
 * Generate a new development version string.
 *
 * @param {GenerateOptions} options
 * @returns {Promise<string>}   Full SemVer version string, e.g. "1.2.3-dev.202603171950.abc1234"
 */
async function generateVersion(options) {
  const {
    cwd,
    preid,
    format,
  } = options;

  const pkg = readPackageJson(cwd);
  const baseVer = await resolveBaseVersion(options, pkg);

  // Collect git info; fall back gracefully if git is unavailable
  let gitHash = 'nogit';
  let gitHashLong = 'nogit';
  let gitBranch = 'HEAD';
  try {
    gitHash = git.shortHash(cwd);
    gitHashLong = git.fullHash(cwd);
    gitBranch = git.branch(cwd);
  } catch {
    // Git unavailable or not a repository — use safe fallback values.
    // The caller can still use {timestamp}/{date}/{base} without git.
  }

  // Resolve {inc} only when the template actually uses it (avoids unnecessary
  // network request)
  let inc = 0;
  if (format.includes('{inc}')) {
    if (!pkg.name) {
      throw new Error(
        'The {inc} template variable requires the "name" field to be set in package.json.'
      );
    }
    const allVersions = await registry.getAllVersions(pkg.name, options.registry);
    inc = computeInc(allVersions, baseVer, preid);
  }

  const prerelease = render(format, {
    preid,
    hash: gitHash,
    hashLong: gitHashLong,
    branch: gitBranch,
    base: baseVer,
    inc,
    now: new Date(),
  });

  const newVersion = `${baseVer}-${prerelease}`;

  // Final SemVer validity gate — belt-and-suspenders check
  if (!semver.valid(newVersion)) {
    throw new Error(
      `Generated version "${newVersion}" is not valid SemVer 2.0.0. ` +
      `Please adjust your --format template.`
    );
  }

  // Warn (never throw) if the new version is not greater than the current one.
  // This can legitimately happen when running twice in the same minute.
  if (!options.fromRegistry && !options.base) {
    try {
      if (!semver.gt(newVersion, pkg.version)) {
        process.stderr.write(
          `dev-bump warning: generated version "${newVersion}" is not ` +
          `greater than the current version "${pkg.version}".\n`
        );
      }
    } catch {
      // Swallow comparison errors (e.g. if pkg.version is non-standard)
    }
  }

  return newVersion;
}

// ---------------------------------------------------------------------------
// Applying the version
// ---------------------------------------------------------------------------

/**
 * Write the new version into package.json (and package-lock.json / npm-shrinkwrap.json
 * if present) by delegating to `npm version --no-git-tag-version`.
 *
 * @param {string}  newVersion
 * @param {string}  cwd
 * @param {boolean} noGitTag   When true, passes --no-git-tag-version to npm
 */
function applyVersion(newVersion, cwd, noGitTag) {
  const flags = ['--allow-same-version'];
  if (noGitTag) flags.push('--no-git-tag-version');

  execSync(`npm version ${newVersion} ${flags.join(' ')}`, {
    cwd,
    stdio: 'inherit',
  });
}

module.exports = { generateVersion, applyVersion, computeInc, readPackageJson, resolveBaseVersion };
