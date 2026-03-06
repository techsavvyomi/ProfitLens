import { CONFIG, getPin, clearPin } from './config.js';
import { initFirebase, isReady as isFirebaseReady, primaryFetch, writeAndSync, syncFromSheets } from './firebaseStore.js';

// Initialize Firebase if config is present
if (CONFIG.FIREBASE && CONFIG.FIREBASE.apiKey && !CONFIG.FIREBASE.apiKey.startsWith('__')) {
  initFirebase(CONFIG.FIREBASE);
}

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.WEBAPP_URL);
  url.searchParams.set('pin', getPin());
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString(), { redirect: 'follow' });
  const data = await response.json();

  if (data.error === 'unauthorized') {
    clearPin();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  if (data.error) throw new Error(data.error);
  return data;
}

async function apiPost(body) {
  body.pin = getPin();

  const url = new URL(CONFIG.WEBAPP_URL);
  url.searchParams.set('pin', getPin());
  url.searchParams.set('action', 'write');
  url.searchParams.set('payload', JSON.stringify(body));

  const response = await fetch(url.toString(), { redirect: 'follow' });
  const data = await response.json();

  if (data.error === 'unauthorized') {
    clearPin();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  if (data.error) throw new Error(data.error);
  return data;
}

// -- Sheet fetchers (used to seed Firebase and as fallback) --

function parseExpenses(data) {
  if (!Array.isArray(data)) return [];
  return data.map((row, index) => ({
    rowIndex: index,
    date: row.Date || '',
    category: row.Category || '',
    subCategory: row.SubCategory || '',
    account: row.Account || '',
    amount: parseFloat(row.Amount) || 0,
    type: row.Type || '',
    notes: row.Notes || ''
  }));
}

function parseAccounts(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    account: row.Account || '',
    type: row.Type || '',
    openingBalance: parseFloat(row.OpeningBalance) || 0
  }));
}

function parseEMI(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    name: row.Name || '',
    loanAmount: parseFloat(row.LoanAmount) || 0,
    emi: parseFloat(row.EMI) || 0,
    startDate: row.StartDate || '',
    tenureMonths: parseInt(row.TenureMonths) || 0,
    deductionDay: row.DeductionDay || '',
    account: row.Account || ''
  }));
}

function parseSIP(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    fund: row.Fund || '',
    monthlyAmount: parseFloat(row.MonthlyAmount) || 0,
    startDate: row.StartDate || ''
  }));
}

function sheetFetchExpenses(sheetName) {
  return apiGet('fetch', { sheet: sheetName }).then(parseExpenses);
}

function sheetFetchAccounts() {
  return apiGet('accounts').then(parseAccounts);
}

function sheetFetchEMI() {
  return apiGet('emi').then(parseEMI);
}

function sheetFetchSIP() {
  return apiGet('sip').then(parseSIP);
}

// -- Public fetch functions (Firebase-primary, Sheets fallback) --

async function fetchMonthlyExpenses(sheetName) {
  if (isFirebaseReady()) {
    return primaryFetch(getPin(), `expenses_${sheetName}`, () => sheetFetchExpenses(sheetName));
  }
  return sheetFetchExpenses(sheetName);
}

async function fetchAccounts() {
  if (isFirebaseReady()) {
    return primaryFetch(getPin(), 'accounts', sheetFetchAccounts);
  }
  return sheetFetchAccounts();
}

async function fetchEMI() {
  if (isFirebaseReady()) {
    return primaryFetch(getPin(), 'emi', sheetFetchEMI);
  }
  return sheetFetchEMI();
}

async function fetchSIP() {
  if (isFirebaseReady()) {
    return primaryFetch(getPin(), 'sip', sheetFetchSIP);
  }
  return sheetFetchSIP();
}

// -- Write functions (write to Sheets, then sync fresh data to Firebase) --

async function submitExpense(expenseData) {
  const sheetName = expenseData.sheet;
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(),
      [`expenses_${sheetName}`, 'accounts'],
      () => apiPost({ action: 'addExpense', ...expenseData }),
      [() => sheetFetchExpenses(sheetName), sheetFetchAccounts]
    );
  }
  return apiPost({ action: 'addExpense', ...expenseData });
}

async function submitEMI(emiData) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(), ['emi'],
      () => apiPost({ action: 'addEMI', ...emiData }),
      [sheetFetchEMI]
    );
  }
  return apiPost({ action: 'addEMI', ...emiData });
}

async function updateEMI(emiData) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(), ['emi'],
      () => apiPost({ action: 'updateEMI', ...emiData }),
      [sheetFetchEMI]
    );
  }
  return apiPost({ action: 'updateEMI', ...emiData });
}

async function deleteEMI(rowIndex) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(), ['emi'],
      () => apiPost({ action: 'deleteEMI', rowIndex }),
      [sheetFetchEMI]
    );
  }
  return apiPost({ action: 'deleteEMI', rowIndex });
}

async function submitTransfer(transferData) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(), ['accounts'],
      () => apiPost({ action: 'addTransfer', ...transferData }),
      [sheetFetchAccounts]
    );
  }
  return apiPost({ action: 'addTransfer', ...transferData });
}

async function submitSIP(sipData) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(), ['sip'],
      () => apiPost({ action: 'addSIP', ...sipData }),
      [sheetFetchSIP]
    );
  }
  return apiPost({ action: 'addSIP', ...sipData });
}

async function deleteSIP(rowIndex) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(), ['sip'],
      () => apiPost({ action: 'deleteSIP', rowIndex }),
      [sheetFetchSIP]
    );
  }
  return apiPost({ action: 'deleteSIP', rowIndex });
}

async function updateExpense(data) {
  const sheetName = data.sheet;
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(),
      [`expenses_${sheetName}`, 'accounts'],
      () => apiPost({ action: 'updateExpense', ...data }),
      [() => sheetFetchExpenses(sheetName), sheetFetchAccounts]
    );
  }
  return apiPost({ action: 'updateExpense', ...data });
}

async function deleteExpenseEntry(sheet, rowIndex) {
  if (isFirebaseReady()) {
    return writeAndSync(
      getPin(),
      [`expenses_${sheet}`, 'accounts'],
      () => apiPost({ action: 'deleteExpense', sheet, rowIndex }),
      [() => sheetFetchExpenses(sheet), sheetFetchAccounts]
    );
  }
  return apiPost({ action: 'deleteExpense', sheet, rowIndex });
}

// Force sync all data from Sheets to Firebase (used by refresh button)
async function forceSyncAll(sheetName) {
  if (!isFirebaseReady()) return;
  const pin = getPin();
  await Promise.all([
    syncFromSheets(pin, `expenses_${sheetName}`, () => sheetFetchExpenses(sheetName)),
    syncFromSheets(pin, 'accounts', sheetFetchAccounts),
    syncFromSheets(pin, 'emi', sheetFetchEMI),
    syncFromSheets(pin, 'sip', sheetFetchSIP)
  ]);
}

async function verifyLogin(pin) {
  const url = new URL(CONFIG.WEBAPP_URL);
  url.searchParams.set('pin', pin);
  url.searchParams.set('action', 'ping');

  const response = await fetch(url.toString(), { redirect: 'follow' });
  const data = await response.json();

  if (data.error === 'unauthorized') return false;
  return data.status === 'ok';
}

export { fetchMonthlyExpenses, fetchAccounts, fetchEMI, fetchSIP, submitExpense, submitEMI, updateEMI, deleteEMI, submitSIP, deleteSIP, updateExpense, deleteExpenseEntry, submitTransfer, forceSyncAll, verifyLogin };
