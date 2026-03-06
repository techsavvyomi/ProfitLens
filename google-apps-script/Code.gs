/**
 * Google Apps Script for Personal Expense Dashboard
 *
 * SETUP:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this entire code
 * 4. Go to Project Settings (gear icon) > Script Properties
 *    Add property: APP_PIN = your-secret-pin (e.g. 1234)
 * 5. Save and run setupSpreadsheet() once to create all sheets
 * 6. Deploy > New Deployment > Web App
 *    Execute as: Me | Access: Anyone
 * 7. Copy the Web App URL and paste into js/config.js as WEBAPP_URL
 * 8. Run createMonthlyTrigger() for auto monthly sheets
 */

// ============================================
// AUTH HELPER
// ============================================

function verifyPin(pin) {
  const storedPin = PropertiesService.getScriptProperties().getProperty('APP_PIN');
  if (!storedPin) return true; // no pin set = allow (for first-time setup)
  return pin === storedPin;
}

function authError() {
  return ContentService.createTextOutput(
    JSON.stringify({ error: 'unauthorized' })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// WEB APP ENDPOINTS
// ============================================

function doGet(e) {
  const pin = (e.parameter && e.parameter.pin) || '';
  if (!verifyPin(pin)) return authError();

  const action = (e.parameter && e.parameter.action) || 'ping';
  const sheet = (e.parameter && e.parameter.sheet) || '';

  try {
    switch (action) {
      case 'ping':
        return jsonResponse({ status: 'ok' });

      case 'fetch':
        if (!sheet) return jsonResponse({ error: 'Missing sheet parameter' });
        return jsonResponse(getSheetData(sheet));

      case 'accounts':
        return jsonResponse(getSheetData('Accounts'));

      case 'emi':
        return jsonResponse(getSheetData('EMI'));

      case 'sip':
        return jsonResponse(getSheetData('SIP'));

      case 'write':
        var result = handleWrite(e.parameter.payload);
        try { updateCurrentBalances(); } catch(ignore) {}
        return result;

      case 'updateBalances':
        updateCurrentBalances();
        return jsonResponse({ status: 'ok' });

      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const pin = data.pin || '';
    if (!verifyPin(pin)) return authError();

    const action = data.action || 'addExpense';

    switch (action) {
      case 'addExpense':
        addExpenseRow(data);
        return jsonResponse({ status: 'ok' });

      case 'addEMI':
        addEMIRow(data);
        return jsonResponse({ status: 'ok' });

      case 'deleteEMI':
        deleteSheetRow('EMI', parseInt(data.rowIndex));
        return jsonResponse({ status: 'ok' });

      case 'addSIP':
        addSIPRow(data);
        return jsonResponse({ status: 'ok' });

      case 'deleteSIP':
        deleteSheetRow('SIP', parseInt(data.rowIndex));
        return jsonResponse({ status: 'ok' });

      case 'updateExpense':
        updateExpenseRow(data);
        return jsonResponse({ status: 'ok' });

      case 'deleteExpense':
        deleteExpenseRow(data);
        return jsonResponse({ status: 'ok' });

      case 'updateEMI':
        updateEMIRow(data);
        return jsonResponse({ status: 'ok' });

      case 'addTransfer':
        addTransferRow(data);
        return jsonResponse({ status: 'ok' });

      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function handleWrite(payload) {
  try {
    var data = JSON.parse(payload);
    var writeAction = data.action || 'addExpense';

    switch (writeAction) {
      case 'addExpense':
        addExpenseRow(data);
        return jsonResponse({ status: 'ok' });

      case 'addEMI':
        addEMIRow(data);
        return jsonResponse({ status: 'ok' });

      case 'deleteEMI':
        deleteSheetRow('EMI', parseInt(data.rowIndex));
        return jsonResponse({ status: 'ok' });

      case 'addSIP':
        addSIPRow(data);
        return jsonResponse({ status: 'ok' });

      case 'deleteSIP':
        deleteSheetRow('SIP', parseInt(data.rowIndex));
        return jsonResponse({ status: 'ok' });

      case 'updateExpense':
        updateExpenseRow(data);
        return jsonResponse({ status: 'ok' });

      case 'deleteExpense':
        deleteExpenseRow(data);
        return jsonResponse({ status: 'ok' });

      case 'updateEMI':
        updateEMIRow(data);
        return jsonResponse({ status: 'ok' });

      case 'addTransfer':
        addTransferRow(data);
        return jsonResponse({ status: 'ok' });

      default:
        return jsonResponse({ error: 'Unknown write action: ' + writeAction });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(
    JSON.stringify(obj)
  ).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// DATA READING
// ============================================

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // Convert Date objects to string
      if (val instanceof Date) {
        const dd = String(val.getDate()).padStart(2, '0');
        const mm = String(val.getMonth() + 1).padStart(2, '0');
        const yyyy = val.getFullYear();
        val = dd + '/' + mm + '/' + yyyy;
      }
      obj[h] = val;
    });
    return obj;
  });
}

// ============================================
// DATA WRITING
// ============================================

function addExpenseRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const monthName = getCurrentMonthName();
  let sheet = ss.getSheetByName(monthName);

  if (!sheet) {
    sheet = createExpenseSheet(ss, monthName);
  }

  sheet.appendRow([
    data.date,
    data.category,
    data.subCategory || '',
    data.account || '',
    parseFloat(data.amount) || 0,
    data.type || 'Expense',
    data.notes || ''
  ]);
}

function addEMIRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('EMI');
  if (!sheet) {
    sheet = createSheetIfNotExists(ss, 'EMI',
      ['Name', 'LoanAmount', 'EMI', 'StartDate', 'TenureMonths', 'DeductionDay', 'Account'], []);
  }
  sheet.appendRow([
    data.name || '',
    parseFloat(data.loanAmount) || 0,
    parseFloat(data.emi) || 0,
    data.startDate || '',
    parseInt(data.tenureMonths) || 0,
    data.deductionDay || '',
    data.account || ''
  ]);
}

function addSIPRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SIP');
  if (!sheet) {
    sheet = createSheetIfNotExists(ss, 'SIP',
      ['Fund', 'MonthlyAmount', 'StartDate'], []);
  }
  sheet.appendRow([
    data.fund || '',
    parseFloat(data.monthlyAmount) || 0,
    data.startDate || ''
  ]);
}

function updateExpenseRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.sheet);
  if (!sheet) throw new Error('Sheet not found: ' + data.sheet);
  var actualRow = parseInt(data.rowIndex) + 2;
  if (actualRow < 2 || actualRow > sheet.getLastRow()) {
    throw new Error('Invalid row index');
  }
  sheet.getRange(actualRow, 1, 1, 7).setValues([[
    data.date || '',
    data.category || '',
    data.subCategory || '',
    data.account || '',
    parseFloat(data.amount) || 0,
    data.type || 'Expense',
    data.notes || ''
  ]]);
}

function deleteExpenseRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.sheet);
  if (!sheet) throw new Error('Sheet not found: ' + data.sheet);
  var actualRow = parseInt(data.rowIndex) + 2;
  if (actualRow < 2 || actualRow > sheet.getLastRow()) {
    throw new Error('Invalid row index');
  }
  sheet.deleteRow(actualRow);
}

function deleteSheetRow(sheetName, rowIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  // rowIndex is 0-based data row, +2 for header offset
  const actualRow = rowIndex + 2;
  if (actualRow < 2 || actualRow > sheet.getLastRow()) {
    throw new Error('Invalid row index');
  }
  sheet.deleteRow(actualRow);
}

function updateEMIRow(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EMI');
  if (!sheet) throw new Error('EMI sheet not found');
  var actualRow = parseInt(data.rowIndex) + 2;
  if (actualRow < 2 || actualRow > sheet.getLastRow()) {
    throw new Error('Invalid row index');
  }
  sheet.getRange(actualRow, 1, 1, 7).setValues([[
    data.name || '',
    parseFloat(data.loanAmount) || 0,
    parseFloat(data.emi) || 0,
    data.startDate || '',
    parseInt(data.tenureMonths) || 0,
    data.deductionDay || '',
    data.account || ''
  ]]);
}

function addTransferRow(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var monthName = getCurrentMonthName();
  var sheet = ss.getSheetByName(monthName);
  if (!sheet) sheet = createExpenseSheet(ss, monthName);

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var amount = parseFloat(data.amount) || 0;
  var notes = data.notes || '';

  // Debit from source account
  sheet.appendRow([
    today, 'Transfer', 'To ' + data.toAccount, data.fromAccount,
    amount, 'Expense', notes ? notes : 'Transfer to ' + data.toAccount
  ]);

  // Credit to destination account
  sheet.appendRow([
    today, 'Transfer', 'From ' + data.fromAccount, data.toAccount,
    amount, 'Income', notes ? notes : 'Transfer from ' + data.fromAccount
  ]);
}

