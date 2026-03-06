function isTransfer(t) {
  return (t.category || '').toLowerCase() === 'transfer';
}

function getTotalExpenses(transactions) {
  return transactions
    .filter(t => t.type.toLowerCase() === 'expense' && !isTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);
}

function getCategoryTotals(transactions) {
  const totals = {};
  transactions
    .filter(t => t.type.toLowerCase() === 'expense' && !isTransfer(t))
    .forEach(t => {
      const cat = t.category || 'Other';
      totals[cat] = (totals[cat] || 0) + t.amount;
    });
  return totals;
}

function getMonthlySummary(transactions) {
  const summary = {
    totalExpense: 0,
    totalIncome: 0,
    totalEMI: 0,
    totalInvestment: 0,
    totalSavings: 0
  };

  transactions.forEach(t => {
    const type = t.type.toLowerCase();
    const cat = t.category.toLowerCase();

    // Skip transfers — they're internal movements, not real income/expense
    if (cat === 'transfer') return;

    if (type === 'expense') {
      summary.totalExpense += t.amount;
    }
    if (type === 'income' || type === 'credit') {
      summary.totalIncome += t.amount;
    }
    if (cat === 'emi') {
      summary.totalEMI += t.amount;
    }
    if (cat === 'investment' || cat === 'savings') {
      summary.totalInvestment += t.amount;
    }
    if (cat === 'savings') {
      summary.totalSavings += t.amount;
    }
  });

  return summary;
}

function getAccountBalances(accounts, transactions) {
  const balances = {};
  accounts.forEach(a => {
    balances[a.account] = a.openingBalance;
  });

  transactions.forEach(t => {
    if (!t.account) return;
    if (!balances.hasOwnProperty(t.account)) {
      balances[t.account] = 0;
    }
    const type = t.type.toLowerCase();
    if (type === 'expense') {
      balances[t.account] -= t.amount;
    } else if (type === 'income' || type === 'credit') {
      balances[t.account] += t.amount;
    }
  });

  return balances;
}

export { getTotalExpenses, getCategoryTotals, getMonthlySummary, getAccountBalances };
