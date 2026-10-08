import { store } from '../store/state.js';
import { renderBHKDonutChart, renderFurnishingBarChart, renderLocationBarChart, renderAvailabilityRatio, renderTenantTypeChart } from './charts.js';
import { CURATED_IMAGE_PRESETS, TENANT_TYPES, TENANT_TYPE_CONFIG } from '../data/initialData.js';
import { showToastNotification } from './actionModals.js';

export class AdminPortal {
  constructor(containerElement, onCloseCallback) {
    this.container = containerElement;
    this.onClose = onCloseCallback;
    this.currentTab = 'dashboard';
    this.editingPropertyId = null;
    this.propertySearchQuery = '';
    this.propertyFilterType = 'All';
    this.propertyFilterStatus = 'All';
    this.enquiryFilterStatus = 'All';
    this.unsubscribe = null;
  }

  mount() {
    this.render();
    this.attachEvents();
    this.updateSidebarBadges();
    this.unsubscribe = store.subscribe(() => {
      // Re-render current view when state updates
      this.updateView();
      this.updateSidebarBadges();
    });
  }

  unmount() {
    if (this.unsubscribe) this.unsubscribe();
    this.container.innerHTML = '';
  }

  updateView() {
    this.updateSidebarBadges();
    if (this.currentTab === 'dashboard') {
      this.renderDashboardContent();
    } else if (this.currentTab === 'properties') {
      this.renderPropertiesContent();
    } else if (this.currentTab === 'add-property') {
      this.renderAddPropertyContent();
    } else if (this.currentTab === 'enquiries') {
      this.renderEnquiriesContent();
    } else if (this.currentTab === 'submissions') {
      this.renderSubmissionsContent();
    } else if (this.currentTab === 'locations') {
      this.renderLocationsContent();
    } else if (this.currentTab === 'settings') {
      this.renderSettingsContent();
    }
  }

  updateSidebarBadges() {
    const stats = store.getStats();

    // 1. Enquiries Unread Badge
    const enquiriesBtn = this.container.querySelector('[data-tab="enquiries"]');
    if (enquiriesBtn) {
      let badge = enquiriesBtn.querySelector('#enquiries-unread-badge');
      if (stats.unreadEnquiries > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-badge-pill';
          badge.id = 'enquiries-unread-badge';
          enquiriesBtn.appendChild(badge);
        }
        badge.textContent = stats.unreadEnquiries;
      } else if (badge) {
        badge.remove();
      }
    }

    // 2. Owner Submissions Pending Badge
    const subsBtn = this.container.querySelector('[data-tab="submissions"]');
    if (subsBtn) {
      let subBadge = subsBtn.querySelector('.nav-badge-pill.amber');
      if (stats.pendingSubmissions > 0) {
        if (!subBadge) {
          subBadge = document.createElement('span');
          subBadge.className = 'nav-badge-pill amber';
          subsBtn.appendChild(subBadge);
        }
        subBadge.textContent = stats.pendingSubmissions;
      } else if (subBadge) {
        subBadge.remove();
      }
    }

