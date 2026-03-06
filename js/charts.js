const CHART_COLORS = [
  '#3b82f6', '#16a34a', '#ea580c', '#7c3aed', '#dc2626',
  '#ca8a04', '#0891b2', '#be185d', '#4f46e5', '#059669'
];

function getGridColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
}

function getTextColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? '#94a3b8' : '#64748b';
}

let pieChartInstance = null;
let lineChartInstance = null;
let barChartInstance = null;

function renderPieChart(canvasId, categoryTotals) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (labels.length === 0) return;

  // Skip re-render if data hasn't changed
  if (pieChartInstance && pieChartInstance._lastData === JSON.stringify(data)) return;
  if (pieChartInstance) pieChartInstance.destroy();

  pieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 0,
        spacing: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      animation: { duration: 600 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8, color: getTextColor() }
        }
      }
    }
  });
  pieChartInstance._lastData = JSON.stringify(data);
}

function renderLineChart(canvasId, monthlyData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = monthlyData.map(d => d.month);
  const data = monthlyData.map(d => d.total);

  if (lineChartInstance && lineChartInstance._lastData === JSON.stringify(data)) return;
  if (lineChartInstance) lineChartInstance.destroy();

  lineChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Spending',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: getGridColor() },
          ticks: {
            font: { size: 11 },
            color: getTextColor(),
            callback: v => '\u20B9' + v.toLocaleString('en-IN')
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: getTextColor() }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
  lineChartInstance._lastData = JSON.stringify(data);
}

function renderBarChart(canvasId, categoryTotals, prevCategoryTotals) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const allCategories = [...new Set([
    ...Object.keys(categoryTotals),
    ...Object.keys(prevCategoryTotals || {})
  ])];

  if (allCategories.length === 0) return;

  const barDataKey = JSON.stringify([categoryTotals, prevCategoryTotals]);
  if (barChartInstance && barChartInstance._lastData === barDataKey) return;
  if (barChartInstance) barChartInstance.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const datasets = [
    {
      label: 'This Month',
      data: allCategories.map(c => categoryTotals[c] || 0),
      backgroundColor: '#3b82f6',
      borderRadius: 4,
      barPercentage: 0.7
    }
  ];

  if (prevCategoryTotals && Object.keys(prevCategoryTotals).length > 0) {
    datasets.push({
      label: 'Last Month',
      data: allCategories.map(c => prevCategoryTotals[c] || 0),
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 4,
      barPercentage: 0.7
    });
  }

  barChartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels: allCategories, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: getGridColor() },
          ticks: {
            font: { size: 11 },
            color: getTextColor(),
            callback: v => '\u20B9' + v.toLocaleString('en-IN')
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: getTextColor() }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8, color: getTextColor() }
        }
      }
    }
  });
  barChartInstance._lastData = barDataKey;
}

export { renderPieChart, renderLineChart, renderBarChart };
