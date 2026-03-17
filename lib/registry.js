'use strict';

const https = require('https');
const http = require('http');

/**
 * Fetch a URL and return the parsed JSON body.
 * Uses the built-in `https`/`http` modules — no external dependencies.
 *
 * @param {string} url
 * @returns {Promise<unknown>}
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(
      url,
      { headers: { Accept: 'application/json', 'User-Agent': 'dev-bump' } },
      (res) => {
        if (res.statusCode === 404) {
          reject(new Error(`Package not found: ${url}`));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }

        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    // 15-second timeout to avoid hanging CI jobs
    req.setTimeout(15000, () => {
      req.destroy(new Error(`Request to ${url} timed out after 15 s`));
    });
  });
}

/**
 * Return the version pinned to a specific dist-tag for a package.
 *
 * @param {string} packageName     npm package name
 * @param {string} [tag='latest']  dist-tag (e.g. 'latest', 'next', 'dev')
 * @param {string} [registry]      Registry base URL (default: https://registry.npmjs.org)
 * @returns {Promise<string>}
 * @throws {Error} if the package or tag is not found
 */
async function getLatestVersion(
  packageName,
  tag = 'latest',
  registry = 'https://registry.npmjs.org'
) {
  const url = `${registry.replace(/\/$/, '')}/${encodeURIComponent(packageName)}`;
  const data = await fetchJson(url);
  const distTags = data['dist-tags'];
  if (distTags && typeof distTags[tag] === 'string') {
    return distTags[tag];
  }
  throw new Error(`dist-tag "${tag}" not found for package "${packageName}"`);
}

/**
 * Return an array of all published version strings for a package.
 *
 * @param {string} packageName
 * @param {string} [registry]
 * @returns {Promise<string[]>}
 */
async function getAllVersions(
  packageName,
  registry = 'https://registry.npmjs.org'
) {
  const url = `${registry.replace(/\/$/, '')}/${encodeURIComponent(packageName)}`;
  const data = await fetchJson(url);
  return Object.keys(data.versions || {});
}

module.exports = { fetchJson, getLatestVersion, getAllVersions };
