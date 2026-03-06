# ProfitLens

A personal finance tracker PWA powered by Google Sheets as the backend. Track expenses, income, EMIs, investments, and account balances — all from your phone.

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Backend:** Google Apps Script (Web App)
- **Database:** Google Sheets (source of truth)
- **Cache:** Firebase Firestore (optional, fast reads with 5-min TTL)
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
- Manual refresh button on every page
- CSV download for monthly transaction data
- Firebase Firestore caching for instant reads (optional)
- Auto-refresh dashboard at configurable interval
- Mobile-first responsive design optimized for Samsung S24 Ultra (412dp), responsive on tablets
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
│   ├── sheetFetcher.js     # All API calls (Firebase-cached when available)
│   ├── firebaseStore.js    # Firebase Firestore caching layer
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

4. (Optional) Set up Firebase for fast cached reads — see [Firebase Setup](#firebase-setup) below.

5. Serve the files (any static host — GitHub Pages, Netlify, Vercel, etc.).

## Firebase Setup

Firebase Firestore is used as an **optional caching layer** for faster reads. Google Sheets remains the source of truth — all writes go to Sheets first, then the relevant Firebase cache is invalidated. If Firebase is not configured, the app works exactly the same, just reads come directly from Sheets.

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → enter a project name → continue
3. Disable Google Analytics (optional) → **Create project**

### 2. Create a Firestore Database

1. In your Firebase project, go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (you'll add security rules next)
4. Select a Cloud Firestore location closest to you → **Enable**

### 3. Set Firestore Security Rules

Go to **Firestore Database → Rules** and replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each user (identified by PIN) can only read/write their own cache
    match /users/{pin}/cache/{document=**} {
      allow read, write: if true;
    }
    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> **Note:** Since the PIN acts as both auth and the document path, only someone with the correct PIN can access that user's cached data. For stronger security, you can add Firebase Authentication and restrict rules to authenticated users.

### 4. Get Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon) → **General**
2. Scroll down to **Your apps** → click the **Web** icon (`</>`) to add a web app
3. Register a name (e.g., "ProfitLens") → **Register app**
4. Copy the `firebaseConfig` object — you'll need these values:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

### 5. Add Config to Your App

In your `js/config.js`, fill in the `FIREBASE` section with the values from step 4:

```js
FIREBASE: {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123'
}
```

### How It Works

```
Read flow:  App → Firebase cache (hit?) → return cached data
                                (miss?) → Google Sheets → save to cache → return

Write flow: App → Google Sheets (write) → invalidate Firebase cache
            Next read fetches fresh data from Sheets and re-caches it
```

- Cache TTL is **5 minutes** — stale cache entries are ignored and re-fetched
- Background refresh: even on a cache hit, fresh data is fetched from Sheets in the background to keep the cache warm
- Cache keys: `expenses_{MonthSheet}`, `accounts`, `emi`, `sip`
- Firestore path: `users/{pin}/cache/{key}` → `{ value: [...], timestamp: ... }`

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
