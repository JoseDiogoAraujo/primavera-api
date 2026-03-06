const fs = require('fs');
const path = require('path');
const https = require('https');

const GOOGLE_API_KEY = 'AIzaSyBXNpRqSwHf5AQe9yWhP9lfuWwiIIXsue4';
const SEED_FILE = path.join(__dirname, '..', 'locality-cache.json');
const COORDS_FILE = path.join(__dirname, '..', 'municipality-coords.json');

// In-memory cache: raw LocalDescarga -> normalized municipality name
let cache = {};
// Coordinates cache: normalized municipality name -> { lat, lng }
let coordsCache = {};

// Load seed cache and coordinates from files shipped with the code
function loadCache() {
  try {
    if (fs.existsSync(SEED_FILE)) {
      cache = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      console.log(`[geocode] Cache loaded: ${Object.keys(cache).length} entries`);
    }
  } catch (err) {
    console.error('[geocode] Error loading cache:', err.message);
    cache = {};
  }
  try {
    if (fs.existsSync(COORDS_FILE)) {
      const coords = JSON.parse(fs.readFileSync(COORDS_FILE, 'utf8'));
      coords.forEach(c => { coordsCache[c.name] = { lat: c.lat, lng: c.lng }; });
      console.log(`[geocode] Coords loaded: ${Object.keys(coordsCache).length} municipalities`);
    }
  } catch (err) {
    console.error('[geocode] Error loading coords:', err.message);
  }
}

// Get coordinates for a normalized municipality
function getCoords(normalizedName) {
  return coordsCache[normalizedName] || null;
}

// Call Google Geocoding API
function geocodeGoogle(address) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(address + ', Portugal');
    const url = `/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_API_KEY}&language=pt&region=pt`;

    https.get({ hostname: 'maps.googleapis.com', path: url }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results[0]) {
            const components = json.results[0].address_components;
            const municipality = components.find(c => c.types.includes('administrative_area_level_2'));
            const locality = components.find(c => c.types.includes('locality'));
            resolve((municipality && municipality.long_name) || (locality && locality.long_name) || null);
          } else {
            resolve(null);
          }
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Get normalized locality - returns from cache instantly, geocodes new values in background
function normalize(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === '.') return null;
  const key = raw.trim();

  if (key in cache) {
    return cache[key];
  }

  // Not in cache - geocode in background, return null for now
  geocodeGoogle(key).then(result => {
    cache[key] = result;
    console.log(`[geocode] New: "${key}" -> "${result}"`);
  }).catch(err => {
    console.error(`[geocode] Error geocoding "${key}":`, err.message);
    cache[key] = null;
  });

  return null; // Will be available on next request
}

// Bulk normalize (synchronous from cache, queues uncached in background)
function bulkNormalizeSync(rawValues) {
  const uncached = [];
  for (const raw of rawValues) {
    const key = (raw || '').trim();
    if (!key || key === '.' || key in cache) continue;
    uncached.push(key);
  }

  // Geocode uncached values in background (non-blocking)
  if (uncached.length > 0) {
    console.log(`[geocode] ${uncached.length} uncached values - geocoding in background...`);
    (async () => {
      for (const key of uncached) {
        try {
          const result = await geocodeGoogle(key);
          cache[key] = result;
        } catch (err) {
          cache[key] = null;
        }
      }
      console.log(`[geocode] Background geocoding done. Cache now: ${Object.keys(cache).length} entries`);
    })();
  }
}

// Get the full cache
function getCache() {
  return { ...cache };
}

// Initialize on module load
loadCache();

module.exports = { normalize, bulkNormalizeSync, getCache, getCoords, loadCache };
