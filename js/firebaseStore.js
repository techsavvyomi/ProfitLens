// Firebase as primary database for fast reads
// Reads always from Firebase, seeds from Sheets if empty
// Writes go to Sheets (handles row logic) then Firebase is refreshed

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

// -- Firebase read/write --

async function getData(pin, key) {
  if (!isReady()) return null;
  try {
    const doc = await db.collection('users').doc(pin).collection('data').doc(key).get();
    if (doc.exists) {
      return doc.data().value;
    }
    return null;
  } catch (err) {
    console.warn('Firebase read failed:', err.message);
    return null;
  }
}

async function setData(pin, key, value) {
  if (!isReady()) return;
  try {
    await db.collection('users').doc(pin).collection('data').doc(key).set({
      value: value,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn('Firebase write failed:', err.message);
  }
}

// -- Public API --

// Read from Firebase first. If empty, seed from Sheets and store in Firebase.
async function primaryFetch(pin, key, sheetFetchFn) {
  const stored = await getData(pin, key);
  if (stored !== null) {
    return stored;
  }

  // Firebase empty for this key — seed from Sheets
  const data = await sheetFetchFn();
  setData(pin, key, data); // don't await, save in background
  return data;
}

// Write to Sheets (handles row logic), then refresh Firebase with fresh data
async function writeAndSync(pin, keysToRefresh, sheetWriteFn, sheetFetchFns) {
  // Write to Sheets first (it manages rows/indexes)
  const result = await sheetWriteFn();

  // Refresh Firebase with fresh data from Sheets (in background)
  for (let i = 0; i < keysToRefresh.length; i++) {
    const key = keysToRefresh[i];
    const fetchFn = sheetFetchFns[i];
    fetchFn().then(fresh => setData(pin, key, fresh)).catch(() => {});
  }

  return result;
}

// Force refresh a key from Sheets into Firebase
async function syncFromSheets(pin, key, sheetFetchFn) {
  const data = await sheetFetchFn();
  await setData(pin, key, data);
  return data;
}

export { initFirebase, isReady, primaryFetch, writeAndSync, syncFromSheets, setData };
