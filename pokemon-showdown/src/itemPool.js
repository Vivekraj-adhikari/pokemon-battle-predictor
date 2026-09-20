'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'common-items.json');

/**
 * Loads the { [speciesId]: string[] } common-items lookup built by
 * scripts/buildItemPool.js from Smogon's usage stats. If that file
 * doesn't exist yet, returns null and setGenerator falls back to its
 * built-in DEFAULT_ITEM_POOL for every species.
 */
function loadItemPool(filePath = DEFAULT_PATH) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn(`Could not parse item pool at ${filePath}: ${e.message}`);
    return null;
  }
}

module.exports = { loadItemPool, DEFAULT_PATH };
