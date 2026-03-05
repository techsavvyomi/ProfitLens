import { CONFIG, getPin, clearPin } from './config.js';

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.WEBAPP_URL);
  url.searchParams.set('pin', getPin());
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString());
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

  const response = await fetch(CONFIG.WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (data.error === 'unauthorized') {
    clearPin();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  if (data.error) throw new Error(data.error);
  return data;
}

async function fetchMonthlyExpenses(sheetName) {
  const data = await apiGet('fetch', { sheet: sheetName });
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

async function fetchAccounts() {
  const data = await apiGet('accounts');
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    account: row.Account || '',
    type: row.Type || '',
    openingBalance: parseFloat(row.OpeningBalance) || 0
  }));
}

async function fetchEMI() {
  const data = await apiGet('emi');
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    name: row.Name || '',
    loanAmount: parseFloat(row.LoanAmount) || 0,
    emi: parseFloat(row.EMI) || 0,
    startDate: row.StartDate || '',
    tenureMonths: parseInt(row.TenureMonths) || 0
  }));
}

async function fetchSIP() {
  const data = await apiGet('sip');
  if (!Array.isArray(data)) return [];
  return data.map(row => ({
    fund: row.Fund || '',
    monthlyAmount: parseFloat(row.MonthlyAmount) || 0,
    startDate: row.StartDate || ''
  }));
}

async function submitExpense(expenseData) {
  return apiPost({
    action: 'addExpense',
    ...expenseData
  });
}

async function submitEMI(emiData) {
  return apiPost({
    action: 'addEMI',
    ...emiData
  });
}

async function deleteEMI(rowIndex) {
  return apiPost({
    action: 'deleteEMI',
    rowIndex
  });
}

async function submitSIP(sipData) {
  return apiPost({
    action: 'addSIP',
    ...sipData
  });
}

async function deleteSIP(rowIndex) {
  return apiPost({
    action: 'deleteSIP',
    rowIndex
  });
}

async function updateExpense(data) {
  return apiPost({
    action: 'updateExpense',
    ...data
  });
}

async function deleteExpenseEntry(sheet, rowIndex) {
  return apiPost({
    action: 'deleteExpense',
    sheet,
    rowIndex
  });
}

async function verifyLogin(pin) {
  const url = new URL(CONFIG.WEBAPP_URL);
  url.searchParams.set('pin', pin);
  url.searchParams.set('action', 'ping');

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error === 'unauthorized') return false;
  return data.status === 'ok';
}

export { fetchMonthlyExpenses, fetchAccounts, fetchEMI, fetchSIP, submitExpense, submitEMI, deleteEMI, submitSIP, deleteSIP, updateExpense, deleteExpenseEntry, verifyLogin };
