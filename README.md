# ProfitLens

A personal finance tracker PWA powered by Google Sheets as the backend. Track expenses, income, EMIs, investments, and account balances — all from your phone.

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Backend:** Google Apps Script (Web App)
- **Database:** Google Sheets
- **Charts:** Chart.js
- **Auth:** PIN-based authentication via Google Apps Script
- **PWA:** Service Worker + Web App Manifest for installable mobile experience

## Features

### Expense & Income Tracking
- Quick-add form with category chips (customizable)
- Toggle between Expense and Income entry
- Sub-category, account selection, and notes support
- Edit and delete transactions inline

### Dashboard
- Monthly summary cards — Expense, Income, EMI, Investment totals
- Account balances computed from opening balance + transactions
- Expense distribution pie chart
- Monthly trend line chart
- Category comparison bar chart (current vs previous month)
- AI-generated spending insights
- Recent transactions table with edit/delete
- Month selector to view historical data

### EMI Tracker
- Add loans with name, amount, EMI, start date, and tenure
- EMI deduction day (1-31) to specify when payment is debited
- Debit account selection — shows account name and current balance
- Remaining amount calculated correctly based on EMI schedule
- Progress bar showing repayment percentage
- Advance reminder banner 2 days before EMI deduction date
- Edit and delete EMI entries

### Internal Transfers
- Record money movement between accounts
- Select source and destination accounts
- Dashboard balances update after transfer

### Investment / SIP Tracker
- Track SIP entries with fund name, monthly amount, and start date
- Add and delete SIP records

### Other
- Dark mode with persistent preference
- PIN-locked access
- Installable as PWA on mobile (home screen icon, offline shell)
- Auto-refresh dashboard at configurable interval
- Mobile-first responsive design (max 600px on desktop)
- CORS-safe: all writes routed through GET to avoid redirect issues on mobile

## Project Structure

```
├── index.html              # Home — expense entry + dashboard
├── emi.html                # EMI tracker page
├── investments.html        # SIP/Investment tracker page
├── css/
│   └── styles.css          # All styles (light + dark theme)
├── js/
│   ├── config.js           # App config, helpers (gitignored)
│   ├── config.example.js   # Template for config.js
│   ├── app.js              # Home page logic
│   ├── dashboard.js        # Summary calculations, account balances
│   ├── charts.js           # Chart.js rendering
│   ├── insights.js         # Spending insight generation
│   ├── emi.js              # EMI calculation + card rendering
│   ├── emiPage.js          # EMI page form/edit/delete handlers
│   ├── investments.js      # SIP calculation + rendering
│   ├── investmentsPage.js  # SIP page handlers
│   ├── sheetFetcher.js     # All API calls to Google Apps Script
│   └── auth.js             # PIN login flow
├── sw.js                   # Service worker
├── manifest.json           # PWA manifest
├── icons/                  # App icons
├── build.sh                # Build script for deployment
└── .gitignore
```

## Setup

1. Create a Google Sheet with these sheets:
   - Monthly sheets (e.g. `Mar-2026`) — columns: `Date`, `Category`, `SubCategory`, `Account`, `Amount`, `Type`, `Notes`
   - `Accounts` — columns: `Account`, `Type`, `OpeningBalance`
   - `EMI` — columns: `Name`, `LoanAmount`, `EMI`, `StartDate`, `TenureMonths`, `DeductionDay`, `Account`
   - `SIP` — columns: `Fund`, `MonthlyAmount`, `StartDate`

2. Deploy `Code.gs` as a Google Apps Script Web App (execute as yourself, access by anyone).

3. Copy `js/config.example.js` to `js/config.js` and set your `WEBAPP_URL`.

4. Serve the files (any static host — GitHub Pages, Netlify, Vercel, etc.).

## Google Apps Script Actions

The backend handles these actions via query parameters:

| Action | Method | Description |
|---|---|---|
| `ping` | GET | Auth check |
| `fetch` | GET | Fetch monthly transactions |
| `accounts` | GET | Fetch account list |
| `emi` | GET | Fetch EMI entries |
| `sip` | GET | Fetch SIP entries |
| `addExpense` | GET (write) | Add expense/income row |
| `addEMI` | GET (write) | Add EMI entry |
| `updateEMI` | GET (write) | Update EMI entry by row index |
| `deleteEMI` | GET (write) | Delete EMI entry by row index |
| `addSIP` | GET (write) | Add SIP entry |
| `deleteSIP` | GET (write) | Delete SIP entry by row index |
| `updateExpense` | GET (write) | Update transaction by row index |
| `deleteExpense` | GET (write) | Delete transaction by row index |
| `addTransfer` | GET (write) | Record internal transfer between accounts |

> All writes use GET with a `payload` query param to bypass CORS/redirect issues on mobile browsers.

## License

MIT