// ============================================
// CURRENT BALANCE COMPUTATION
// ============================================

function updateCurrentBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var accountsSheet = ss.getSheetByName('Accounts');
  if (!accountsSheet) return;

  var lastRow = accountsSheet.getLastRow();
  if (lastRow < 2) return;

  var headers = accountsSheet.getRange(1, 1, 1, accountsSheet.getLastColumn()).getValues()[0];

  // Ensure CurrentBalance and LastUpdated columns exist
  var cbCol = headers.indexOf('CurrentBalance');
  var luCol = headers.indexOf('LastUpdated');
  if (cbCol === -1) {
    cbCol = headers.length;
    accountsSheet.getRange(1, cbCol + 1).setValue('CurrentBalance');
  }
  if (luCol === -1) {
    luCol = Math.max(cbCol + 1, headers.length);
    accountsSheet.getRange(1, luCol + 1).setValue('LastUpdated');
  }

  // Read accounts
  var accountData = accountsSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  var balances = {};
  accountData.forEach(function(row) {
    balances[row[0]] = parseFloat(row[2]) || 0; // Start with OpeningBalance
  });

  // Read all monthly expense sheets and compute balances
  var sheets = ss.getSheets();
  var monthPattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (!monthPattern.test(name)) return;

    var sLastRow = sheet.getLastRow();
    if (sLastRow < 2) return;

    var data = sheet.getRange(2, 1, sLastRow - 1, 7).getValues();
    data.forEach(function(row) {
      var account = row[3]; // Account column
      var amount = parseFloat(row[4]) || 0;
      var type = (row[5] || '').toString().toLowerCase();

      if (!account || !balances.hasOwnProperty(account)) return;

      if (type === 'expense') {
        balances[account] -= amount;
      } else if (type === 'income' || type === 'credit') {
        balances[account] += amount;
      }
    });
  });

  // Write current balances and timestamp
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  for (var i = 0; i < accountData.length; i++) {
    var accName = accountData[i][0];
    var bal = balances[accName] || 0;
    accountsSheet.getRange(i + 2, cbCol + 1).setValue(Math.round(bal * 100) / 100);
    accountsSheet.getRange(i + 2, luCol + 1).setValue(now);
  }

  // Format columns
  accountsSheet.getRange(2, cbCol + 1, accountData.length, 1).setNumberFormat('#,##0.00');
  accountsSheet.autoResizeColumns(cbCol + 1, 2);
}

// ============================================
// INITIAL SETUP - Run once
// ============================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetIfNotExists(ss, 'Accounts',
    ['Account', 'Type', 'OpeningBalance', 'CurrentBalance', 'LastUpdated'],
    [
      ['HDFC', 'Savings', '0', '0', ''],
      ['ICICI', 'Savings', '0', '0', ''],
      ['SBI', 'Savings', '0', '0', ''],
      ['CreditCard', 'Credit', '0', '0', '']
    ]
  );

  createSheetIfNotExists(ss, 'EMI',
    ['Name', 'LoanAmount', 'EMI', 'StartDate', 'TenureMonths', 'DeductionDay', 'Account'],
    [
      ['Sample Loan', '500000', '15000', '2025-01-01', '36', '5', 'HDFC']
    ]
  );

  createSheetIfNotExists(ss, 'SIP',
    ['Fund', 'MonthlyAmount', 'StartDate'],
    [
      ['Sample Mutual Fund', '5000', '2025-01-01']
    ]
  );

  const currentMonth = getCurrentMonthName();
  createExpenseSheet(ss, currentMonth);

  SpreadsheetApp.getUi().alert(
    'Setup Complete!\n\n' +
    'Created sheets: Accounts, EMI, SIP, ' + currentMonth + '\n\n' +
    'IMPORTANT: Go to Project Settings > Script Properties\n' +
    'Add: APP_PIN = your-secret-pin\n\n' +
    'Then Deploy as Web App (Execute as: Me, Access: Anyone)'
  );
}

