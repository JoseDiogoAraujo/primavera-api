const fs = require('fs');
const path = require('path');
const https = require('https');

const GOOGLE_API_KEY = 'AIzaSyBXNpRqSwHf5AQe9yWhP9lfuWwiIIXsue4';
const CACHE_FILE = path.join(__dirname, '..', 'locality-cache.json');

// In-memory cache: raw LocalDescarga -> normalized municipality name
let cache = {};

// Load cache from disk on startup
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      console.log(`[geocode] Cache loaded: ${Object.keys(cache).length} entries`);
    }
  } catch (err) {
    console.error('[geocode] Error loading cache:', err.message);
    cache = {};
  }
}

// Save cache to disk
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('[geocode] Error saving cache:', err.message);
  }
}

// Call Google Geocoding API
function geocodeGoogle(address) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(address + ', Portugal');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_API_KEY}&language=pt&region=pt`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results[0]) {
            const components = json.results[0].address_components;
            // Try locality first, then administrative_area_level_2 (municipality)
            const locality = components.find(c => c.types.includes('locality'));
            const municipality = components.find(c => c.types.includes('administrative_area_level_2'));
            const result = (municipality && municipality.long_name) || (locality && locality.long_name) || null;
            resolve(result);
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Get normalized locality for a raw LocalDescarga value
async function normalize(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === '.') return null;

  const key = raw.trim();

  // Check cache
  if (key in cache) {
    return cache[key];
  }

  // Call Google
  try {
    const result = await geocodeGoogle(key);
    cache[key] = result;
    saveCache();
    return result;
  } catch (err) {
    console.error(`[geocode] Error geocoding "${key}":`, err.message);
    return null;
  }
}

// Bulk normalize: geocode an array of unique raw values, with rate limiting
async function bulkNormalize(rawValues) {
  let newCount = 0;
  for (const raw of rawValues) {
    const key = raw.trim();
    if (!key || key === '.' || key in cache) continue;

    try {
      const result = await geocodeGoogle(key);
      cache[key] = result;
      newCount++;
      // Small delay to respect Google rate limits
      if (newCount % 10 === 0) {
        saveCache(); // Save periodically
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error(`[geocode] Error geocoding "${key}":`, err.message);
      cache[key] = null;
    }
  }
  if (newCount > 0) {
    saveCache();
    console.log(`[geocode] Bulk geocoded ${newCount} new entries. Total cache: ${Object.keys(cache).length}`);
  }
}

// Get the full cache (for API endpoint)
function getCache() {
  return { ...cache };
}

// Initialize on module load
loadCache();

module.exports = { normalize, bulkNormalize, getCache, loadCache };
