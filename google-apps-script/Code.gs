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

      default:
        return jsonResponse({ error: 'Unknown action' });
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
      ['Name', 'LoanAmount', 'EMI', 'StartDate', 'TenureMonths'], []);
  }
  sheet.appendRow([
    data.name || '',
    parseFloat(data.loanAmount) || 0,
    parseFloat(data.emi) || 0,
    data.startDate || '',
    parseInt(data.tenureMonths) || 0
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

// ============================================
// INITIAL SETUP - Run once
// ============================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetIfNotExists(ss, 'Accounts',
    ['Account', 'Type', 'OpeningBalance'],
    [
      ['HDFC', 'Savings', '0'],
      ['ICICI', 'Savings', '0'],
      ['SBI', 'Savings', '0'],
      ['CreditCard', 'Credit', '0']
    ]
  );

  createSheetIfNotExists(ss, 'EMI',
    ['Name', 'LoanAmount', 'EMI', 'StartDate', 'TenureMonths'],
    [
      ['Sample Loan', '500000', '15000', '2025-01-01', '36']
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
