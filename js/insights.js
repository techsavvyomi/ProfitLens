function generateInsights(currentTotals, previousTotals, summary) {
  const insights = [];

  // Top spending category
  const sortedCats = Object.entries(currentTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    const [topCat, topAmount] = sortedCats[0];
    const pct = summary.totalExpense > 0 ? Math.round((topAmount / summary.totalExpense) * 100) : 0;
    insights.push({
      text: `Top spend: ${topCat} — ₹${topAmount.toLocaleString('en-IN')} (${pct}% of expenses)`,
      type: 'neutral'
    });
  }

  // Spending projection
  if (summary.totalExpense > 0) {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - dayOfMonth;
    const dailyAvg = Math.round(summary.totalExpense / dayOfMonth);
    const projected = Math.round((summary.totalExpense / dayOfMonth) * daysInMonth);
    insights.push({
      text: `Daily avg: ₹${dailyAvg.toLocaleString('en-IN')} · Projected: ₹${projected.toLocaleString('en-IN')} (${daysLeft} days left)`,
      type: 'info'
    });
  }

  // Income vs Expense
  if (summary.totalIncome > 0 && summary.totalExpense > 0) {
    const net = summary.totalIncome - summary.totalExpense - (summary.totalEMI || 0) - (summary.totalInvestment || 0);
    insights.push({
      text: net >= 0
        ? `Net surplus: ₹${net.toLocaleString('en-IN')} after all outflows`
        : `Overspent by ₹${Math.abs(net).toLocaleString('en-IN')} — expenses exceed income`,
      type: net >= 0 ? 'down' : 'up'
    });
  }

  // EMI burden
  if (summary.totalExpense > 0 && summary.totalEMI > 0) {
    const totalOutflow = summary.totalExpense + summary.totalEMI + (summary.totalInvestment || 0);
    const emiBurden = Math.round((summary.totalEMI / totalOutflow) * 100);
    insights.push({
      text: `EMI load: ${emiBurden}% of total outflow (₹${summary.totalEMI.toLocaleString('en-IN')})`,
      type: emiBurden > 40 ? 'up' : 'neutral'
    });
  }

  // Savings rate
  if (summary.totalIncome > 0 && summary.totalSavings > 0) {
    const savingsRate = Math.round((summary.totalSavings / summary.totalIncome) * 100);
    insights.push({
      text: `Savings rate: ${savingsRate}% of income (₹${summary.totalSavings.toLocaleString('en-IN')})`,
      type: savingsRate >= 20 ? 'down' : 'up'
    });
  }

  // Month-over-month category changes (biggest increase and decrease)
  if (previousTotals && Object.keys(previousTotals).length > 0) {
    const changes = [];
    for (const cat of Object.keys(currentTotals)) {
      const curr = currentTotals[cat] || 0;
      const prev = previousTotals[cat] || 0;
      if (prev === 0) continue;
      const change = ((curr - prev) / prev) * 100;
      if (Math.abs(change) >= 10) {
        changes.push({ cat, change, curr, prev });
      }
    }

    // Biggest increase
    const increases = changes.filter(c => c.change > 0).sort((a, b) => b.change - a.change);
    if (increases.length > 0) {
      const top = increases[0];
      insights.push({
        text: `${top.cat} up ${Math.round(top.change)}% vs last month (₹${top.prev.toLocaleString('en-IN')} → ₹${top.curr.toLocaleString('en-IN')})`,
        type: 'up'
      });
    }

    // Biggest decrease
    const decreases = changes.filter(c => c.change < 0).sort((a, b) => a.change - b.change);
    if (decreases.length > 0) {
      const top = decreases[0];
      insights.push({
        text: `${top.cat} down ${Math.abs(Math.round(top.change))}% vs last month (₹${top.prev.toLocaleString('en-IN')} → ₹${top.curr.toLocaleString('en-IN')})`,
        type: 'down'
      });
    }
  }

  // Number of categories
  if (sortedCats.length >= 3) {
    const top3Total = sortedCats.slice(0, 3).reduce((s, c) => s + c[1], 0);
    const top3Pct = summary.totalExpense > 0 ? Math.round((top3Total / summary.totalExpense) * 100) : 0;
    insights.push({
      text: `Top 3 categories account for ${top3Pct}% of spending`,
      type: top3Pct > 80 ? 'up' : 'neutral'
    });
  }

  return insights;
}

function renderInsights(containerId, insights) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (insights.length === 0) {
    container.innerHTML = '<div class="insight-item neutral">No insights available yet. Add more data!</div>';
    return;
  }

  const icons = {
    up: '↑',
    down: '↓',
    info: 'ℹ',
    neutral: '•'
  };

  container.innerHTML = insights.map(i =>
    `<div class="insight-item ${i.type}"><span class="insight-icon">${icons[i.type] || '•'}</span>${i.text}</div>`
  ).join('');
}

export { generateInsights, renderInsights };
