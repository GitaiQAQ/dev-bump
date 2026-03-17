'use strict';

const DEFAULT_FORMAT = '{preid}.{timestamp}.{hash}';

/**
 * Parse CLI arguments from the given argv array (typically process.argv).
 *
 * @param {string[]} argv
 * @returns {{
 *   preid: string,
 *   format: string,
 *   base: string | null,
 *   fromRegistry: boolean,
 *   tag: string,
 *   dryRun: boolean,
 *   stdoutOnly: boolean,
 *   noGitTag: boolean,
 *   cwd: string,
 *   registry: string,
 *   help: boolean,
 * }}
 */
function parseArgs(argv) {
  const args = argv.slice(2); // drop 'node' + script path

  const result = {
    preid: 'dev',
    format: DEFAULT_FORMAT,
    base: null,
    fromRegistry: false,
    tag: 'latest',
    dryRun: false,
    stdoutOnly: false,
    noGitTag: true,
    cwd: process.cwd(),
    registry: 'https://registry.npmjs.org',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // --key=value style
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const key = arg.slice(0, eqIdx);
      const val = arg.slice(eqIdx + 1);
      switch (key) {
        case '--preid': result.preid = val; break;
        case '--format': case '-f': result.format = val; break;
        case '--base': case '-b': result.base = val; break;
        case '--tag': case '-t': result.tag = val; break;
        case '--cwd': result.cwd = val; break;
        case '--registry': result.registry = val; break;
      }
      continue;
    }

    // Boolean flags and --key value style
    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;
      case '--preid':
      case '-p':
        result.preid = args[++i];
        break;
      case '--format':
      case '-f':
        result.format = args[++i];
        break;
      case '--base':
      case '-b':
        result.base = args[++i];
        break;
      case '--from-registry':
      case '-r':
        result.fromRegistry = true;
        break;
      case '--tag':
      case '-t':
        result.tag = args[++i];
        break;
      case '--dry-run':
      case '-d':
        result.dryRun = true;
        break;
      case '--stdout-only':
        result.stdoutOnly = true;
        result.dryRun = true; // implies dry-run (no file writes)
        break;
      case '--no-git-tag':
        result.noGitTag = true;
        break;
      case '--cwd':
        result.cwd = args[++i];
        break;
      case '--registry':
        result.registry = args[++i];
        break;
    }
  }

  return result;
}

const HELP_TEXT = `
dev-bump — Generate SemVer-compliant development/snapshot version strings

USAGE
  npx dev-bump [options]

OPTIONS
  -p, --preid <id>        Pre-release identifier (default: "dev")
  -f, --format <tpl>      Pre-release template   (default: "{preid}.{timestamp}.{hash}")
  -b, --base <version>    Override base MAJOR.MINOR.PATCH (strips pre-release from input)
  -r, --from-registry     Fetch base version from the npm registry instead of package.json
  -t, --tag <tag>         dist-tag for --from-registry (default: "latest")
  -d, --dry-run           Print the generated version without modifying package.json
      --stdout-only       Print only the raw version string to stdout (implies --dry-run)
      --no-git-tag        Do not create a git tag when bumping (default: true)
      --cwd <path>        Working directory (default: current directory)
      --registry <url>    npm registry URL (default: https://registry.npmjs.org)
  -h, --help              Show this help message

TEMPLATE VARIABLES
  {preid}      Pre-release label            e.g. "dev", "alpha", "beta"
  {timestamp}  YYYYMMDDHHmm                 e.g. "202603171950"
  {ts}         YYMMDDHHmm (2-digit year)    e.g. "2603171950"
  {date}       YYYYMMDD                     e.g. "20260317"
  {hash}       Short git commit hash        e.g. "abc1234"
  {hash-long}  Full git commit hash         e.g. "abc1234567890abcd..."
  {branch}     Sanitized git branch name    e.g. "feat-login"
  {base}       Base MAJOR.MINOR.PATCH       e.g. "1.2.3"
  {inc}        Auto-incrementing counter    requires registry query

EXAMPLES
  npx dev-bump
  npx dev-bump --preid alpha
  npx dev-bump --format "{preid}.{inc}"
  npx dev-bump --format "{branch}.{timestamp}.{hash}"
  npx dev-bump --format "canary.{hash}"
  npx dev-bump --from-registry --tag next
  npx dev-bump --base 2.0.0
  npx dev-bump --dry-run
  VERSION=$(npx dev-bump --stdout-only)
`.trim();

module.exports = { parseArgs, HELP_TEXT, DEFAULT_FORMAT };
