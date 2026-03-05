function generateInsights(currentTotals, previousTotals, summary) {
  const insights = [];

  // Category change insights
  if (previousTotals && Object.keys(previousTotals).length > 0) {
    for (const cat of Object.keys(currentTotals)) {
      const curr = currentTotals[cat] || 0;
      const prev = previousTotals[cat] || 0;
      if (prev === 0) continue;

      const change = ((curr - prev) / prev) * 100;
      if (Math.abs(change) >= 5) {
        const direction = change > 0 ? 'increased' : 'dropped';
        const cssClass = change > 0 ? 'up' : 'down';
        insights.push({
          text: `${cat} spending ${direction} ${Math.abs(Math.round(change))}% vs last month`,
          type: cssClass
        });
      }
    }
  }

  // EMI burden
  if (summary.totalExpense > 0 && summary.totalEMI > 0) {
    const emiBurden = Math.round((summary.totalEMI / summary.totalExpense) * 100);
    insights.push({
      text: `EMI consumes ${emiBurden}% of total spending`,
      type: emiBurden > 40 ? 'up' : 'neutral'
    });
  }

  // Savings rate
  if (summary.totalExpense > 0 && summary.totalSavings > 0) {
    const savingsRate = Math.round((summary.totalSavings / (summary.totalExpense + summary.totalSavings)) * 100);
    insights.push({
      text: `Savings rate: ${savingsRate}%`,
      type: savingsRate >= 20 ? 'down' : 'up'
    });
  }

  // Spending prediction (average of available data)
  if (summary.totalExpense > 0) {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = Math.round((summary.totalExpense / dayOfMonth) * daysInMonth);
    insights.push({
      text: `Projected monthly spend: ₹${projected.toLocaleString('en-IN')}`,
      type: 'info'
    });
  }

  // Top spending category
  if (Object.keys(currentTotals).length > 0) {
    const topCat = Object.entries(currentTotals).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      text: `Highest spending: ${topCat[0]} at ₹${topCat[1].toLocaleString('en-IN')}`,
      type: 'neutral'
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

  container.innerHTML = insights.map(i =>
    `<div class="insight-item ${i.type}">${i.text}</div>`
  ).join('');
}

export { generateInsights, renderInsights };
