#!/usr/bin/env node
'use strict';

const { parseArgs, HELP_TEXT } = require('../lib/args');
const { generateVersion, applyVersion } = require('../lib/version');

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    process.stdout.write(HELP_TEXT + '\n');
    process.exit(0);
  }

  let newVersion;
  try {
    newVersion = await generateVersion(options);
  } catch (err) {
    process.stderr.write(`dev-bump error: ${err.message}\n`);
    process.exit(1);
  }

  // --stdout-only: emit the bare version string to stdout and exit
  if (options.stdoutOnly) {
    process.stdout.write(newVersion + '\n');
    return;
  }

  // Apply the version (unless --dry-run was requested)
  if (!options.dryRun) {
    try {
      applyVersion(newVersion, options.cwd, options.noGitTag);
    } catch (err) {
      process.stderr.write(`dev-bump error applying version: ${err.message}\n`);
      process.exit(1);
    }
  }

  // Always print the new version so the caller knows what happened
  process.stdout.write(newVersion + '\n');
}

main();