// ============================================
// SHEET CREATION HELPERS
// ============================================

function createSheetIfNotExists(ss, name, headers, sampleData) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f0f0f0');

  if (sampleData && sampleData.length > 0) {
    sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
  }

  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function createExpenseSheet(ss, monthName) {
  const headers = ['Date', 'Category', 'SubCategory', 'Account', 'Amount', 'Type', 'Notes'];
  let sheet = ss.getSheetByName(monthName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(monthName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f0f0f0');

  const types = ['Expense', 'Income'];
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(types, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange('F2:F1000').setDataValidation(typeRule);

  const accountsSheet = ss.getSheetByName('Accounts');
  if (accountsSheet) {
    const lastRow = accountsSheet.getLastRow();
    if (lastRow > 1) {
      const accountRule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(accountsSheet.getRange('A2:A' + lastRow), true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange('D2:D1000').setDataValidation(accountRule);
    }
  }

  sheet.getRange('A2:A1000').setNumberFormat('dd/mm/yyyy');
  sheet.getRange('E2:E1000').setNumberFormat('#,##0.00');

  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

// ============================================
// MONTH UTILITIES
// ============================================

function getCurrentMonthName() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[now.getMonth()] + '-' + now.getFullYear();
}

function getNextMonthName() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[next.getMonth()] + '-' + next.getFullYear();
}

// ============================================
// AUTO MONTHLY SHEET CREATION
// ============================================

function createNextMonthSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nextMonth = getNextMonthName();
  createExpenseSheet(ss, nextMonth);
  Logger.log('Created sheet for: ' + nextMonth);
}

function createMonthlyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'createNextMonthSheet') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('createNextMonthSheet')
    .timeBased()
    .onMonthDay(28)
    .atHour(9)
    .create();

  SpreadsheetApp.getUi().alert(
    'Monthly trigger created!\n' +
    'A new expense sheet will be auto-created on the 28th of every month.'
  );
}

// ============================================
// CUSTOM MENU
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Expense Dashboard')
    .addItem('Initial Setup', 'setupSpreadsheet')
    .addItem('Create Next Month Sheet', 'createNextMonthSheet')
    .addItem('Set Monthly Auto-Create', 'createMonthlyTrigger')
    .addSeparator()
    .addItem('Monthly Summary', 'showMonthlySummary')
    .addItem('Update Current Balances', 'updateCurrentBalances')
    .addToUi();
}

// ============================================
// MONTHLY SUMMARY
// ============================================

function showMonthlySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const monthName = getCurrentMonthName();
  const sheet = ss.getSheetByName(monthName);

  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No data found for ' + monthName);
    return;
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();

  let totalExpense = 0;
  let totalIncome = 0;
  const categoryTotals = {};

  data.forEach(row => {
    const amount = parseFloat(row[4]) || 0;
    const type = (row[5] || '').toString().toLowerCase();
    const category = (row[1] || '').toString();

    if (type === 'expense') {
      totalExpense += amount;
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    } else if (type === 'income') {
      totalIncome += amount;
    }
  });

  let summary = 'Monthly Summary: ' + monthName + '\n\n';
  summary += 'Total Expense: Rs. ' + totalExpense.toLocaleString('en-IN') + '\n';
  summary += 'Total Income: Rs. ' + totalIncome.toLocaleString('en-IN') + '\n';
  summary += 'Net: Rs. ' + (totalIncome - totalExpense).toLocaleString('en-IN') + '\n\n';
  summary += 'Category Breakdown:\n';

  Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, amt]) => {
      const pct = Math.round((amt / totalExpense) * 100);
      summary += '  ' + cat + ': Rs. ' + amt.toLocaleString('en-IN') + ' (' + pct + '%)\n';
    });

  SpreadsheetApp.getUi().alert(summary);
}
