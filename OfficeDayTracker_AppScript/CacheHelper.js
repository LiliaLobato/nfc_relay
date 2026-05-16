/**
 * CacheHelper.js
 * PropertiesService-backed daily cache for page data.
 *
 * Cache is valid for one calendar day. The Office path requires that the cache
 * already records alreadyLogged=true before it can be served — if alreadyLogged
 * is false, a write may still be needed, so we always fall through to the sheet.
 *
 * Soft reload (GetFreshData) always bypasses the cache and refreshes it afterward.
 *
 * Stored structure:
 *   {
 *     date:                 "YYYY-MM-DD",
 *     alreadyLogged:        boolean,
 *     status:               string,
 *     statusLabel:          string,
 *     alreadyLoggedMessage: string,
 *     rings:                Object,
 *     days:                 Object,
 *     calendar:             Object,
 *     charts:               Object,
 *   }
 */

const CACHE_PROPERTY_KEY = 'pageCache';
const CACHE_MAX_BYTES    = 9000;  // PropertiesService hard limit is 9KB per value


/**
 * Returns today's date as a YYYY-MM-DD string used as the cache validity key.
 *
 * @returns {string}
 */
function todayString() {
  return Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}


/**
 * Reads and parses the cached entry. Returns null on miss or parse failure.
 *
 * @returns {Object|null}
 */
function readCache() {
  const raw = PropertiesService.getScriptProperties().getProperty(CACHE_PROPERTY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch(e) {
    console.warn('CacheHelper: failed to parse cache —', e.message);
    return null;
  }
}


/**
 * Serializes and writes an entry to PropertiesService.
 * Skips the write if the payload exceeds CACHE_MAX_BYTES and logs a warning.
 *
 * @param {Object} entry full cache entry built by buildCacheEntry()
 * @returns {boolean} true if written, false if skipped due to size
 */
function writeCache(entry) {
  const payload = JSON.stringify(entry);
  if (payload.length > CACHE_MAX_BYTES) {
    console.warn('CacheHelper: payload is', payload.length, 'bytes — exceeds limit, not cached');
    return false;
  }
  PropertiesService.getScriptProperties().setProperty(CACHE_PROPERTY_KEY, payload);
  return true;
}


/**
 * Returns true if the cached entry is valid and safe to serve for the given key.
 *
 * Rules:
 *  - Cache must exist and be from today.
 *  - Office path: only safe if alreadyLogged=true (write already happened today).
 *    If alreadyLogged=false the cell may still be empty — fall through to the sheet.
 *  - Home / Weekend: any same-day cache is safe to serve.
 *
 * @param {Object|null} cached parsed cache entry
 * @param {string} key 'Office' | 'Home'
 * @returns {boolean}
 */
function isCacheValid(cached, key) {
  if (!cached || cached.date !== todayString()) return false;
  if (key === 'Office') return cached.alreadyLogged === true;
  return true;
}


/**
 * Builds a cache entry from a fully assembled page data object.
 *
 * @param {Object} data assembled page data (output of BuildPageData)
 * @returns {Object} entry ready for writeCache()
 */
function buildCacheEntry(data) {
  return {
    date:                 todayString(),
    alreadyLogged:        data.alreadyLogged,
    status:               data.status,
    statusLabel:          data.statusLabel,
    alreadyLoggedMessage: data.alreadyLoggedMessage,
    rings:                data.rings,
    days:                 data.days,
    calendar:             data.calendar,
    charts:               data.charts,
  };
}


/**
 * Reconstructs a full page data object from a valid cache entry.
 * date and time are always recomputed so they reflect the current moment.
 * alreadyLogged is suppressed for the Home path — the banner only applies when a write is attempted.
 *
 * @param {Object} cached valid cache entry
 * @param {string} key 'Office' | 'Home'
 * @returns {Object} page data object ready to return from BuildPageData
 */
function buildPageDataFromCache(cached, key) {
  const isOffice = key === 'Office';
  return {
    date:                 Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, dd/MMM/yyyy"),
    time:                 Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "h:mm a"),
    weekNumber:           GetCurrentISOWeek(),
    alreadyLogged:        isOffice ? cached.alreadyLogged : false,
    status:               cached.status,
    statusLabel:          cached.statusLabel,
    alreadyLoggedMessage: isOffice ? cached.alreadyLoggedMessage : '',
    rings:                cached.rings,
    days:                 cached.days,
    calendar:             cached.calendar,
    charts:               cached.charts,
  };
}
