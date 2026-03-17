'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, DEFAULT_FORMAT } = require('../lib/args');

// Helper: build an argv array as if the CLI were invoked with the given args
function argv(...args) {
  return ['node', '/path/to/dev-bump.js', ...args];
}

describe('parseArgs — defaults', () => {
  it('returns sensible defaults when no arguments are given', () => {
    const opts = parseArgs(argv());
    assert.equal(opts.preid, 'dev');
    assert.equal(opts.format, DEFAULT_FORMAT);
    assert.equal(opts.base, null);
    assert.equal(opts.fromRegistry, false);
    assert.equal(opts.tag, 'latest');
    assert.equal(opts.dryRun, false);
    assert.equal(opts.stdoutOnly, false);
    assert.equal(opts.noGitTag, true);
    assert.equal(opts.registry, 'https://registry.npmjs.org');
    assert.equal(opts.help, false);
  });
});

describe('parseArgs — --preid / -p', () => {
  it('sets preid via --preid', () => {
    assert.equal(parseArgs(argv('--preid', 'alpha')).preid, 'alpha');
  });

  it('sets preid via -p', () => {
    assert.equal(parseArgs(argv('-p', 'beta')).preid, 'beta');
  });

  it('sets preid via --preid=value', () => {
    assert.equal(parseArgs(argv('--preid=rc')).preid, 'rc');
  });
});

describe('parseArgs — --format / -f', () => {
  it('sets format via --format', () => {
    assert.equal(
      parseArgs(argv('--format', '{preid}.{inc}')).format,
      '{preid}.{inc}'
    );
  });

  it('sets format via -f', () => {
    assert.equal(parseArgs(argv('-f', '{branch}.{hash}')).format, '{branch}.{hash}');
  });

  it('sets format via --format=value', () => {
    assert.equal(parseArgs(argv('--format={preid}.{date}')).format, '{preid}.{date}');
  });
});

describe('parseArgs — --base / -b', () => {
  it('sets base via --base', () => {
    assert.equal(parseArgs(argv('--base', '2.0.0')).base, '2.0.0');
  });

  it('sets base via -b', () => {
    assert.equal(parseArgs(argv('-b', '1.5.0')).base, '1.5.0');
  });
});

describe('parseArgs — --from-registry / -r', () => {
  it('sets fromRegistry via --from-registry', () => {
    assert.equal(parseArgs(argv('--from-registry')).fromRegistry, true);
  });

  it('sets fromRegistry via -r', () => {
    assert.equal(parseArgs(argv('-r')).fromRegistry, true);
  });
});

describe('parseArgs — --tag / -t', () => {
  it('sets tag via --tag', () => {
    assert.equal(parseArgs(argv('--tag', 'next')).tag, 'next');
  });

  it('sets tag via -t', () => {
    assert.equal(parseArgs(argv('-t', 'canary')).tag, 'canary');
  });
});

describe('parseArgs — --dry-run / -d', () => {
  it('sets dryRun via --dry-run', () => {
    assert.equal(parseArgs(argv('--dry-run')).dryRun, true);
  });

  it('sets dryRun via -d', () => {
    assert.equal(parseArgs(argv('-d')).dryRun, true);
  });
});

describe('parseArgs — --stdout-only', () => {
  it('sets stdoutOnly and implies dryRun', () => {
    const opts = parseArgs(argv('--stdout-only'));
    assert.equal(opts.stdoutOnly, true);
    assert.equal(opts.dryRun, true);
  });
});

describe('parseArgs — --cwd', () => {
  it('sets cwd via --cwd', () => {
    assert.equal(parseArgs(argv('--cwd', '/tmp/project')).cwd, '/tmp/project');
  });

  it('sets cwd via --cwd=value', () => {
    assert.equal(parseArgs(argv('--cwd=/tmp/other')).cwd, '/tmp/other');
  });
});

describe('parseArgs — --registry', () => {
  it('sets registry via --registry', () => {
    assert.equal(
      parseArgs(argv('--registry', 'https://my.registry.com')).registry,
      'https://my.registry.com'
    );
  });
});

describe('parseArgs — --help / -h', () => {
  it('sets help via --help', () => {
    assert.equal(parseArgs(argv('--help')).help, true);
  });

  it('sets help via -h', () => {
    assert.equal(parseArgs(argv('-h')).help, true);
  });
});

describe('parseArgs — combined flags', () => {
  it('handles multiple flags together', () => {
    const opts = parseArgs(argv('-p', 'canary', '-f', '{preid}.{hash}', '--dry-run'));
    assert.equal(opts.preid, 'canary');
    assert.equal(opts.format, '{preid}.{hash}');
    assert.equal(opts.dryRun, true);
  });
});
