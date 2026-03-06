// Firebase as primary database
// Reads/writes go to Firebase first (fast)
// Sheets is synced in background (backup)

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

function docRef(pin, key) {
  return db.collection('users').doc(pin).collection('data').doc(key);
}

// -- Core read/write --

async function getData(pin, key) {
  if (!isReady()) return null;
  try {
    const doc = await docRef(pin, key).get();
    return doc.exists ? doc.data().value : null;
  } catch (err) {
    console.warn('Firebase read failed:', err.message);
    return null;
  }
}

async function setData(pin, key, value) {
  if (!isReady()) return;
  try {
    await docRef(pin, key).set({ value, updatedAt: Date.now() });
  } catch (err) {
    console.warn('Firebase write failed:', err.message);
  }
}

// -- Public API --

// Read from Firebase. If empty, seed from Sheets.
async function primaryFetch(pin, key, sheetFetchFn) {
  const stored = await getData(pin, key);
  if (stored !== null) return stored;

  // First time — seed from Sheets
  const data = await sheetFetchFn();
  setData(pin, key, data);
  return data;
}

// Optimistic write: update Firebase immediately, sync Sheets in background
async function optimisticWrite(pin, key, currentData, newItem, sheetWriteFn) {
  // 1. Update Firebase immediately with new item appended
  const updated = [...currentData, newItem];
  await setData(pin, key, updated);

  // 2. Write to Sheets in background (backup) — don't block UI
  sheetWriteFn().catch(err => console.warn('Sheet backup failed:', err.message));

  return updated;
}

// For operations that modify existing data (edit/delete), we can't easily do optimistic.
// Write to Sheets first, then refresh Firebase from Sheets.
async function writeAndRefresh(pin, keysAndFetchers, sheetWriteFn) {
  const result = await sheetWriteFn();

  // Refresh Firebase in background
  for (const { key, fetchFn } of keysAndFetchers) {
    fetchFn().then(fresh => setData(pin, key, fresh)).catch(() => {});
  }

  return result;
}

// Force sync from Sheets to Firebase
async function syncFromSheets(pin, key, sheetFetchFn) {
  const data = await sheetFetchFn();
  await setData(pin, key, data);
  return data;
}

export { initFirebase, isReady, primaryFetch, optimisticWrite, writeAndRefresh, syncFromSheets, getData, setData };
