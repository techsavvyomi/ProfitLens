// Firebase caching layer for fast reads/writes
// Reads from Firebase first, falls back to Sheets
// Writes go to Sheets (source of truth) AND sync to Firebase

let db = null;
let firebaseReady = false;

function initFirebase(config) {
  try {
    if (!window.firebase) {
      console.warn('Firebase SDK not loaded');
      return;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    db = firebase.firestore();
    firebaseReady = true;
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
    firebaseReady = false;
  }
}

function isReady() {
  return firebaseReady && db !== null;
}

function getDocPath(pin, collection) {
  return `users/${pin}/${collection}`;
}

// -- Cache reads --

async function getCached(pin, key) {
  if (!isReady()) return null;
  try {
    const doc = await db.collection('users').doc(pin).collection('cache').doc(key).get();
    if (doc.exists) {
      const data = doc.data();
      // Cache valid for 5 minutes
      if (data.timestamp && (Date.now() - data.timestamp) < 5 * 60 * 1000) {
        return data.value;
      }
    }
    return null;
  } catch (err) {
    console.warn('Firebase read failed:', err.message);
    return null;
  }
}

async function setCache(pin, key, value) {
  if (!isReady()) return;
  try {
    await db.collection('users').doc(pin).collection('cache').doc(key).set({
      value: value,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Firebase write failed:', err.message);
  }
}

async function invalidateCache(pin, key) {
  if (!isReady()) return;
  try {
    await db.collection('users').doc(pin).collection('cache').doc(key).delete();
  } catch (err) {
    // Ignore delete failures
  }
}

// -- Public API --

async function cachedFetch(pin, cacheKey, sheetFetchFn) {
  // Try Firebase cache first
  const cached = await getCached(pin, cacheKey);
  if (cached !== null) {
    // Refresh cache in background from Sheets
    sheetFetchFn().then(fresh => setCache(pin, cacheKey, fresh)).catch(() => {});
    return cached;
  }

  // Fallback to Sheets
  const data = await sheetFetchFn();

  // Save to Firebase cache
  setCache(pin, cacheKey, data);

  return data;
}

async function writeAndInvalidate(pin, cacheKeys, sheetWriteFn) {
  // Write to Sheets first (source of truth)
  const result = await sheetWriteFn();

  // Invalidate relevant caches so next read fetches fresh data
  for (const key of cacheKeys) {
    invalidateCache(pin, key);
  }

  return result;
}

export { initFirebase, isReady, cachedFetch, writeAndInvalidate, setCache, invalidateCache };