    // 3. Properties Counter
    const propCounter = this.container.querySelector('#admin-prop-counter');
    if (propCounter) {
      propCounter.textContent = stats.total;
    }
  }

  render() {
    const stats = store.getStats();

    this.container.innerHTML = `
      <div class="admin-portal-layout">
        <!-- Sidebar -->
        <aside class="admin-sidebar">
          <div class="admin-brand">
            <div class="admin-brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5"/>
                <path d="m21 2-9.6 9.6"/>
                <path d="m15.5 7.5 3 3L22 7l-3-3"/>
              </svg>
            </div>
            <div class="admin-brand-text">
              <h3>KEY TO KOCHI</h3>
              <span>Admin Management</span>
            </div>
          </div>

          <nav class="admin-nav">
            <button class="admin-nav-item ${this.currentTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              <span>Dashboard</span>
            </button>

            <button class="admin-nav-item ${this.currentTab === 'properties' ? 'active' : ''}" data-tab="properties">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Properties</span>
              <span class="nav-counter" id="admin-prop-counter">${stats.total}</span>
            </button>

            <button class="admin-nav-item ${this.currentTab === 'add-property' ? 'active' : ''}" data-tab="add-property">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <span>Add Property</span>
            </button>

            <button class="admin-nav-item ${this.currentTab === 'enquiries' ? 'active' : ''}" data-tab="enquiries" id="admin-nav-enquiries">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Enquiries</span>
              ${stats.unreadEnquiries > 0 ? `<span class="nav-badge-pill" id="enquiries-unread-badge">${stats.unreadEnquiries}</span>` : ''}
            </button>

            <button class="admin-nav-item ${this.currentTab === 'submissions' ? 'active' : ''}" data-tab="submissions">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              <span>Owner Approvals</span>
              ${stats.pendingSubmissions > 0 ? `<span class="nav-badge-pill amber">${stats.pendingSubmissions}</span>` : ''}
            </button>

            <button class="admin-nav-item ${this.currentTab === 'locations' ? 'active' : ''}" data-tab="locations">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Kochi Locations</span>
            </button>

            <button class="admin-nav-item ${this.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>Settings & Data</span>
            </button>
          </nav>

          <div class="admin-sidebar-footer">
            <button class="admin-btn-back-public" id="admin-btn-back-public">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Back to Public Site</span>
            </button>
            <button class="admin-btn-logout" id="admin-btn-logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="admin-main">
          <header class="admin-topbar">
            <div class="topbar-left">
              <h2 id="admin-page-title">${this.getPageTitle()}</h2>
              <span class="live-status-pill">
                <span class="live-dot"></span> Real-time Sync Active
              </span>
            </div>
            <div class="topbar-right">
              <button class="btn-gold-sm" id="topbar-add-prop-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Property
              </button>
            </div>
          </header>

          <div class="admin-content-body" id="admin-content-body">
            <!-- Dynamic tab content inserted here -->
          </div>
        </main>
      </div>
    `;

    this.updateView();
  }

  getPageTitle() {
    switch (this.currentTab) {
      case 'dashboard': return 'Rental Operations Dashboard';
      case 'properties': return 'Property Inventory Management';
      case 'add-property': return this.editingPropertyId ? 'Edit Property Listing' : 'Add New Property Listing';
      case 'enquiries': return 'Tenant Rental Enquiries';
      case 'submissions': return 'Owner Property Review Queue';
      case 'locations': return 'Kochi Location Hubs';
      case 'settings': return 'System Settings & Demo Data';
      default: return 'Admin Portal';
    }
  }

  attachEvents() {
    // Navigation item clicks
    this.container.querySelectorAll('.admin-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        if (tab === 'add-property') {
          this.editingPropertyId = null; // reset edit state
        }
        this.switchTab(tab);
      });
    });

    // Topbar Add Property quick button
    const topAddBtn = this.container.querySelector('#topbar-add-prop-btn');
    if (topAddBtn) {
      topAddBtn.addEventListener('click', () => {
        this.editingPropertyId = null;
        this.switchTab('add-property');
      });
    }

    // Back to Public Site
    const backBtn = this.container.querySelector('#admin-btn-back-public');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (this.onClose) this.onClose();
      });
    }

    // Logout
    const logoutBtn = this.container.querySelector('#admin-btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        store.state.adminAuth.isAuthenticated = false;
        store.saveState();
        if (this.onClose) this.onClose();
      });
    }
  }

  switchTab(tab) {
    this.currentTab = tab;
    this.container.querySelectorAll('.admin-nav-item').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    const titleEl = this.container.querySelector('#admin-page-title');
    if (titleEl) titleEl.textContent = this.getPageTitle();
    this.updateView();
  }

  // ================= DASHBOARD TAB =================
  renderDashboardContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    const stats = store.getStats();
    const properties = store.getAllProperties().slice(0, 5);
    const enquiries = store.getEnquiries().slice(0, 5);

    body.innerHTML = `
      <div class="admin-dashboard-view">
        <!-- KPI Summary Cards -->
        <div class="admin-kpi-grid">
          <div class="kpi-card gold-border">
            <div class="kpi-icon gold">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Total Properties</span>
              <span class="kpi-value">${stats.total}</span>
              <span class="kpi-hint">Across 12 Kochi zones</span>
            </div>
          </div>

          <div class="kpi-card emerald-border">
            <div class="kpi-icon emerald">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Available for Rent</span>
              <span class="kpi-value text-emerald">${stats.available}</span>
              <span class="kpi-hint">${Math.round((stats.available / (stats.total || 1)) * 100)}% occupancy ready</span>
            </div>
          </div>

          <div class="kpi-card amber-border">
            <div class="kpi-icon amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Currently Rented</span>
              <span class="kpi-value text-amber">${stats.rented}</span>
              <span class="kpi-hint">Active tenant leases</span>
            </div>
          </div>

          <div class="kpi-card blue-border">
            <div class="kpi-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Tenant Enquiries</span>
              <span class="kpi-value text-blue">${stats.totalEnquiries}</span>
              <span class="kpi-hint">${stats.unreadEnquiries > 0 ? `<strong style="color: #f7df94;">${stats.unreadEnquiries} Unread</strong> • ` : ''}${stats.newEnquiries} awaiting contact</span>
            </div>
          </div>
        </div>

        <!-- Tenant Type Statistics Strip -->
        <div class="tenant-type-kpi-strip">
          <div class="tenant-kpi-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Properties by Tenant Type:</span>
          </div>
          <div class="tenant-kpi-item">
            <span class="tenant-kpi-label">👨‍👩‍👧 Family:</span>
            <strong class="tenant-kpi-number text-emerald">${stats.tenantStats ? stats.tenantStats.Family : 0}</strong>
          </div>
          <div class="tenant-kpi-item">
            <span class="tenant-kpi-label">👤 Bachelors:</span>
            <strong class="tenant-kpi-number text-blue">${stats.tenantStats ? stats.tenantStats.Bachelors : 0}</strong>
          </div>
          <div class="tenant-kpi-item">
            <span class="tenant-kpi-label">❤️ Couples:</span>
            <strong class="tenant-kpi-number" style="color: #f43f5e;">${stats.tenantStats ? stats.tenantStats.Couples : 0}</strong>
          </div>
        </div>

        <!-- Charts Grid -->
        <div class="admin-charts-grid">
          <!-- Properties by Tenant Type (Family, Bachelors, Couples) -->
          <div class="chart-panel">
            <div class="chart-panel-header">
              <h3>Properties by Tenant Type</h3>
              <span class="panel-subtitle">Family vs Bachelors vs Couples Suitability</span>
            </div>
            <div id="chart-tenant-bars" class="chart-content-area"></div>
          </div>

          <!-- BHK Breakdown Donut Chart -->
          <div class="chart-panel">
            <div class="chart-panel-header">
              <h3>Properties by BHK Type</h3>
              <span class="panel-subtitle">1 BHK, 2 BHK, 3 BHK & 4 BHK Distribution</span>
            </div>
            <div id="chart-bhk-donut" class="chart-content-area"></div>
          </div>

          <!-- Furnishing Breakdown -->
          <div class="chart-panel">
            <div class="chart-panel-header">
              <h3>Furnishing Breakdown</h3>
              <span class="panel-subtitle">Fully vs Semi vs Unfurnished</span>
            </div>
            <div id="chart-furnishing-bars" class="chart-content-area"></div>
          </div>

          <!-- Properties by Kochi Location -->
          <div class="chart-panel">
            <div class="chart-panel-header">
              <h3>Top Locations in Kochi</h3>
              <span class="panel-subtitle">Units per Kochi neighborhood</span>
            </div>
            <div id="chart-location-bars" class="chart-content-area"></div>
          </div>

          <!-- Available vs Rented Ratio -->
          <div class="chart-panel">
            <div class="chart-panel-header">
              <h3>Availability Ratio</h3>
              <span class="panel-subtitle">Market Availability Balance</span>
            </div>
            <div id="chart-availability-ratio" class="chart-content-area"></div>
          </div>
        </div>

        <!-- Recent Tables Split -->
        <div class="admin-recent-split">
          <!-- Recent Properties -->
          <div class="recent-table-card">
            <div class="card-header-flex">
              <h3>Recent Properties</h3>
              <button class="btn-text-link" id="link-view-all-props">View All &rarr;</button>
            </div>
            <div class="table-responsive">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Type & BHK</th>
                    <th>Rent</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${properties.map(p => `
                    <tr>
                      <td>
                        <div class="cell-property">
                          <img src="${p.images[0]}" alt="${p.title}" class="cell-thumb" />
                          <div class="cell-property-text">
                            <strong>${p.title}</strong>
                            <span>${p.location}</span>
                          </div>
                        </div>
                      </td>
                      <td><span class="badge-type">${p.bhk} • ${p.type}</span></td>
                      <td><strong>₹${p.rent.toLocaleString('en-IN')}/mo</strong></td>
                      <td>
                        <button class="status-toggle-btn ${p.availability === 'Available' ? 'status-avail' : 'status-rented'}" data-id="${p.id}">
                          ${p.availability}
                        </button>
                      </td>
                      <td>
                        <button class="action-btn-edit" data-id="${p.id}" title="Edit Property">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Recent Enquiries -->
          <div class="recent-table-card">
            <div class="card-header-flex">
              <h3>Recent Enquiries</h3>
              <button class="btn-text-link" id="link-view-all-enquiries">Manage Enquiries &rarr;</button>
            </div>
            <div class="table-responsive">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th style="width: 80px;">Status</th>
                    <th>Prospect</th>
                    <th>Property</th>
                    <th>Date</th>
                    <th>Lead Status</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${enquiries.map(e => `
                    <tr class="recent-enquiry-row ${e.isRead ? 'row-read' : 'row-unread'}" data-id="${e.id}" style="cursor: pointer;">
                      <td>
                        ${e.isRead ? `
                          <span class="enquiry-read-chip chip-read">Read</span>
                        ` : `
                          <span class="enquiry-read-chip chip-unread"><span class="unread-dot"></span> New</span>
                        `}
                      </td>
                      <td>
                        <div class="cell-customer">
                          <strong style="${!e.isRead ? 'color: var(--gold-light); font-weight: 700;' : ''}">${e.customerName}</strong>
                          <span>${e.phone}</span>
                        </div>
                      </td>
                      <td><span class="cell-prop-title" title="${e.propertyTitle}">${e.propertyTitle.substring(0, 24)}...</span></td>
                      <td><span class="cell-date">${e.date}</span></td>
                      <td>
                        <select class="enquiry-status-select" data-id="${e.id}">
                          <option value="New" ${e.status === 'New' ? 'selected' : ''}>New</option>
                          <option value="Contacted" ${e.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                          <option value="Closed" ${e.status === 'Closed' ? 'selected' : ''}>Closed</option>
                        </select>
                      </td>
                      <td style="text-align: right;">
                        <button class="btn-table-action-view btn-view-recent-enquiry" data-id="${e.id}">View</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render SVG Charts dynamically
    renderTenantTypeChart('chart-tenant-bars', stats.tenantStats);
    renderBHKDonutChart('chart-bhk-donut', stats.bhkStats);
    renderFurnishingBarChart('chart-furnishing-bars', stats.furnishingStats);
    renderLocationBarChart('chart-location-bars', stats.locationStats);
    renderAvailabilityRatio('chart-availability-ratio', stats.available, stats.rented);

    // Event listeners on recent tables
    body.querySelectorAll('.status-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.togglePropertyStatus(id);
      });
    });

    body.querySelectorAll('.action-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.editingPropertyId = id;
        this.switchTab('add-property');
      });
    });

    body.querySelectorAll('.enquiry-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = sel.getAttribute('data-id');
        store.updateEnquiryStatus(id, e.target.value);
      });
    });

    body.querySelectorAll('.btn-view-recent-enquiry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.openEnquiryDetailModal(id);
      });
    });

    body.querySelectorAll('.recent-enquiry-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('select') || e.target.closest('button')) return;
        const id = row.getAttribute('data-id');
        this.openEnquiryDetailModal(id);
      });
    });

    const viewPropsLink = body.querySelector('#link-view-all-props');
    if (viewPropsLink) {
      viewPropsLink.addEventListener('click', () => this.switchTab('properties'));
    }

    const viewEnqLink = body.querySelector('#link-view-all-enquiries');
    if (viewEnqLink) {
      viewEnqLink.addEventListener('click', () => this.switchTab('enquiries'));
    }
  }

  // ================= PROPERTIES TAB =================
  renderPropertiesContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    let props = store.getAllProperties();

    // Filter by search
    if (this.propertySearchQuery) {
      const q = this.propertySearchQuery.toLowerCase();
      props = props.filter(p => 
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
      );
    }

    // Filter by type
    if (this.propertyFilterType !== 'All') {
      props = props.filter(p => p.type === this.propertyFilterType);
    }

    // Filter by status
    if (this.propertyFilterStatus !== 'All') {
      props = props.filter(p => p.availability === this.propertyFilterStatus);
    }

    body.innerHTML = `
      <div class="admin-properties-view">
        <div class="filter-toolbar-card">
          <div class="search-input-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" id="prop-search-input" placeholder="Search by property name, address or location..." value="${this.propertySearchQuery}" />
          </div>

          <div class="filter-controls-group">
            <select id="prop-filter-type" class="admin-select">
              <option value="All" ${this.propertyFilterType === 'All' ? 'selected' : ''}>All Types</option>
              <option value="Home" ${this.propertyFilterType === 'Home' ? 'selected' : ''}>Home</option>
              <option value="Apartment" ${this.propertyFilterType === 'Apartment' ? 'selected' : ''}>Apartment</option>
              <option value="Flat" ${this.propertyFilterType === 'Flat' ? 'selected' : ''}>Flat</option>
            </select>

            <select id="prop-filter-status" class="admin-select">
              <option value="All" ${this.propertyFilterStatus === 'All' ? 'selected' : ''}>All Status</option>
              <option value="Available" ${this.propertyFilterStatus === 'Available' ? 'selected' : ''}>Available</option>
              <option value="Rented" ${this.propertyFilterStatus === 'Rented' ? 'selected' : ''}>Rented</option>
            </select>

            <button class="btn-gold-sm" id="btn-create-new-prop">
              + Add Property
            </button>
          </div>
        </div>

        <div class="table-responsive inventory-table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Type / BHK</th>
                <th>Rent / Deposit</th>
                <th>Furnishing</th>
                <th>Suitable For</th>
                <th>Availability</th>
                <th>Visibility</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${props.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
                    No properties match your filter criteria.
                  </td>
                </tr>
              ` : props.map(p => `
                <tr>
                  <td>
                    <div class="cell-property">
                      <img src="${p.images[0]}" alt="${p.title}" class="cell-thumb" />
                      <div class="cell-property-text">
                        <strong>${p.title}</strong>
                        <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:2px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${p.location}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="bhk-badge-cell">
                      <span class="badge-bhk">${p.bhk}</span>
                      <span class="badge-type-sub">${p.type} • ${p.size} sq.ft</span>
                    </div>
                  </td>
                  <td>
                    <strong>₹${p.rent.toLocaleString('en-IN')}</strong><span class="text-sm">/mo</span>
                    <div class="text-xs text-muted">Dep: ₹${(p.deposit || 0).toLocaleString('en-IN')}</div>
                  </td>
                  <td><span class="furnish-tag">${p.furnishing}</span></td>
                  <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; max-width: 140px;">
                      ${(p.suitableFor || ['Family']).map(t => `<span class="badge-type" style="font-size: 0.72rem; padding: 2px 6px;">${t === 'Family' ? '👨‍👩‍👧 Family' : t === 'Bachelors' ? '👤 Bachelors' : '❤️ Couples'}</span>`).join('')}
                    </div>
                  </td>
                  <td>
                    <button class="status-toggle-btn ${p.availability === 'Available' ? 'status-avail' : 'status-rented'}" data-id="${p.id}" title="Click to toggle availability">
                      ${p.availability}
                    </button>
                  </td>
                  <td>
                    <button class="publish-toggle-btn ${p.published !== false ? 'is-published' : 'is-draft'}" data-id="${p.id}" title="Click to publish/unpublish">
                      ${p.published !== false ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td style="text-align: right;">
                    <div class="table-action-btns">
                      <button class="action-btn-edit" data-id="${p.id}" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button class="action-btn-delete" data-id="${p.id}" title="Delete Property">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Filter interactions
    const searchInput = body.querySelector('#prop-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.propertySearchQuery = e.target.value;
        this.renderPropertiesContent();
      });
    }

    const typeSelect = body.querySelector('#prop-filter-type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.propertyFilterType = e.target.value;
        this.renderPropertiesContent();
      });
    }

    const statusSelect = body.querySelector('#prop-filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.propertyFilterStatus = e.target.value;
        this.renderPropertiesContent();
      });
    }

    const createBtn = body.querySelector('#btn-create-new-prop');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.editingPropertyId = null;
        this.switchTab('add-property');
      });
    }

    // Toggles & Actions
    body.querySelectorAll('.status-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.togglePropertyStatus(id);
      });
    });

    body.querySelectorAll('.publish-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.togglePropertyPublish(id);
      });
    });

    body.querySelectorAll('.action-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.editingPropertyId = id;
        this.switchTab('add-property');
      });
    });

    body.querySelectorAll('.action-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this property listing?')) {
          store.deleteProperty(id);
        }
      });
    });
  }

  // ================= ADD / EDIT PROPERTY TAB =================
  renderAddPropertyContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    const prop = this.editingPropertyId ? store.getPropertyById(this.editingPropertyId) : null;
    const isEdit = !!prop;

    const facilitiesList = [
      'Parking', 'Wi-Fi', 'AC', 'Lift', 'Security', 'Water Supply',
      'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym',
      'Swimming Pool', 'Pet Friendly'
    ];

    const currentFacilities = prop ? prop.facilities || [] : ['Parking', 'Water Supply', 'Security', 'Attached Bathroom', 'Kitchen'];
    const currentSuitableFor = prop && prop.suitableFor ? prop.suitableFor : ['Family', 'Couples'];
    const currentImages = prop && prop.images ? [...prop.images] : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'];

    const locations = store.getLocations();

    body.innerHTML = `
      <div class="admin-form-container">
        <div class="form-header-bar">
          <div>
            <h3>${isEdit ? 'Update Property Details' : 'Create New Property Listing'}</h3>
            <p class="text-muted">Enter accurate property specifications for prospective tenants in Kochi.</p>
          </div>
          <button class="btn-outline-sm" id="btn-cancel-edit">&larr; Back to Inventory</button>
        </div>

        <form id="admin-prop-form" class="admin-property-form">
          <div class="form-grid-2col">
            <!-- Property Title -->
            <div class="form-field full-width">
              <label for="form-title">Property Name / Title <span class="req">*</span></label>
              <input type="text" id="form-title" required placeholder="e.g. Luxury 3 BHK Lakeview Sky Villa at Vyttila Mobility Hub" value="${prop ? prop.title : ''}" />
            </div>

            <!-- Property Type -->
            <div class="form-field">
              <label for="form-type">Property Type <span class="req">*</span></label>
              <select id="form-type" required>
                <option value="Apartment" ${prop && prop.type === 'Apartment' ? 'selected' : ''}>Apartment</option>
                <option value="Flat" ${prop && prop.type === 'Flat' ? 'selected' : ''}>Flat</option>
                <option value="Home" ${prop && prop.type === 'Home' ? 'selected' : ''}>Home</option>
              </select>
            </div>

            <!-- BHK -->
            <div class="form-field">
              <label for="form-bhk">BHK Category <span class="req">*</span></label>
              <select id="form-bhk" required>
                <option value="1 BHK" ${prop && prop.bhk === '1 BHK' ? 'selected' : ''}>1 BHK</option>
                <option value="2 BHK" ${prop && prop.bhk === '2 BHK' ? 'selected' : ''}>2 BHK</option>
                <option value="3 BHK" ${prop && prop.bhk === '3 BHK' ? 'selected' : ''}>3 BHK</option>
                <option value="4 BHK" ${prop && prop.bhk === '4 BHK' ? 'selected' : ''}>4 BHK</option>
              </select>
            </div>

            <!-- Monthly Rent -->
            <div class="form-field">
              <label for="form-rent">Monthly Rent (₹ INR) <span class="req">*</span></label>
              <input type="number" id="form-rent" required min="1000" step="500" placeholder="e.g. 28000" value="${prop ? prop.rent : ''}" />
            </div>

            <!-- Security Deposit -->
            <div class="form-field">
              <label for="form-deposit">Security Deposit (₹ INR) <span class="req">*</span></label>
              <input type="number" id="form-deposit" required min="1000" step="1000" placeholder="e.g. 70000" value="${prop ? prop.deposit : ''}" />
            </div>

            <!-- Location -->
            <div class="form-field">
              <label for="form-location">Kochi Location / Neighborhood <span class="req">*</span></label>
              <select id="form-location" required>
                ${locations.map(loc => `
                  <option value="${loc.name}" ${prop && prop.location === loc.name ? 'selected' : ''}>${loc.name}</option>
                `).join('')}
              </select>
            </div>

            <!-- Furnishing -->
            <div class="form-field">
              <label for="form-furnishing">Furnishing Status <span class="req">*</span></label>
              <select id="form-furnishing" required>
                <option value="Fully Furnished" ${prop && prop.furnishing === 'Fully Furnished' ? 'selected' : ''}>Fully Furnished</option>
                <option value="Semi Furnished" ${prop && prop.furnishing === 'Semi Furnished' ? 'selected' : ''}>Semi Furnished</option>
                <option value="Unfurnished" ${prop && prop.furnishing === 'Unfurnished' ? 'selected' : ''}>Unfurnished</option>
              </select>
            </div>

            <!-- Property Size (sq.ft) -->
            <div class="form-field">
              <label for="form-size">Property Size (sq.ft) <span class="req">*</span></label>
              <input type="number" id="form-size" required min="100" placeholder="e.g. 1450" value="${prop ? prop.size : ''}" />
            </div>

            <!-- Bedrooms & Bathrooms -->
            <div class="form-field-group">
              <div class="form-field">
                <label for="form-bedrooms">Bedrooms</label>
                <input type="number" id="form-bedrooms" min="1" max="10" value="${prop ? prop.bedrooms : '2'}" />
              </div>
              <div class="form-field">
                <label for="form-bathrooms">Bathrooms</label>
                <input type="number" id="form-bathrooms" min="1" max="10" value="${prop ? prop.bathrooms : '2'}" />
              </div>
            </div>

            <!-- Availability -->
            <div class="form-field">
              <label for="form-availability">Current Availability <span class="req">*</span></label>
              <select id="form-availability" required>
                <option value="Available" ${!prop || prop.availability === 'Available' ? 'selected' : ''}>Available</option>
                <option value="Rented" ${prop && prop.availability === 'Rented' ? 'selected' : ''}>Rented</option>
              </select>
            </div>

            <!-- Featured check -->
            <div class="form-field checkbox-field-simple">
              <label class="custom-checkbox-label">
                <input type="checkbox" id="form-featured" ${prop && prop.featured ? 'checked' : ''} />
                <span class="checkmark"></span>
                <span>Mark as Featured Luxury Property on Homepage</span>
              </label>
            </div>

            <!-- Full Address -->
            <div class="form-field full-width">
              <label for="form-address">Full Physical Address <span class="req">*</span></label>
              <input type="text" id="form-address" required placeholder="e.g. Flat 14B, Skyline Gardenia, NH 66 Bypass, Edappally Toll, Kochi 682024" value="${prop ? prop.address : ''}" />
            </div>

            <!-- Full Description -->
            <div class="form-field full-width">
              <label for="form-description">Comprehensive Property Description <span class="req">*</span></label>
              <textarea id="form-description" rows="4" required placeholder="Describe interior aesthetics, balcony views, ventilation, proximity to metro or IT parks...">${prop ? prop.description : ''}</textarea>
            </div>
          </div>

          <!-- Suitable For (Tenant Categories) -->
          <div class="facilities-selection-box">
            <h4>Suitable For (Tenant Categories) <span class="req">*</span></h4>
            <p class="text-xs text-muted" style="margin-bottom: 12px;">Select all tenant categories this property is suitable for (multiple selections allowed):</p>
            <div class="facilities-checkbox-grid">
              <label class="custom-checkbox-label">
                <input type="checkbox" class="tenant-type-cb" value="Family" ${currentSuitableFor.includes('Family') ? 'checked' : ''} />
                <span class="checkmark"></span>
                <span>👨‍👩‍👧 Family Friendly</span>
              </label>
              <label class="custom-checkbox-label">
                <input type="checkbox" class="tenant-type-cb" value="Bachelors" ${currentSuitableFor.includes('Bachelors') ? 'checked' : ''} />
                <span class="checkmark"></span>
                <span>👤 Bachelor Friendly</span>
              </label>
              <label class="custom-checkbox-label">
                <input type="checkbox" class="tenant-type-cb" value="Couples" ${currentSuitableFor.includes('Couples') ? 'checked' : ''} />
                <span class="checkmark"></span>
                <span>❤️ Couple Friendly</span>
              </label>
            </div>
          </div>

          <!-- Facilities Checklist (13 required) -->
          <div class="facilities-selection-box">
            <h4>Facilities & Amenities Available</h4>
            <div class="facilities-checkbox-grid">
              ${facilitiesList.map(fac => `
                <label class="custom-checkbox-label">
                  <input type="checkbox" class="fac-cb" value="${fac}" ${currentFacilities.includes(fac) ? 'checked' : ''} />
                  <span class="checkmark"></span>
                  <span>${fac}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Multiple Image Management -->
          <div class="image-management-box">
            <div class="box-header-row">
              <div>
                <h4>Property Photos & Gallery Management</h4>
                <p class="text-xs text-muted">Upload cover image and multiple high-res gallery images. The first image serves as the main display cover.</p>
              </div>
              <button type="button" class="btn-text-gold" id="btn-toggle-preset-picker">+ Quick Preset Photo Library</button>
            </div>

            <!-- Preset Photo Picker (Collapsible) -->
            <div class="preset-picker-drawer" id="preset-picker-drawer" style="display: none;">
              <h5>Select curated luxury architecture photos for Kochi:</h5>
              <div class="preset-thumbnails-grid">
                ${CURATED_IMAGE_PRESETS.map(preset => `
                  <div class="preset-thumb-card" data-url="${preset.url}">
                    <img src="${preset.url}" alt="${preset.label}" />
                    <span>${preset.label}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Custom URL Input & File Simulation -->
            <div class="image-input-row">
              <input type="url" id="custom-image-url" placeholder="Paste image URL here (e.g. https://images.unsplash.com/...)" />
              <button type="button" class="btn-secondary-sm" id="btn-add-image-url">Add Photo</button>
            </div>

            <!-- Images Preview Grid -->
            <div class="gallery-preview-grid" id="gallery-preview-grid">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- Form Actions: Save Draft & Publish Property -->
          <div class="form-actions-footer">
            <button type="button" class="btn-secondary" id="btn-save-draft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save as Draft
            </button>
            <button type="submit" class="btn-gold" id="btn-publish-property">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${isEdit ? 'Update & Publish Changes' : 'Publish Property Listing'}
            </button>
          </div>
        </form>
      </div>
    `;

    // Internal state for gallery images
    let activeImages = [...currentImages];

    const renderImagePreviews = () => {
      const grid = body.querySelector('#gallery-preview-grid');
      if (!grid) return;

      if (activeImages.length === 0) {
        grid.innerHTML = `<div class="empty-gallery-msg">No images added yet. Add at least one photo for this property.</div>`;
        return;
      }

      grid.innerHTML = activeImages.map((imgUrl, idx) => `
        <div class="gallery-preview-item ${idx === 0 ? 'is-cover' : ''}">
          <img src="${imgUrl}" alt="Property Photo ${idx + 1}" />
          ${idx === 0 ? '<span class="cover-badge">Cover Photo</span>' : ''}
          <div class="img-preview-overlay">
            <button type="button" class="btn-remove-img" data-idx="${idx}" title="Remove photo">&times;</button>
          </div>
        </div>
      `).join('');

      // Attach remove photo handlers
      grid.querySelectorAll('.btn-remove-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const removeIdx = parseInt(btn.getAttribute('data-idx'));
          activeImages.splice(removeIdx, 1);
          renderImagePreviews();
        });
      });
    };

    renderImagePreviews();

    // Toggle Preset Library
    const togglePresetBtn = body.querySelector('#btn-toggle-preset-picker');
    const presetDrawer = body.querySelector('#preset-picker-drawer');
    if (togglePresetBtn && presetDrawer) {
      togglePresetBtn.addEventListener('click', () => {
        const isHidden = presetDrawer.style.display === 'none';
        presetDrawer.style.display = isHidden ? 'block' : 'none';
      });

      presetDrawer.querySelectorAll('.preset-thumb-card').forEach(card => {
        card.addEventListener('click', () => {
          const url = card.getAttribute('data-url');
          if (url && !activeImages.includes(url)) {
            activeImages.push(url);
            renderImagePreviews();
          }
        });
      });
    }

    // Add Custom Image URL
    const addImgBtn = body.querySelector('#btn-add-image-url');
    const customImgInput = body.querySelector('#custom-image-url');
    if (addImgBtn && customImgInput) {
      addImgBtn.addEventListener('click', () => {
        const val = customImgInput.value.trim();
        if (val) {
          activeImages.push(val);
          customImgInput.value = '';
          renderImagePreviews();
        }
      });
    }

    // Back to inventory
    const cancelBtn = body.querySelector('#btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.switchTab('properties'));
    }

    // Helper to extract form data
    const getFormData = (publishedStatus = true) => {
      const selectedFacilities = Array.from(body.querySelectorAll('.fac-cb:checked')).map(cb => cb.value);
      const selectedSuitable = Array.from(body.querySelectorAll('.tenant-type-cb:checked')).map(cb => cb.value);
      return {
        title: body.querySelector('#form-title').value.trim(),
        type: body.querySelector('#form-type').value,
        bhk: body.querySelector('#form-bhk').value,
        rent: Number(body.querySelector('#form-rent').value) || 0,
        deposit: Number(body.querySelector('#form-deposit').value) || 0,
        location: body.querySelector('#form-location').value,
        furnishing: body.querySelector('#form-furnishing').value,
        size: Number(body.querySelector('#form-size').value) || 0,
        bedrooms: Number(body.querySelector('#form-bedrooms').value) || 1,
        bathrooms: Number(body.querySelector('#form-bathrooms').value) || 1,
        availability: body.querySelector('#form-availability').value,
        featured: body.querySelector('#form-featured').checked,
        address: body.querySelector('#form-address').value.trim(),
        description: body.querySelector('#form-description').value.trim(),
        facilities: selectedFacilities,
        suitableFor: selectedSuitable.length > 0 ? selectedSuitable : ['Family', 'Couples'],
        images: activeImages.length > 0 ? activeImages : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
        published: publishedStatus
      };
    };

    // Form submission (Publish)
    const form = body.querySelector('#admin-prop-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = getFormData(true);

      if (isEdit) {
        store.updateProperty(this.editingPropertyId, data);
        alert('Property updated and published successfully!');
      } else {
        store.addProperty(data);
        alert('New property successfully published and live on KEY TO KOCHI!');
      }

      this.editingPropertyId = null;
      this.switchTab('properties');
    });

    // Save as draft button
    const draftBtn = body.querySelector('#btn-save-draft');
    if (draftBtn) {
      draftBtn.addEventListener('click', () => {
        const title = body.querySelector('#form-title').value.trim();
        if (!title) {
          alert('Please enter at least a Property Name to save as draft.');
          return;
        }
        const data = getFormData(false);

        if (isEdit) {
          store.updateProperty(this.editingPropertyId, data);
          alert('Draft updated successfully!');
        } else {
          store.addProperty(data);
          alert('Property saved as Draft!');
        }

        this.editingPropertyId = null;
        this.switchTab('properties');
      });
    }
  }

  // ================= ENQUIRIES TAB =================
  renderEnquiriesContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    let enquiries = store.getEnquiries();
    const stats = store.getStats();

    if (this.enquiryFilterStatus === 'Unread') {
      enquiries = enquiries.filter(e => e.isRead === false);
    } else if (this.enquiryFilterStatus !== 'All') {
      enquiries = enquiries.filter(e => e.status === this.enquiryFilterStatus);
    }

    body.innerHTML = `
      <div class="admin-enquiries-view">
        <div class="filter-toolbar-card">
          <div class="toolbar-stats-text">
            <div style="display: flex; align-items: center; gap: 10px;">
              <strong>${enquiries.length} Enquiries</strong>
              ${stats.unreadEnquiries > 0 ? `
                <span class="badge-unread-count-pill" id="enquiries-toolbar-unread-count">
                  <span class="unread-dot"></span> ${stats.unreadEnquiries} Unread
                </span>
              ` : `
                <span class="badge-read-all-clear">✓ All Caught Up</span>
              `}
            </div>
            <span class="text-muted">Direct prospective tenant inquiries</span>
          </div>

          <div class="filter-controls-group" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button class="btn-outline-gold btn-mark-all-read" id="btn-mark-all-read" title="Mark all enquiries as read">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Mark All as Read
            </button>

            <select id="enquiry-filter-status" class="admin-select">
              <option value="All" ${this.enquiryFilterStatus === 'All' ? 'selected' : ''}>All Enquiries (${stats.totalEnquiries})</option>
              <option value="Unread" ${this.enquiryFilterStatus === 'Unread' ? 'selected' : ''}>Unread Only (${stats.unreadEnquiries})</option>
              <option value="New" ${this.enquiryFilterStatus === 'New' ? 'selected' : ''}>New (${stats.newEnquiries})</option>
              <option value="Contacted" ${this.enquiryFilterStatus === 'Contacted' ? 'selected' : ''}>Contacted (${stats.contactedEnquiries})</option>
              <option value="Closed" ${this.enquiryFilterStatus === 'Closed' ? 'selected' : ''}>Closed (${stats.closedEnquiries})</option>
            </select>
          </div>
        </div>

        <div class="table-responsive inventory-table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th style="width: 100px;">Status</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Target Property</th>
                <th>Date</th>
                <th>Lead Status</th>
                <th>Message Snippet</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${enquiries.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
                    No enquiries found in this category.
                  </td>
                </tr>
              ` : enquiries.map(e => `
                <tr class="enquiry-table-row ${e.isRead ? 'row-read' : 'row-unread'}" data-id="${e.id}" style="cursor: pointer;">
                  <td>
                    ${e.isRead ? `
                      <span class="enquiry-read-chip chip-read">Read</span>
                    ` : `
                      <span class="enquiry-read-chip chip-unread"><span class="unread-dot"></span> Unread</span>
                    `}
                  </td>
                  <td>
                    <strong class="enquiry-customer-name" style="${!e.isRead ? 'color: var(--gold-light); font-weight: 700;' : ''}">
                      ${e.customerName}
                    </strong>
                  </td>
                  <td>
                    <div><a href="tel:${e.phone}" class="link-contact">${e.phone}</a></div>
                    <div class="text-xs text-muted"><a href="mailto:${e.email}" class="link-contact">${e.email}</a></div>
                  </td>
                  <td><span class="cell-prop-title" title="${e.propertyTitle}">${e.propertyTitle}</span></td>
                  <td><span class="cell-date">${e.date}</span></td>
                  <td>
                    <select class="enquiry-status-select" data-id="${e.id}">
                      <option value="New" ${e.status === 'New' ? 'selected' : ''}>New</option>
                      <option value="Contacted" ${e.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                      <option value="Closed" ${e.status === 'Closed' ? 'selected' : ''}>Closed</option>
                    </select>
                  </td>
                  <td><div class="enquiry-msg-cell" title="${e.message}">${e.message}</div></td>
                  <td style="text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                      <button class="btn-table-action-view btn-view-enquiry" data-id="${e.id}" title="View Details & Mark Read">
                        View
                      </button>
                      <button class="action-btn-read-toggle btn-toggle-read" data-id="${e.id}" title="${e.isRead ? 'Mark as Unread' : 'Mark as Read'}">
                        ${e.isRead ? `
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/></svg>
                        ` : `
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        `}
                      </button>
                      <button class="action-btn-delete" data-id="${e.id}" title="Delete enquiry">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // 1. Status & Unread Filter
    const statusFilter = body.querySelector('#enquiry-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.enquiryFilterStatus = e.target.value;
        this.renderEnquiriesContent();
      });
    }

    // 2. Mark All as Read button
    const markAllBtn = body.querySelector('#btn-mark-all-read');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        store.markAllEnquiriesAsRead();
        this.updateSidebarBadges();
        this.renderEnquiriesContent();
        showToastNotification('All Enquiries Read', 'Unread notification badge cleared.');
      });
    }

    // 3. View Details on Row or Button
    body.querySelectorAll('.btn-view-enquiry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.openEnquiryDetailModal(id);
      });
    });

    body.querySelectorAll('.enquiry-table-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('select') || e.target.closest('button') || e.target.closest('a')) return;
        const id = row.getAttribute('data-id');
        this.openEnquiryDetailModal(id);
      });
    });

    // 4. Quick toggle read/unread button in table
    body.querySelectorAll('.btn-toggle-read').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const enquiry = store.getEnquiries().find(x => x.id === id);
        if (enquiry) {
          if (enquiry.isRead) {
            store.markEnquiryAsUnread(id);
            showToastNotification('Marked as Unread', 'Enquiry notification badge increased.');
          } else {
            store.markEnquiryAsRead(id);
            showToastNotification('Marked as Read', 'Enquiry notification badge updated.');
          }
          this.updateSidebarBadges();
          this.renderEnquiriesContent();
        }
      });
    });

    // 5. Lifecycle Status select
    body.querySelectorAll('.enquiry-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = sel.getAttribute('data-id');
        store.updateEnquiryStatus(id, e.target.value);
      });
    });

    // 6. Delete enquiry
    body.querySelectorAll('.action-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this customer enquiry record?')) {
          store.deleteEnquiry(id);
          this.updateSidebarBadges();
          this.renderEnquiriesContent();
        }
      });
    });
  }

  openEnquiryDetailModal(id) {
    const enquiry = store.getEnquiries().find(e => e.id === id);
    if (!enquiry) return;

    // Requirement: When admin opens an unread enquiry, automatically mark that enquiry as read (isRead = true)
    if (enquiry.isRead === false) {
      store.markEnquiryAsRead(id);
      enquiry.isRead = true;
      this.updateSidebarBadges();
    }

    let modalOverlay = this.container.querySelector('#admin-enquiry-modal-overlay');
    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.id = 'admin-enquiry-modal-overlay';
      modalOverlay.className = 'admin-modal-overlay';
      this.container.appendChild(modalOverlay);
    }

    const renderModalBody = () => {
      const current = store.getEnquiries().find(e => e.id === id) || enquiry;
      modalOverlay.innerHTML = `
        <div class="action-modal-backdrop" id="enquiry-modal-backdrop">
          <div class="action-modal-card enquiry-detail-modal-card">
            <button class="modal-close-btn" id="btn-close-enquiry-detail">&times;</button>
            
            <div class="action-modal-header" style="text-align: left; align-items: flex-start;">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
                <span class="enquiry-modal-date text-xs text-muted">Received on: ${current.date}</span>
                <span class="enquiry-read-chip ${current.isRead ? 'chip-read' : 'chip-unread'}" id="modal-enquiry-read-badge">
                  ${current.isRead ? '✓ Read' : '● Unread'}
                </span>
              </div>
              <h3 style="font-size: 1.4rem; margin-bottom: 4px;">Enquiry from ${current.customerName}</h3>
              <p class="modal-sub" style="margin-bottom: 0;">Target Property: <strong style="color: var(--gold-light);">${current.propertyTitle}</strong></p>
            </div>

            <div class="enquiry-modal-details-body">
              <div class="form-grid-3col" style="margin-bottom: 20px;">
                <div class="detail-info-block">
                  <span class="text-xs text-muted" style="display: block; margin-bottom: 4px;">Contact Phone</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <a href="tel:${current.phone}" class="link-contact" style="font-weight: 600;">${current.phone}</a>
                    <a href="https://wa.me/${current.phone.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="btn-whatsapp-pill" title="WhatsApp Chat">
                      WhatsApp ↗
                    </a>
                  </div>
                </div>

                <div class="detail-info-block">
                  <span class="text-xs text-muted" style="display: block; margin-bottom: 4px;">Email Address</span>
                  <a href="mailto:${current.email}" class="link-contact" style="font-weight: 600;">${current.email}</a>
                </div>

                <div class="detail-info-block">
                  <span class="text-xs text-muted" style="display: block; margin-bottom: 4px;">Lead Status</span>
                  <select class="admin-select" id="modal-select-lead-status" style="width: 100%; padding: 6px 10px;">
                    <option value="New" ${current.status === 'New' ? 'selected' : ''}>New</option>
                    <option value="Contacted" ${current.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                    <option value="Closed" ${current.status === 'Closed' ? 'selected' : ''}>Closed</option>
                  </select>
                </div>
              </div>

              <div class="enquiry-message-container" style="margin-bottom: 24px;">
                <label class="section-label-sm" style="display: block; margin-bottom: 8px; color: var(--gold-light); font-weight: 600;">Tenant Inquiry Message / Requirements:</label>
                <div class="enquiry-message-box">
                  ${current.message}
                </div>
              </div>

              <div class="enquiry-modal-footer-actions">
                <div class="read-actions-left">
                  ${current.isRead ? `
                    <button class="btn-outline-gold" id="btn-modal-mark-unread">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Mark as Unread
                    </button>
                  ` : `
                    <button class="btn-gold-sm" id="btn-modal-mark-read">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Mark as Read
                    </button>
                  `}
                </div>
                <button class="btn-secondary-sm" id="btn-modal-dismiss">Done / Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      modalOverlay.style.display = 'block';

      // Bind events
      const close = () => {
        modalOverlay.innerHTML = '';
        modalOverlay.style.display = 'none';
        this.updateView();
      };

      const closeBtn = modalOverlay.querySelector('#btn-close-enquiry-detail');
      if (closeBtn) closeBtn.addEventListener('click', close);

      const dismissBtn = modalOverlay.querySelector('#btn-modal-dismiss');
      if (dismissBtn) dismissBtn.addEventListener('click', close);

      const backdrop = modalOverlay.querySelector('#enquiry-modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target.id === 'enquiry-modal-backdrop') close();
        });
      }

      const statusSelect = modalOverlay.querySelector('#modal-select-lead-status');
      if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
          store.updateEnquiryStatus(id, e.target.value);
          showToastNotification('Status Updated', `Enquiry status set to "${e.target.value}"`);
        });
      }

      const markUnreadBtn = modalOverlay.querySelector('#btn-modal-mark-unread');
      if (markUnreadBtn) {
        markUnreadBtn.addEventListener('click', () => {
          store.markEnquiryAsUnread(id);
          this.updateSidebarBadges();
          renderModalBody();
          showToastNotification('Marked as Unread', 'Enquiry notification badge has been increased.');
        });
      }

      const markReadBtn = modalOverlay.querySelector('#btn-modal-mark-read');
      if (markReadBtn) {
        markReadBtn.addEventListener('click', () => {
          store.markEnquiryAsRead(id);
          this.updateSidebarBadges();
          renderModalBody();
          showToastNotification('Marked as Read', 'Enquiry notification badge updated.');
        });
      }
    };

    renderModalBody();
  }

  // ================= OWNER SUBMISSIONS TAB =================
  renderSubmissionsContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    const subs = store.getOwnerSubmissions();

    body.innerHTML = `
      <div class="admin-submissions-view">
        <div class="filter-toolbar-card">
          <div>
            <h3>Owner Property Submissions ("List Your Property")</h3>
            <p class="text-xs text-muted">Properties submitted by landlords in Kochi awaiting review and publication.</p>
          </div>
        </div>

        <div class="submissions-cards-grid">
          ${subs.length === 0 ? `
            <div class="empty-state-box">No pending submissions right now.</div>
          ` : subs.map(s => `
            <div class="submission-card ${s.status.toLowerCase()}">
              <div class="sub-header-row">
                <span class="sub-status-badge ${s.status.toLowerCase()}">${s.status}</span>
                <span class="sub-date">${s.date}</span>
              </div>
              <h4 class="sub-title">${s.title}</h4>
              <div class="sub-details-grid">
                <div><strong>Location:</strong> ${s.location}</div>
                <div><strong>Type:</strong> ${s.type} (${s.bhk})</div>
                <div><strong>Rent:</strong> ₹${Number(s.rent).toLocaleString('en-IN')}/mo</div>
                <div><strong>Furnishing:</strong> ${s.furnishing}</div>
                <div><strong>Owner:</strong> ${s.ownerName}</div>
                <div><strong>Phone:</strong> ${s.phone}</div>
              </div>
              <div class="sub-desc-box">${s.description}</div>

              <div class="sub-actions-row">
                ${s.status === 'Pending' ? `
                  <button class="btn-gold-sm btn-approve-sub" data-id="${s.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Approve & Publish
                  </button>
                  <button class="btn-outline-danger-sm btn-reject-sub" data-id="${s.id}">
                    Reject
                  </button>
                ` : `
                  <span class="sub-resolved-note">Submission marked as ${s.status}</span>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.btn-approve-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.approveSubmission(id);
        alert('Submission approved! It has been automatically added to the live public listings.');
      });
    });

    body.querySelectorAll('.btn-reject-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        store.rejectSubmission(id);
      });
    });
  }

  // ================= LOCATIONS TAB =================
  renderLocationsContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    const locations = store.getLocations();
    const stats = store.getStats();

    body.innerHTML = `
      <div class="admin-locations-view">
        <div class="locations-header-card">
          <div>
            <h3>Kochi Coverage Areas</h3>
            <p class="text-xs text-muted">Manage active hubs across Greater Cochin region.</p>
          </div>
          <button class="btn-gold-sm" id="btn-show-add-loc">+ Add New Location</button>
        </div>

        <!-- Add Location Drawer (hidden by default) -->
        <div class="add-loc-drawer" id="add-loc-drawer" style="display: none;">
          <h4>Add New Kochi Neighborhood</h4>
          <form id="form-add-loc" class="add-loc-form">
            <div class="form-grid-3col">
              <div class="form-field">
                <label>Neighborhood Name *</label>
                <input type="text" id="new-loc-name" required placeholder="e.g. Willingdon Island" />
              </div>
              <div class="form-field">
                <label>Key Landmark *</label>
                <input type="text" id="new-loc-landmark" required placeholder="e.g. Cochin Port Trust" />
              </div>
              <div class="form-field">
                <label>Photo URL (Optional)</label>
                <input type="url" id="new-loc-img" placeholder="https://..." value="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" />
              </div>
            </div>
            <div class="form-field full-width">
              <label>Description</label>
              <input type="text" id="new-loc-desc" placeholder="Brief highlight of this area..." />
            </div>
            <div class="drawer-actions">
              <button type="submit" class="btn-gold-sm">Save Location</button>
              <button type="button" class="btn-outline-sm" id="btn-cancel-add-loc">Cancel</button>
            </div>
          </form>
        </div>

        <div class="locations-cards-grid">
          ${locations.map(loc => {
            const count = stats.locationStats[loc.name] || 0;
            return `
              <div class="admin-loc-card">
                <img src="${loc.image}" alt="${loc.name}" class="loc-card-img" />
                <div class="loc-card-body">
                  <div class="loc-card-title-row">
                    <h4>${loc.name}</h4>
                    <span class="loc-badge-count">${count} properties</span>
                  </div>
                  <div class="loc-landmark-tag">${loc.landmark}</div>
                  <p class="loc-card-desc">${loc.description}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const showAddBtn = body.querySelector('#btn-show-add-loc');
    const drawer = body.querySelector('#add-loc-drawer');
    const cancelBtn = body.querySelector('#btn-cancel-add-loc');
    const form = body.querySelector('#form-add-loc');

    if (showAddBtn && drawer) {
      showAddBtn.addEventListener('click', () => {
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (cancelBtn && drawer) {
      cancelBtn.addEventListener('click', () => {
        drawer.style.display = 'none';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = body.querySelector('#new-loc-name').value.trim();
        const landmark = body.querySelector('#new-loc-landmark').value.trim();
        const image = body.querySelector('#new-loc-img').value.trim() || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
        const description = body.querySelector('#new-loc-desc').value.trim() || 'Prime residential location in Kochi.';

        store.addLocation({ name, landmark, image, description });
        alert(`Location "${name}" added successfully!`);
        drawer.style.display = 'none';
      });
    }
  }

  // ================= SETTINGS & DATA TAB =================
  renderSettingsContent() {
    const body = this.container.querySelector('#admin-content-body');
    if (!body) return;

    body.innerHTML = `
      <div class="admin-settings-view">
        <div class="settings-card">
          <h3>Platform Data Management</h3>
          <p class="text-muted">Use these utilities to reset sample test data or inspect local storage synchronization.</p>

          <div class="settings-action-box">
            <div>
              <strong>Reset System to Factory Sample Data</strong>
              <p class="text-xs text-muted">Restores all original 10 authentic Kochi properties, sample enquiries, and test locations.</p>
            </div>
            <button class="btn-outline-danger" id="btn-reset-demo-data">
              Reset Demo Data
            </button>
          </div>
        </div>

        <div class="settings-card" style="margin-top: 24px;">
          <h3>Admin Credentials</h3>
          <div class="credentials-info-box">
            <div><strong>Demo Admin Email:</strong> admin@keytokochi.com</div>
            <div><strong>Default Password:</strong> kochi2025</div>
            <span class="text-xs text-muted">Role: Master Administrator (Full R/W Access)</span>
          </div>
        </div>
      </div>
    `;

    const resetBtn = body.querySelector('#btn-reset-demo-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to restore initial demo data? Any custom properties will be reset.')) {
          store.resetDefaults();
          alert('Demo data restored successfully!');
          this.switchTab('dashboard');
        }
      });
    }
  }
}
