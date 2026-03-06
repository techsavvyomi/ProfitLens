import { CONFIG, getPin, clearPin } from './config.js';
import { initFirebase, isReady as isFirebaseReady, primaryFetch, optimisticWrite, writeAndRefresh, syncFromSheets, getData } from './firebaseStore.js';

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

// -- Sheet fetchers (seed Firebase, fallback, refresh) --

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

// -- Public fetch (Firebase-primary) --

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

// -- Optimistic writes (Firebase instant, Sheets in background) --

async function submitExpense(expenseData) {
  if (isFirebaseReady()) {
    const pin = getPin();
    const sheetName = expenseData.sheet;
    const key = `expenses_${sheetName}`;
    const current = (await getData(pin, key)) || [];

    const newItem = {
      rowIndex: current.length,
      date: expenseData.date,
      category: expenseData.category,
      subCategory: expenseData.subCategory || '',
      account: expenseData.account || '',
      amount: parseFloat(expenseData.amount) || 0,
      type: expenseData.type || 'Expense',
      notes: expenseData.notes || ''
    };

    await optimisticWrite(pin, key, current, newItem,
      () => apiPost({ action: 'addExpense', ...expenseData })
    );
    return { success: true };
  }
  return apiPost({ action: 'addExpense', ...expenseData });
}

async function submitEMI(emiData) {
  if (isFirebaseReady()) {
    const pin = getPin();
    const current = (await getData(pin, 'emi')) || [];

    const newItem = {
      name: emiData.name,
      loanAmount: parseFloat(emiData.loanAmount) || 0,
      emi: parseFloat(emiData.emi) || 0,
      startDate: emiData.startDate || '',
      tenureMonths: parseInt(emiData.tenureMonths) || 0,
      deductionDay: emiData.deductionDay || '',
      account: emiData.account || ''
    };

    await optimisticWrite(pin, 'emi', current, newItem,
      () => apiPost({ action: 'addEMI', ...emiData })
    );
    return { success: true };
  }
  return apiPost({ action: 'addEMI', ...emiData });
}

async function submitSIP(sipData) {
  if (isFirebaseReady()) {
    const pin = getPin();
    const current = (await getData(pin, 'sip')) || [];

    const newItem = {
      fund: sipData.fund,
      monthlyAmount: parseFloat(sipData.monthlyAmount) || 0,
      startDate: sipData.startDate || ''
    };

    await optimisticWrite(pin, 'sip', current, newItem,
      () => apiPost({ action: 'addSIP', ...sipData })
    );
    return { success: true };
  }
  return apiPost({ action: 'addSIP', ...sipData });
}

async function submitTransfer(transferData) {
  if (isFirebaseReady()) {
    // Transfers affect accounts — write to Sheets, then refresh accounts from Sheets
    return writeAndRefresh(getPin(),
      [{ key: 'accounts', fetchFn: sheetFetchAccounts }],
      () => apiPost({ action: 'addTransfer', ...transferData })
    );
  }
  return apiPost({ action: 'addTransfer', ...transferData });
}

// -- Edit/Delete (need Sheets for row logic, then refresh Firebase) --

async function updateEMI(emiData) {
  if (isFirebaseReady()) {
    return writeAndRefresh(getPin(),
      [{ key: 'emi', fetchFn: sheetFetchEMI }],
      () => apiPost({ action: 'updateEMI', ...emiData })
    );
  }
  return apiPost({ action: 'updateEMI', ...emiData });
}

async function deleteEMI(rowIndex) {
  if (isFirebaseReady()) {
    return writeAndRefresh(getPin(),
      [{ key: 'emi', fetchFn: sheetFetchEMI }],
      () => apiPost({ action: 'deleteEMI', rowIndex })
    );
  }
  return apiPost({ action: 'deleteEMI', rowIndex });
}

async function deleteSIP(rowIndex) {
  if (isFirebaseReady()) {
    return writeAndRefresh(getPin(),
      [{ key: 'sip', fetchFn: sheetFetchSIP }],
      () => apiPost({ action: 'deleteSIP', rowIndex })
    );
  }
  return apiPost({ action: 'deleteSIP', rowIndex });
}

async function updateExpense(data) {
  const sheetName = data.sheet;
  if (isFirebaseReady()) {
    return writeAndRefresh(getPin(),
      [
        { key: `expenses_${sheetName}`, fetchFn: () => sheetFetchExpenses(sheetName) },
        { key: 'accounts', fetchFn: sheetFetchAccounts }
      ],
      () => apiPost({ action: 'updateExpense', ...data })
    );
  }
  return apiPost({ action: 'updateExpense', ...data });
}

async function deleteExpenseEntry(sheet, rowIndex) {
  if (isFirebaseReady()) {
    return writeAndRefresh(getPin(),
      [
        { key: `expenses_${sheet}`, fetchFn: () => sheetFetchExpenses(sheet) },
        { key: 'accounts', fetchFn: sheetFetchAccounts }
      ],
      () => apiPost({ action: 'deleteExpense', sheet, rowIndex })
    );
  }
  return apiPost({ action: 'deleteExpense', sheet, rowIndex });
}

// Force sync all data from Sheets → Firebase (refresh button)
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
