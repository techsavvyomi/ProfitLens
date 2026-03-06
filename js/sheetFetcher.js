import { CONFIG, getPin, clearPin } from './config.js';
import { initFirebase, isReady as isFirebaseReady, cachedFetch, writeAndInvalidate } from './firebaseStore.js';

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

// -- Raw Sheet fetchers (used directly and as Firebase fallbacks) --

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

async function sheetFetchExpenses(sheetName) {
  const data = await apiGet('fetch', { sheet: sheetName });
  return parseExpenses(data);
}

async function sheetFetchAccounts() {
  const data = await apiGet('accounts');
  return parseAccounts(data);
}

async function sheetFetchEMI() {
  const data = await apiGet('emi');
  return parseEMI(data);
}

async function sheetFetchSIP() {
  const data = await apiGet('sip');
  return parseSIP(data);
}

// -- Public fetch functions (Firebase-cached when available) --

async function fetchMonthlyExpenses(sheetName) {
  if (isFirebaseReady()) {
    return cachedFetch(getPin(), `expenses_${sheetName}`, () => sheetFetchExpenses(sheetName));
  }
  return sheetFetchExpenses(sheetName);
}

async function fetchAccounts() {
  if (isFirebaseReady()) {
    return cachedFetch(getPin(), 'accounts', () => sheetFetchAccounts());
  }
  return sheetFetchAccounts();
}

async function fetchEMI() {
  if (isFirebaseReady()) {
    return cachedFetch(getPin(), 'emi', () => sheetFetchEMI());
  }
  return sheetFetchEMI();
}

async function fetchSIP() {
  if (isFirebaseReady()) {
    return cachedFetch(getPin(), 'sip', () => sheetFetchSIP());
  }
  return sheetFetchSIP();
}

// -- Write functions (write to Sheets + invalidate Firebase cache) --

async function submitExpense(expenseData) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['accounts'], () =>
      apiPost({ action: 'addExpense', ...expenseData })
    );
  }
  return apiPost({ action: 'addExpense', ...expenseData });
}

async function submitEMI(emiData) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['emi'], () =>
      apiPost({ action: 'addEMI', ...emiData })
    );
  }
  return apiPost({ action: 'addEMI', ...emiData });
}

async function updateEMI(emiData) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['emi'], () =>
      apiPost({ action: 'updateEMI', ...emiData })
    );
  }
  return apiPost({ action: 'updateEMI', ...emiData });
}

async function deleteEMI(rowIndex) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['emi'], () =>
      apiPost({ action: 'deleteEMI', rowIndex })
    );
  }
  return apiPost({ action: 'deleteEMI', rowIndex });
}

async function submitTransfer(transferData) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['accounts'], () =>
      apiPost({ action: 'addTransfer', ...transferData })
    );
  }
  return apiPost({ action: 'addTransfer', ...transferData });
}

async function submitSIP(sipData) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['sip'], () =>
      apiPost({ action: 'addSIP', ...sipData })
    );
  }
  return apiPost({ action: 'addSIP', ...sipData });
}

async function deleteSIP(rowIndex) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['sip'], () =>
      apiPost({ action: 'deleteSIP', rowIndex })
    );
  }
  return apiPost({ action: 'deleteSIP', rowIndex });
}

async function updateExpense(data) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), ['accounts'], () =>
      apiPost({ action: 'updateExpense', ...data })
    );
  }
  return apiPost({ action: 'updateExpense', ...data });
}

async function deleteExpenseEntry(sheet, rowIndex) {
  if (isFirebaseReady()) {
    return writeAndInvalidate(getPin(), [`expenses_${sheet}`, 'accounts'], () =>
      apiPost({ action: 'deleteExpense', sheet, rowIndex })
    );
  }
  return apiPost({ action: 'deleteExpense', sheet, rowIndex });
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

export { fetchMonthlyExpenses, fetchAccounts, fetchEMI, fetchSIP, submitExpense, submitEMI, updateEMI, deleteEMI, submitSIP, deleteSIP, updateExpense, deleteExpenseEntry, submitTransfer, verifyLogin };
