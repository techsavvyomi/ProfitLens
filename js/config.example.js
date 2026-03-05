// Configuration Template
// Copy this file to config.js and fill in your values
// DO NOT commit config.js to git

const CONFIG = {
  WEBAPP_URL: '__WEBAPP_URL__',
  REFRESH_INTERVAL: 500,
  CATEGORIES: [
    'Food', 'Bike', 'Home', 'EMI', 'Savings',
    'Investment', 'CreditCard', 'Utilities', 'Shopping', 'Other'
  ]
};

function getPin() {
  return sessionStorage.getItem('expense_pin') || '';
}

function setPin(pin) {
  sessionStorage.setItem('expense_pin', pin);
}

function clearPin() {
  sessionStorage.removeItem('expense_pin');
}

function isLoggedIn() {
  return !!getPin();
}

function getMonthSheetName(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]}-${date.getFullYear()}`;
}

function getPreviousMonthSheetName(date = new Date()) {
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return getMonthSheetName(prev);
}

function getRecentMonths(count = 6) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.unshift(getMonthSheetName(d));
  }
  return months;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function getTodayFormatted() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export {
  CONFIG, getPin, setPin, clearPin, isLoggedIn,
  getMonthSheetName, getPreviousMonthSheetName, getRecentMonths,
  formatCurrency, getTodayFormatted
};
