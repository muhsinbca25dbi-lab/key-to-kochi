// Custom Dark Luxury SVG Charts for KEY TO KOCHI Admin Dashboard

export function renderBHKDonutChart(containerId, bhkStats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const labels = ['1 BHK', '2 BHK', '3 BHK', '4 BHK'];
  const colors = ['#38bdf8', '#818cf8', '#d4af37', '#f59e0b'];
  const values = labels.map(l => bhkStats[l] || 0);
  const total = values.reduce((a, b) => a + b, 0);

  if (total === 0) {
    container.innerHTML = `<div class="chart-empty">No property data available</div>`;
    return;
  }

  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const circles = values.map((val, idx) => {
    const percent = val / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return `
      <circle
        cx="${size / 2}" cy="${size / 2}" r="${radius}"
        fill="transparent"
        stroke="${colors[idx]}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
        stroke-linecap="round"
        class="donut-segment"
        data-label="${labels[idx]}"
        data-val="${val}"
      >
        <title>${labels[idx]}: ${val} properties (${Math.round(percent * 100)}%)</title>
      </circle>
    `;
  }).join('');

  const legend = labels.map((l, i) => `
    <div class="chart-legend-item">
      <span class="legend-dot" style="background: ${colors[i]}"></span>
      <span class="legend-label">${l}</span>
      <span class="legend-val">${values[i]} (${Math.round((values[i] / total) * 100) || 0}%)</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="donut-chart-wrapper">
      <div class="donut-svg-container">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-svg">
          <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="${strokeWidth}"></circle>
          ${circles}
        </svg>
        <div class="donut-center-info">
          <span class="center-total">${total}</span>
          <span class="center-sub">Total Units</span>
        </div>
      </div>
      <div class="chart-legend">
        ${legend}
      </div>
    </div>
  `;
}

export function renderFurnishingBarChart(containerId, furnishingStats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const categories = [
    { label: 'Fully Furnished', key: 'Fully Furnished', color: 'linear-gradient(90deg, #d4af37, #f59e0b)' },
    { label: 'Semi Furnished', key: 'Semi Furnished', color: 'linear-gradient(90deg, #38bdf8, #818cf8)' },
    { label: 'Unfurnished', key: 'Unfurnished', color: 'linear-gradient(90deg, #64748b, #94a3b8)' }
  ];

  const total = Object.values(furnishingStats).reduce((a, b) => a + b, 0) || 1;

  const bars = categories.map(cat => {
    const count = furnishingStats[cat.key] || 0;
    const pct = Math.round((count / total) * 100);

    return `
      <div class="horizontal-bar-row">
        <div class="bar-header">
          <span class="bar-name">${cat.label}</span>
          <span class="bar-count-badge">${count} units (${pct}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: ${cat.color};"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="furnishing-bars-container">
      ${bars}
    </div>
  `;
}

export function renderLocationBarChart(containerId, locationStats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = Object.entries(locationStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (entries.length === 0) {
    container.innerHTML = `<div class="chart-empty">No location distribution yet</div>`;
    return;
  }

  const maxVal = Math.max(...entries.map(e => e[1])) || 1;

  const bars = entries.map(([loc, count], idx) => {
    const pct = Math.round((count / maxVal) * 100);
    return `
      <div class="location-bar-item">
        <div class="loc-bar-info">
          <span class="loc-name">${loc}</span>
          <span class="loc-count">${count}</span>
        </div>
        <div class="loc-bar-track">
          <div class="loc-bar-fill" style="width: ${pct}%; animation-delay: ${idx * 0.1}s"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="location-bars-wrapper">${bars}</div>`;
}

export function renderAvailabilityRatio(containerId, available, rented) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const total = available + rented;
  const availPct = total > 0 ? Math.round((available / total) * 100) : 0;
  const rentedPct = total > 0 ? Math.round((rented / total) * 100) : 0;

  container.innerHTML = `
    <div class="ratio-progress-card">
      <div class="ratio-split-bar">
        <div class="split-segment available" style="width: ${availPct}%" title="Available: ${available}"></div>
        <div class="split-segment rented" style="width: ${rentedPct}%" title="Rented: ${rented}"></div>
      </div>
      <div class="ratio-stats-grid">
        <div class="ratio-stat-box available-box">
          <div class="status-indicator-dot green"></div>
          <div>
            <span class="stat-number">${available}</span>
            <span class="stat-tag">Available Now (${availPct}%)</span>
          </div>
        </div>
        <div class="ratio-stat-box rented-box">
          <div class="status-indicator-dot amber"></div>
          <div>
            <span class="stat-number">${rented}</span>
            <span class="stat-tag">Rented Out (${rentedPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderTenantTypeChart(containerId, tenantStats) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const categories = [
    { key: 'Family', label: '👨‍👩‍👧 Family Friendly', color: 'linear-gradient(90deg, #10b981, #059669)' },
    { key: 'Bachelors', label: '👤 Bachelor Friendly', color: 'linear-gradient(90deg, #38bdf8, #0284c7)' },
    { key: 'Couples', label: '❤️ Couple Friendly', color: 'linear-gradient(90deg, #f43f5e, #e11d48)' }
  ];

  const maxVal = Math.max(...Object.values(tenantStats || {}), 1);

  const bars = categories.map(cat => {
    const count = (tenantStats && tenantStats[cat.key]) || 0;
    const pct = Math.round((count / maxVal) * 100);

    return `
      <div class="horizontal-bar-row">
        <div class="bar-header">
          <span class="bar-name">${cat.label}</span>
          <span class="bar-count-badge" style="color: var(--gold-light); font-weight: 700;">${count} units</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: ${cat.color};"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="furnishing-bars-container">
      ${bars}
    </div>
  `;
}
