import { store } from './store/state.js';
import { initThreeScene } from './components/threeScene.js';
import { openPropertyModal } from './components/propertyModal.js';
import { openEnquiryModal, openScheduleVisitModal, showToastNotification } from './components/actionModals.js';
import { openListPropertyModal } from './components/listPropertyModal.js';
import { AdminPortal } from './components/adminPortal.js';
import { AdminLoginScreen } from './components/adminLoginScreen.js';

// Application State for Public Filters
const filterState = {
  searchQuery: '',
  location: 'All',
  suitableFor: 'All',
  type: 'All',
  bhk: 'All',
  furnishing: 'All',
  availability: 'All',
  minRent: 0,
  maxRent: Infinity,
  minSize: 0,
  amenities: [],
  sort: 'featured'
};

let adminPortalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D Hero Scene
  const heroContainer = document.getElementById('hero-canvas-container');
  if (heroContainer) {
    initThreeScene(heroContainer);
  }

  // 2. Setup Sticky Navbar Scroll Effect
  setupNavbarScroll();

  // 3. Populate Dynamic Location Dropdowns
  populateLocationDropdowns();

  // 4. Render All Public Sections
  renderPopularLocations();
  renderFeaturedProperties();
  renderPropertiesListing();

  // 5. Setup Event Listeners (Filters, Hero Search, Modals, Admin)
  setupEventListeners();

  // 6. Animate Numbers
  animateCounters();

  // 7. Subscribe to Central Store for instant live reactivity
  store.subscribe((eventType, payload) => {
    // Whenever anything updates in store (Admin added property, changed status, etc.)
    renderPropertiesListing();
    renderFeaturedProperties();
    renderPopularLocations();
  });
});

/* ==========================================================================
   NAVBAR & SCROLL
   ========================================================================== */
function setupNavbarScroll() {
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });

  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobile-toggle-btn');
  const mobileDrawer = document.getElementById('mobile-menu-drawer');
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('show');
    });

    mobileDrawer.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('show');
      });
    });
  }
}

/* ==========================================================================
   DROPDOWNS
   ========================================================================== */
function populateLocationDropdowns() {
  const locations = store.getLocations();
  const heroLocSelect = document.getElementById('hero-filter-loc');
  const mainLocSelect = document.getElementById('filter-location');

  const optionsHtml = `
    <option value="All">All Kochi Locations</option>
    ${locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('')}
  `;

  if (heroLocSelect) heroLocSelect.innerHTML = optionsHtml;
  if (mainLocSelect) mainLocSelect.innerHTML = optionsHtml;
}

/* ==========================================================================
   RENDER FEATURED PROPERTIES
   ========================================================================== */
function renderFeaturedProperties() {
  const container = document.getElementById('featured-cards-container');
  if (!container) return;

  const props = store.getProperties().filter(p => p.featured || p.rent >= 40000).slice(0, 3);

  container.innerHTML = props.map(p => createPropertyCardHtml(p, true)).join('');
  attachPropertyCardEvents(container);
}

/* ==========================================================================
   RENDER POPULAR LOCATIONS
   ========================================================================== */
