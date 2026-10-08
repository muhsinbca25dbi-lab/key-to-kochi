import { store } from '../store/state.js';
import { TENANT_TYPE_CONFIG } from '../data/initialData.js';

export function openPropertyModal(propertyId, onEnquiryOpen, onScheduleOpen) {
  const property = store.getPropertyById(propertyId);
  if (!property) return;

  const modalContainer = document.getElementById('property-modal-container');
  if (!modalContainer) return;

  let currentImageIdx = 0;
  const images = property.images && property.images.length > 0 ? property.images : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'];

  const allFacilities = [
    { name: 'Parking', icon: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3 3 0 0 0 2 12v4c0 .6.4 1 1 1h2' },
    { name: 'Wi-Fi', icon: 'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01' },
    { name: 'AC', icon: 'M8 16a4 4 0 0 1-4-4V6a4 4 0 0 1 8 0v6a4 4 0 0 1-4 4Z' },
    { name: 'Lift', icon: 'm7 15 5 5 5-5M7 9l5-5 5 5' },
    { name: 'Security', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
    { name: 'Water Supply', icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' },
    { name: 'Power Backup', icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' },
    { name: 'Attached Bathroom', icon: 'M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.7 3 4 3.7 4 4.5V11M4 11h16a1 1 0 0 1 1 1v1a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7v-1a1 1 0 0 1 1-1Z' },
    { name: 'Kitchen', icon: 'M18 2h-3a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z' },
    { name: 'Balcony', icon: 'M3 11V3h18v8M3 17v4h18v-4M3 11h18M3 17h18' },
    { name: 'Gym', icon: 'm6.5 6.5 11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4' },
    { name: 'Swimming Pool', icon: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1' },
    { name: 'Pet Friendly', icon: 'M10 5.172a2 2 0 0 0-3.414 0l-.172.246A2 2 0 0 1 4.772 6.5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h.772a2 2 0 0 1 1.642 1.082l.172.246a2 2 0 0 0 3.414 0' }
  ];

  const propFacilities = property.facilities || [];
  const whatsappPropMsg = encodeURIComponent(`Hello Key to Kochi, I am interested in the ${property.title} in ${property.location}. Please provide more details.`);
  const whatsappPropUrl = `https://wa.me/919656959652?text=${whatsappPropMsg}`;

  modalContainer.innerHTML = `
    <div class="property-modal-backdrop" id="prop-modal-backdrop">
      <div class="property-modal-content">
        <!-- Close Button -->
        <button class="modal-close-btn" id="btn-close-prop-modal" aria-label="Close modal">&times;</button>

        <div class="modal-scroll-body">
          <!-- Gallery Section -->
          <div class="prop-modal-gallery">
            <div class="main-gallery-view">
              <img id="modal-main-image" src="${images[0]}" alt="${property.title}" />
              <div class="gallery-nav-buttons">
                <button class="gallery-nav-prev" id="btn-gallery-prev" aria-label="Previous image">&#10094;</button>
                <button class="gallery-nav-next" id="btn-gallery-next" aria-label="Next image">&#10095;</button>
              </div>
              <div class="gallery-badges">
                <span class="badge-status ${property.availability === 'Available' ? 'available' : 'rented'}">
                  ${property.availability === 'Available' ? 'Available for Immediate Move-In' : 'Currently Rented'}
                </span>
                <span class="badge-furnish">${property.furnishing}</span>
              </div>
            </div>

            <!-- Thumbnails strip -->
            <div class="gallery-thumbnails-strip">
              ${images.map((img, idx) => `
                <div class="thumb-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                  <img src="${img}" alt="Thumbnail ${idx + 1}" />
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Main Details Layout Grid -->
          <div class="prop-modal-details-grid">
            <!-- Left Column: Specs, Amenities, Description, Location Map -->
            <div class="modal-left-column">
              <div class="prop-title-section">
                <div class="location-crumb">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${property.location}, Kochi • Kerala</span>
                </div>
                <h2>${property.title}</h2>
                <p class="prop-address-full">${property.address}</p>
              </div>

              <!-- Quick Specs Ribbon -->
              <div class="prop-specs-ribbon">
                <div class="spec-cell">
                  <span class="spec-label">Bedrooms</span>
                  <span class="spec-val">${property.bedrooms || property.bhk.split(' ')[0]} BHK</span>
                </div>
                <div class="spec-divider"></div>
                <div class="spec-cell">
                  <span class="spec-label">Bathrooms</span>
                  <span class="spec-val">${property.bathrooms || 2} En-Suite</span>
                </div>
                <div class="spec-divider"></div>
                <div class="spec-cell">
                  <span class="spec-label">Super Built-up Area</span>
                  <span class="spec-val">${property.size} sq.ft</span>
                </div>
                <div class="spec-divider"></div>
                <div class="spec-cell">
                  <span class="spec-label">Property Category</span>
                  <span class="spec-val">${property.type}</span>
                </div>
              </div>

              <!-- About & Description -->
              <div class="prop-section-block">
                <h3>About This Property</h3>
                <p class="prop-full-description">${property.description}</p>
              </div>

              <!-- Suitable For (Tenant Types) -->
              <div class="prop-section-block">
                <h3>Suitable For</h3>
                <div class="suitable-for-badges-grid">
                  ${(property.suitableFor && property.suitableFor.length > 0 ? property.suitableFor : ['Family']).map(t => {
                    const cfg = TENANT_TYPE_CONFIG[t] || { badge: t, tagline: 'Verified tenant match', icon: '✨' };
                    return `
                      <div class="tenant-suitability-badge-card">
                        <div class="suitability-badge-header">
                          <span class="badge-icon-lg">${cfg.icon}</span>
                          <div>
                            <strong class="suitability-type-title">${t === 'Family' ? 'Family Friendly' : t === 'Bachelors' ? 'Bachelor Friendly' : 'Couple Friendly'}</strong>
                            <span class="suitability-badge-tag">${cfg.badge}</span>
                          </div>
                        </div>
                        <p class="suitability-badge-desc">${cfg.tagline}</p>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Facilities & Amenities -->
              <div class="prop-section-block">
                <h3>Facilities & Lifestyle Amenities</h3>
                <div class="facilities-pill-grid">
                  ${allFacilities.map(fac => {
                    const hasFac = propFacilities.includes(fac.name);
                    return `
                      <div class="facility-pill ${hasFac ? 'active' : 'inactive'}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="${fac.icon}"/>
                        </svg>
                        <span>${fac.name}</span>
                        ${hasFac ? '<span class="fac-check">✓</span>' : '<span class="fac-cross">✕</span>'}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Kochi Location & Proximity Map -->
              <div class="prop-section-block">
                <h3>Neighborhood & Proximity Highlights</h3>
                <div class="location-guide-card">
                  <div class="proximity-tags">
                    <span class="prox-badge">🚇 5 mins to Kochi Metro</span>
                    <span class="prox-badge">🛍️ Near Supermarkets & Malls</span>
                    <span class="prox-badge">🏥 24/7 Multi-specialty Hospital</span>
                    <span class="prox-badge">🏫 Leading ICSE/CBSE Schools</span>
                  </div>
                  <!-- Stylized Dark Kochi Interactive Map -->
                  <div class="stylized-kochi-map">
                    <div class="map-water-layer"></div>
                    <div class="map-road-grid"></div>
                    <div class="map-pin-pulse">
                      <div class="pulse-ring"></div>
                      <div class="pin-marker">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#d4af37" stroke="#000" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#000"/></svg>
                      </div>
                    </div>
                    <div class="map-location-tag">
                      <strong>${property.location}</strong>
                      <span>Kochi, Kerala</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Sticky Pricing & Action Card -->
            <div class="modal-right-column">
              <div class="sticky-pricing-card">
                <div class="price-header">
                  <div class="rent-amount">
                    <span class="currency-symbol">₹</span>
                    <span class="amount-number">${property.rent.toLocaleString('en-IN')}</span>
                    <span class="rent-period">/ month</span>
                  </div>
                  <div class="deposit-note">
                    Security Deposit: <strong>₹${(property.deposit || property.rent * 3).toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div class="rental-terms-box">
                  <div class="term-row">
                    <span>Maintenance:</span>
                    <strong>Included in Rent</strong>
                  </div>
                  <div class="term-row">
                    <span>Brokerage:</span>
                    <strong class="text-emerald">0% Direct Key to Kochi</strong>
                  </div>
                  <div class="term-row">
                    <span>Lock-in Period:</span>
                    <strong>6 Months</strong>
                  </div>
                  <div class="term-row">
                    <span>Notice Period:</span>
                    <strong>1 Month</strong>
                  </div>
                </div>

                <!-- Primary Action Buttons -->
                <div class="modal-actions-stack">
                  <a href="${whatsappPropUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-lg" id="btn-modal-whatsapp" title="Contact on WhatsApp">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span>Contact on WhatsApp</span>
                  </a>

                  <button class="btn-gold-lg" id="btn-modal-send-enquiry">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Send Rental Enquiry
                  </button>

                  <button class="btn-outline-gold-lg" id="btn-modal-schedule-visit">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Schedule Physical Visit
                  </button>

                  <button class="btn-dark-glass-lg" id="btn-modal-contact-owner">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Contact Property Manager
                  </button>
                </div>

                <!-- Verified Security Badge -->
                <div class="verified-guarantee-pill">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>100% Physical Property & Title Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Gallery Navigation
  const mainImg = modalContainer.querySelector('#modal-main-image');
  const thumbs = modalContainer.querySelectorAll('.thumb-item');

  function updateGalleryImage(index) {
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    currentImageIdx = index;
    mainImg.src = images[currentImageIdx];
    thumbs.forEach(t => {
      const idx = parseInt(t.getAttribute('data-idx'));
      t.classList.toggle('active', idx === currentImageIdx);
    });
  }

  const prevBtn = modalContainer.querySelector('#btn-gallery-prev');
  const nextBtn = modalContainer.querySelector('#btn-gallery-next');
  if (prevBtn) prevBtn.addEventListener('click', () => updateGalleryImage(currentImageIdx - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => updateGalleryImage(currentImageIdx + 1));

  thumbs.forEach(t => {
    t.addEventListener('click', () => {
      const idx = parseInt(t.getAttribute('data-idx'));
      updateGalleryImage(idx);
    });
  });

  // Close handlers
  const closeModal = () => {
    modalContainer.innerHTML = '';
    document.body.style.overflow = '';
  };

  document.body.style.overflow = 'hidden';

  const closeBtn = modalContainer.querySelector('#btn-close-prop-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  const backdrop = modalContainer.querySelector('#prop-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  // Action Buttons
  const sendEnqBtn = modalContainer.querySelector('#btn-modal-send-enquiry');
  if (sendEnqBtn) {
    sendEnqBtn.addEventListener('click', () => {
      closeModal();
      if (onEnquiryOpen) onEnquiryOpen(property);
    });
  }

  const scheduleBtn = modalContainer.querySelector('#btn-modal-schedule-visit');
  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', () => {
      closeModal();
      if (onScheduleOpen) onScheduleOpen(property);
    });
  }

  const contactOwnerBtn = modalContainer.querySelector('#btn-modal-contact-owner');
  if (contactOwnerBtn) {
    contactOwnerBtn.addEventListener('click', () => {
      const owner = property.owner || { name: 'Kochi Key Desk', phone: '+91 98471 22890', email: 'hello@keytokochi.com' };
      alert(`Property Manager: ${owner.name}\nDirect Phone: ${owner.phone}\nEmail: ${owner.email}\nOffice: Panampilly Nagar, Kochi`);
    });
  }
}