function renderPopularLocations() {
  const container = document.getElementById('popular-locations-container');
  if (!container) return;

  const locations = store.getLocations();
  const stats = store.getStats();

  container.innerHTML = locations.slice(0, 8).map(loc => {
    const count = stats.locationStats[loc.name] || 0;
    return `
      <div class="location-tile-card" data-location="${loc.name}">
        <img src="${loc.image}" alt="${loc.name}" loading="lazy" />
        <div class="location-tile-overlay">
          <h3 class="loc-tile-title">${loc.name}</h3>
          <span class="loc-tile-landmark">${loc.landmark}</span>
          <span class="loc-tile-count">${count} Verified Units &rarr;</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.location-tile-card').forEach(card => {
    card.addEventListener('click', () => {
      const loc = card.getAttribute('data-location');
      filterState.location = loc;
      const select = document.getElementById('filter-location');
      if (select) select.value = loc;
      renderPropertiesListing();
      scrollToSection('search-section');
    });
  });
}

/* ==========================================================================
   RENDER PROPERTIES LISTING & FILTERS
   ========================================================================== */
function renderPropertiesListing() {
  const container = document.getElementById('properties-cards-container');
  const countRibbon = document.getElementById('results-count-text');
  const chipsContainer = document.getElementById('active-filter-chips');
  if (!container) return;

  let properties = store.getProperties();

  // Apply filters
  if (filterState.searchQuery) {
    const q = filterState.searchQuery.toLowerCase();
    properties = properties.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  if (filterState.location !== 'All') {
    properties = properties.filter(p => p.location === filterState.location);
  }

  if (filterState.suitableFor !== 'All') {
    properties = properties.filter(p => p.suitableFor && p.suitableFor.includes(filterState.suitableFor));
  }

  if (filterState.type !== 'All') {
    properties = properties.filter(p => p.type === filterState.type);
  }

  if (filterState.bhk !== 'All') {
    properties = properties.filter(p => p.bhk === filterState.bhk);
  }

  if (filterState.furnishing !== 'All') {
    properties = properties.filter(p => p.furnishing === filterState.furnishing);
  }

  if (filterState.availability !== 'All') {
    properties = properties.filter(p => p.availability === filterState.availability);
  }

  if (filterState.minRent > 0) {
    properties = properties.filter(p => p.rent >= filterState.minRent);
  }

  if (filterState.maxRent < Infinity) {
    properties = properties.filter(p => p.rent <= filterState.maxRent);
  }

  if (filterState.minSize > 0) {
    properties = properties.filter(p => (p.size || 0) >= filterState.minSize);
  }

  if (filterState.amenities.length > 0) {
    properties = properties.filter(p => {
      const facilities = p.facilities || [];
      return filterState.amenities.every(amenity => facilities.includes(amenity));
    });
  }

  // Sort
  if (filterState.sort === 'price-asc') {
    properties.sort((a, b) => a.rent - b.rent);
  } else if (filterState.sort === 'price-desc') {
    properties.sort((a, b) => b.rent - a.rent);
  } else if (filterState.sort === 'newest') {
    properties.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else {
    // featured first
    properties.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  // Update count ribbon
  if (countRibbon) {
    countRibbon.innerHTML = `Showing <strong>${properties.length}</strong> verified properties in Kochi`;
  }

  // Update active chips
  if (chipsContainer) {
    const chips = [];
    if (filterState.location !== 'All') chips.push(`Loc: ${filterState.location}`);
    if (filterState.suitableFor !== 'All') chips.push(`Suitable: ${filterState.suitableFor}`);
    if (filterState.bhk !== 'All') chips.push(`${filterState.bhk}`);
    if (filterState.furnishing !== 'All') chips.push(`${filterState.furnishing}`);
    if (filterState.type !== 'All') chips.push(`${filterState.type}`);
    if (filterState.availability !== 'All') chips.push(`${filterState.availability}`);
    if (filterState.maxRent < Infinity) chips.push(`≤ ₹${filterState.maxRent.toLocaleString('en-IN')}`);
    if (filterState.amenities.length > 0) chips.push(`+${filterState.amenities.length} Amenities`);

    chipsContainer.innerHTML = chips.map(c => `
      <span class="amenity-chip active-filter-badge">${c}</span>
    `).join('');
  }

  // Render cards
  if (properties.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-card);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.5" style="margin-bottom: 16px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <h3 style="font-size: 1.3rem; margin-bottom: 8px;">No Properties Found</h3>
        <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 20px;">We couldn't find properties matching your current filter set. Try clearing some filters or searching a different Kochi neighborhood.</p>
        <button class="btn-gold-sm" id="btn-empty-clear-filters">Clear All Filters</button>
      </div>
    `;
    const clearBtn = container.querySelector('#btn-empty-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', resetAllFilters);
    return;
  }

  container.innerHTML = properties.map(p => createPropertyCardHtml(p)).join('');
  attachPropertyCardEvents(container);
}

function createPropertyCardHtml(property, isFeaturedBadge = false) {
  const isAvailable = property.availability === 'Available';
  const coverImg = property.images && property.images.length > 0 ? property.images[0] : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

  const cardWhatsAppMsg = encodeURIComponent(`Hello Key to Kochi, I am interested in the ${property.title} in ${property.location}. Please provide more details.`);
  const cardWhatsAppUrl = `https://wa.me/919656959652?text=${cardWhatsAppMsg}`;

  return `
    <article class="property-card" data-id="${property.id}">
      <div class="prop-card-media">
        <img src="${coverImg}" alt="${property.title}" loading="lazy" />
        <div class="prop-card-badges-top">
          ${property.featured || isFeaturedBadge ? '<span class="badge-featured">Featured</span>' : ''}
          <span class="badge-status ${isAvailable ? 'available' : 'rented'}">
            ${isAvailable ? 'Available' : 'Rented'}
          </span>
        </div>
        <div class="prop-card-furnish-tag">${property.furnishing}</div>
      </div>

      <div class="prop-card-body">
        <div class="prop-card-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${property.location}, Kochi</span>
        </div>

        <h3 class="prop-card-title" title="${property.title}">${property.title}</h3>

        <div class="prop-specs-row">
          <div class="spec-item">
            <span class="spec-label">Config</span>
            <span class="spec-val">${property.bhk}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Baths</span>
            <span class="spec-val">${property.bathrooms || 2} Bath</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Size</span>
            <span class="spec-val">${property.size} sq.ft</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Type</span>
            <span class="spec-val">${property.type}</span>
          </div>
        </div>

        <!-- Suitable For / Tenant Types -->
        <div class="prop-card-suitable-box">
          <span class="suitable-box-label">Suitable For</span>
          <div class="suitable-chips-wrap">
            ${(property.suitableFor && property.suitableFor.length > 0 ? property.suitableFor : ['Family']).map(t => {
              const icon = t === 'Family' ? '👨‍👩‍👧' : (t === 'Bachelors' ? '👤' : '❤️');
              return `<span class="badge-suitable-pill ${t.toLowerCase()}">${icon} ${t}</span>`;
            }).join('')}
          </div>
        </div>

        <div class="prop-card-footer">
          <div class="prop-price-box">
            <span class="prop-rent-val">₹${property.rent.toLocaleString('en-IN')}</span>
            <span class="prop-rent-period">per month</span>
          </div>
          <div class="prop-card-actions">
            <a href="${cardWhatsAppUrl}" target="_blank" rel="noopener noreferrer" class="btn-card-whatsapp" title="Contact on WhatsApp" onclick="event.stopPropagation()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>WhatsApp</span>
            </a>
            <button class="btn-card-details btn-trigger-details" data-id="${property.id}">View Details</button>
            <button class="btn-card-enquire btn-trigger-enquire" data-id="${property.id}">Send Enquiry</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function attachPropertyCardEvents(container) {
  // View Details Buttons
  container.querySelectorAll('.btn-trigger-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openPropertyModal(id, (prop) => openEnquiryModal(prop), (prop) => openScheduleVisitModal(prop));
    });
  });

  // Card click triggers details
  container.querySelectorAll('.property-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      openPropertyModal(id, (prop) => openEnquiryModal(prop), (prop) => openScheduleVisitModal(prop));
    });
  });

  // Send Enquiry Quick Buttons
  container.querySelectorAll('.btn-trigger-enquire').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const prop = store.getPropertyById(id);
      openEnquiryModal(prop);
    });
  });
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================== */
function setupEventListeners() {
  // 1. Hero Search Box
  const heroSearchBtn = document.getElementById('btn-hero-search');
  if (heroSearchBtn) {
    heroSearchBtn.addEventListener('click', () => {
      const locVal = document.getElementById('hero-filter-loc').value;
      const typeVal = document.getElementById('hero-filter-type').value;
      const bhkVal = document.getElementById('hero-filter-bhk').value;
      const furnVal = document.getElementById('hero-filter-furnish').value;
      const maxRentVal = document.getElementById('hero-filter-max-rent').value;

      filterState.location = locVal;
      filterState.type = typeVal;
      filterState.bhk = bhkVal;
      filterState.furnishing = furnVal;
      filterState.maxRent = maxRentVal === 'All' ? Infinity : Number(maxRentVal);

      // Sync with main filter controls
      syncMainFilterInputs();
      renderPropertiesListing();
      scrollToSection('search-section');
    });
  }

  // 2. Main Live Search Filters
  const liveSearch = document.getElementById('live-search-query');
  if (liveSearch) {
    liveSearch.addEventListener('input', (e) => {
      filterState.searchQuery = e.target.value.trim();
      renderPropertiesListing();
    });
  }

  const locSelect = document.getElementById('filter-location');
  if (locSelect) {
    locSelect.addEventListener('change', (e) => {
      filterState.location = e.target.value;
      renderPropertiesListing();
    });
  }

  const suitableSelect = document.getElementById('filter-suitable-for');
  if (suitableSelect) {
    suitableSelect.addEventListener('change', (e) => {
      filterState.suitableFor = e.target.value;
      renderPropertiesListing();
    });
  }

  const typeSelect = document.getElementById('filter-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      filterState.type = e.target.value;
      renderPropertiesListing();
    });
  }

  const bhkSelect = document.getElementById('filter-bhk');
  if (bhkSelect) {
    bhkSelect.addEventListener('change', (e) => {
      filterState.bhk = e.target.value;
      renderPropertiesListing();
    });
  }

  const furnSelect = document.getElementById('filter-furnishing');
  if (furnSelect) {
    furnSelect.addEventListener('change', (e) => {
      filterState.furnishing = e.target.value;
      renderPropertiesListing();
    });
  }

  const availSelect = document.getElementById('filter-availability');
  if (availSelect) {
    availSelect.addEventListener('change', (e) => {
      filterState.availability = e.target.value;
      renderPropertiesListing();
    });
  }

  const sortSelect = document.getElementById('filter-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      filterState.sort = e.target.value;
      renderPropertiesListing();
    });
  }

  // Lifestyle Section Cards / CTAs (Find a Home That Fits Your Lifestyle)
  document.querySelectorAll('.btn-lifestyle-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tenantCategory = btn.getAttribute('data-tenant');
      if (tenantCategory) {
        filterState.suitableFor = tenantCategory;
        syncMainFilterInputs();
        renderPropertiesListing();
        scrollToSection('search-section');
      }
    });
  });

  document.querySelectorAll('.lifestyle-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-lifestyle-action')) return;
      const tenantCategory = card.getAttribute('data-tenant');
      if (tenantCategory) {
        filterState.suitableFor = tenantCategory;
        syncMainFilterInputs();
        renderPropertiesListing();
        scrollToSection('search-section');
      }
    });
  });

  // Drawer Toggle
  const toggleDrawerBtn = document.getElementById('btn-toggle-amenities');
  const drawer = document.getElementById('filter-amenities-drawer');
  if (toggleDrawerBtn && drawer) {
    toggleDrawerBtn.addEventListener('click', () => {
      const isHidden = drawer.style.display === 'none';
      drawer.style.display = isHidden ? 'block' : 'none';
      toggleDrawerBtn.querySelector('.chevron-arrow').textContent = isHidden ? '▲' : '▼';
    });
  }

  // Amenities and Rent Range in Drawer
  const minRentInput = document.getElementById('filter-min-rent');
  const maxRentInput = document.getElementById('filter-max-rent');
  const minSizeInput = document.getElementById('filter-min-size');

  if (minRentInput) {
    minRentInput.addEventListener('input', (e) => {
      filterState.minRent = Number(e.target.value) || 0;
      renderPropertiesListing();
    });
  }
  if (maxRentInput) {
    maxRentInput.addEventListener('input', (e) => {
      filterState.maxRent = e.target.value ? Number(e.target.value) : Infinity;
      renderPropertiesListing();
    });
  }
  if (minSizeInput) {
    minSizeInput.addEventListener('input', (e) => {
      filterState.minSize = Number(e.target.value) || 0;
      renderPropertiesListing();
    });
  }

  const amenityChips = document.querySelectorAll('#amenities-tag-selector input[type="checkbox"]');
  amenityChips.forEach(cb => {
    cb.addEventListener('change', () => {
      filterState.amenities = Array.from(amenityChips).filter(c => c.checked).map(c => c.value);
      renderPropertiesListing();
    });
  });

  // Reset Filters Button
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);

  // 3. BHK Cards Clicks
  document.querySelectorAll('.bhk-card').forEach(card => {
    card.addEventListener('click', () => {
      const bhk = card.getAttribute('data-bhk');
      filterState.bhk = bhk;
      syncMainFilterInputs();
      renderPropertiesListing();
      scrollToSection('search-section');
    });
  });

  // 4. Furnishing Cards Clicks
  document.querySelectorAll('.furnishing-card').forEach(card => {
    card.addEventListener('click', () => {
      const furnish = card.getAttribute('data-furnishing');
      filterState.furnishing = furnish;
      syncMainFilterInputs();
      renderPropertiesListing();
      scrollToSection('search-section');
    });
  });

  // 5. Footer Location links
  document.querySelectorAll('.footer-loc-link').forEach(link => {
    link.addEventListener('click', () => {
      const loc = link.getAttribute('data-loc');
      filterState.location = loc;
      syncMainFilterInputs();
      renderPropertiesListing();
      scrollToSection('search-section');
    });
  });

  // 6. "List Your Property" Triggers
  const listPropTriggers = [
    document.getElementById('nav-list-property'),
    document.getElementById('mobile-nav-list-prop'),
    document.getElementById('btn-banner-list-property'),
    document.getElementById('footer-list-prop-link')
  ];
  listPropTriggers.forEach(el => {
    if (el) el.addEventListener('click', () => openListPropertyModal());
  });

  // 7. Public Contact Form
  const contactForm = document.getElementById('public-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      store.addEnquiry({
        customerName: name,
        phone,
        email,
        propertyTitle: 'Direct Consultation Request',
        message
      });

      contactForm.reset();
      showToastNotification('Message Sent!', 'Our Kochi property advisor will connect with you promptly.');
    });
  }

  // 8. Footer Newsletter
  const newsletterForm = document.getElementById('footer-newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      newsletterForm.reset();
      showToastNotification('Subscribed!', 'You will receive priority access to new rental properties in Kochi.');
    });
  }

  // 9. Hidden Admin Access — Logo Multi-Click (5× in 3s) & Ctrl+Shift+A
  setupHiddenAdminAccess();
}

/* ==========================================================================
   HIDDEN ADMIN ACCESS — NO VISIBLE INDICATION ON PUBLIC SITE
   5× logo clicks within 3s  OR  Ctrl+Shift+A  → opens Admin Login modal.
   Authentication is ALWAYS required. These triggers never bypass security.
   ========================================================================== */
function handleAdminTrigger() {
  // If already authenticated, go straight to dashboard
  if (store.state.adminAuth.isAuthenticated) {
    launchAdminPortal();
    return;
  }

  // Show the cinematic 3D Admin Login Screen
  const adminRoot = document.getElementById('admin-portal-container');
  const publicRoot = document.getElementById('public-app-root');
  const floatingWA = document.getElementById('floating-whatsapp-btn');
  if (!adminRoot) return;

  // Hide public site while login screen is active
  adminRoot.style.display = 'flex';
  if (publicRoot) publicRoot.style.display = 'none';
  if (floatingWA) floatingWA.style.display = 'none';

  const loginScreen = new AdminLoginScreen(
    adminRoot,
    // onSuccess — authentication passed, open the dashboard
    () => {
      launchAdminPortal();
    },
    // onClose — user cancelled, return to public site
    () => {
      adminRoot.style.display = 'none';
      if (publicRoot) publicRoot.style.display = 'block';
      if (floatingWA) floatingWA.style.display = '';
    }
  );
  loginScreen.mount();
}

function setupHiddenAdminAccess() {
  // --- Logo multi-click trigger (5 clicks within 3 seconds) ---
  const logoEl = document.getElementById('nav-brand-logo');
  let clickCount = 0;
  let clickResetTimer = null;

  const onLogoClick = (e) => {
    // Prevent normal anchor navigation only when accumulating clicks
    // We still allow normal navigation after the sequence times out.
    clickCount++;

    // Clear any existing reset timer and start a fresh 3-second window
    if (clickResetTimer) clearTimeout(clickResetTimer);
    clickResetTimer = setTimeout(() => {
      clickCount = 0;
      clickResetTimer = null;
    }, 3000);

    if (clickCount >= 5) {
      // Threshold reached — open admin access
      e.preventDefault();
      clickCount = 0;
      clearTimeout(clickResetTimer);
      clickResetTimer = null;
      handleAdminTrigger();
    }
  };

  if (logoEl) {
    logoEl.addEventListener('click', onLogoClick);
    // Also support touch for mobile (touchend fires before click, use click for consistency)
    logoEl.addEventListener('touchend', (e) => {
      // touchend doesn't always fire a click; manually call onLogoClick
      onLogoClick(e);
    }, { passive: false });
  }

  // --- Keyboard shortcut: Ctrl + Shift + A ---
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      handleAdminTrigger();
    }
  });
}

/* ==========================================================================
   ADMIN PORTAL MOUNT / UNMOUNT
   ========================================================================== */
function launchAdminPortal() {
  const adminRoot = document.getElementById('admin-portal-container');
  const publicRoot = document.getElementById('public-app-root');
  const floatingWA = document.getElementById('floating-whatsapp-btn');
  if (!adminRoot) return;

  adminRoot.style.display = 'flex';
  if (publicRoot) publicRoot.style.display = 'none';
  if (floatingWA) floatingWA.style.display = 'none';

  if (!adminPortalInstance) {
    adminPortalInstance = new AdminPortal(adminRoot, () => {
      // Callback to exit admin portal
      adminRoot.style.display = 'none';
      if (publicRoot) publicRoot.style.display = 'block';
      if (floatingWA) floatingWA.style.display = '';
      if (adminPortalInstance) {
        adminPortalInstance.unmount();
        adminPortalInstance = null;
      }
      renderPropertiesListing();
      renderFeaturedProperties();
    });
    adminPortalInstance.mount();
  }
}

/* ==========================================================================
   RESET & SYNC UTILS
   ========================================================================== */
function resetAllFilters() {
  filterState.searchQuery = '';
  filterState.location = 'All';
  filterState.suitableFor = 'All';
  filterState.type = 'All';
  filterState.bhk = 'All';
  filterState.furnishing = 'All';
  filterState.availability = 'All';
  filterState.minRent = 0;
  filterState.maxRent = Infinity;
  filterState.minSize = 0;
  filterState.amenities = [];
  filterState.sort = 'featured';

  syncMainFilterInputs();
  renderPropertiesListing();
}

function syncMainFilterInputs() {
  const locSelect = document.getElementById('filter-location');
  const suitableSelect = document.getElementById('filter-suitable-for');
  const typeSelect = document.getElementById('filter-type');
  const bhkSelect = document.getElementById('filter-bhk');
  const furnSelect = document.getElementById('filter-furnishing');
  const availSelect = document.getElementById('filter-availability');
  const searchInput = document.getElementById('live-search-query');

  if (locSelect) locSelect.value = filterState.location;
  if (suitableSelect) suitableSelect.value = filterState.suitableFor;
  if (typeSelect) typeSelect.value = filterState.type;
  if (bhkSelect) bhkSelect.value = filterState.bhk;
  if (furnSelect) furnSelect.value = filterState.furnishing;
  if (availSelect) availSelect.value = filterState.availability;
  if (searchInput) searchInput.value = filterState.searchQuery;
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ==========================================================================
   ANIMATED COUNTERS
   ========================================================================== */
function animateCounters() {
  const counters = document.querySelectorAll('.stat-number[data-target]');
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    let count = 0;
    const increment = target / 40;
    const update = () => {
      count += increment;
      if (count < target) {
        counter.textContent = `${Math.ceil(count)}+`;
        requestAnimationFrame(update);
      } else {
        counter.textContent = `${target}+`;
      }
    };
    update();
  });
}
