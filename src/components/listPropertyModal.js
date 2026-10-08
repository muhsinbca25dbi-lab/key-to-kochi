import { store } from '../store/state.js';
import { showToastNotification } from './actionModals.js';
import { CURATED_IMAGE_PRESETS } from '../data/initialData.js';

export function openListPropertyModal() {
  const container = document.getElementById('action-modal-container');
  if (!container) return;

  const locations = store.getLocations();
  const facilitiesList = [
    'Parking', 'Wi-Fi', 'AC', 'Lift', 'Security', 'Water Supply',
    'Power Backup', 'Attached Bathroom', 'Kitchen', 'Balcony', 'Gym',
    'Swimming Pool', 'Pet Friendly'
  ];

  container.innerHTML = `
    <div class="action-modal-backdrop" id="list-prop-backdrop">
      <div class="action-modal-card large-modal">
        <button class="modal-close-btn" id="btn-close-list-prop">&times;</button>
        <div class="action-modal-header">
          <div class="modal-icon-badge gold">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h3>List Your Rental Property in Kochi</h3>
          <p class="modal-sub">Direct access to verified high-intent tenants. 0% brokerage for owners.</p>
        </div>

        <form id="owner-submit-form" class="action-modal-form">
          <div class="owner-form-section-title">1. Owner Contact Information</div>
          <div class="form-grid-3col">
            <div class="form-field">
              <label>Owner Full Name <span class="req">*</span></label>
              <input type="text" id="owner-name" required placeholder="e.g. Kurian V. Joseph" />
            </div>
            <div class="form-field">
              <label>Phone / WhatsApp <span class="req">*</span></label>
              <input type="tel" id="owner-phone" required placeholder="+91 98470 54321" />
            </div>
            <div class="form-field">
              <label>Email Address <span class="req">*</span></label>
              <input type="email" id="owner-email" required placeholder="owner@gmail.com" />
            </div>
          </div>

          <div class="owner-form-section-title">2. Property Specifications</div>
          <div class="form-grid-2col">
            <div class="form-field full-width">
              <label>Property Name / Project Title <span class="req">*</span></label>
              <input type="text" id="owner-prop-title" required placeholder="e.g. Choice Paradise 3 BHK Luxury Flat" />
            </div>

            <div class="form-field">
              <label>Property Type <span class="req">*</span></label>
              <select id="owner-prop-type" required>
                <option value="Apartment">Apartment</option>
                <option value="Flat">Flat</option>
                <option value="Home">Home / Villa</option>
              </select>
            </div>

            <div class="form-field">
              <label>BHK <span class="req">*</span></label>
              <select id="owner-prop-bhk" required>
                <option value="1 BHK">1 BHK</option>
                <option value="2 BHK" selected>2 BHK</option>
                <option value="3 BHK">3 BHK</option>
                <option value="4 BHK">4 BHK</option>
              </select>
            </div>

            <div class="form-field">
              <label>Kochi Neighborhood <span class="req">*</span></label>
              <select id="owner-prop-loc" required>
                ${locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-field">
              <label>Furnishing Status <span class="req">*</span></label>
              <select id="owner-prop-furnish" required>
                <option value="Fully Furnished">Fully Furnished</option>
                <option value="Semi Furnished" selected>Semi Furnished</option>
                <option value="Unfurnished">Unfurnished</option>
              </select>
            </div>

            <div class="form-field">
              <label>Expected Monthly Rent (₹ INR) <span class="req">*</span></label>
              <input type="number" id="owner-prop-rent" required min="3000" step="500" placeholder="e.g. 26000" />
            </div>

            <div class="form-field">
              <label>Expected Security Deposit (₹ INR) <span class="req">*</span></label>
              <input type="number" id="owner-prop-deposit" required min="5000" step="1000" placeholder="e.g. 75000" />
            </div>

            <div class="form-field">
              <label>Floor Area (sq.ft) <span class="req">*</span></label>
              <input type="number" id="owner-prop-size" required min="300" placeholder="e.g. 1250" />
            </div>

            <div class="form-field">
              <label>Primary Photo URL</label>
              <input type="url" id="owner-prop-image" placeholder="https://images.unsplash.com/..." value="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80" />
            </div>
          </div>

          <div class="owner-form-section-title">3. Tenant Suitability (Suitable For)</div>
          <div class="form-field full-width">
            <label>Suitable For (Select all that apply) <span class="req">*</span></label>
            <div class="tenant-type-checkbox-row" style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 6px;">
              <label class="custom-checkbox-label">
                <input type="checkbox" class="owner-tenant-cb" value="Family" checked />
                <span class="checkmark"></span>
                <span>👨‍👩‍👧 Family</span>
              </label>
              <label class="custom-checkbox-label">
                <input type="checkbox" class="owner-tenant-cb" value="Bachelors" />
                <span class="checkmark"></span>
                <span>👤 Bachelors</span>
              </label>
              <label class="custom-checkbox-label">
                <input type="checkbox" class="owner-tenant-cb" value="Couples" checked />
                <span class="checkmark"></span>
                <span>❤️ Couples</span>
              </label>
            </div>
          </div>

          <div class="owner-form-section-title">4. Facilities & Description</div>
          <div class="facilities-selection-box">
            <label class="section-label-sm">Select Available Amenities:</label>
            <div class="facilities-checkbox-grid">
              ${facilitiesList.map(f => `
                <label class="custom-checkbox-label">
                  <input type="checkbox" class="owner-fac-cb" value="${f}" />
                  <span class="checkmark"></span>
                  <span>${f}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-field full-width">
            <label>Detailed Property Description</label>
            <textarea id="owner-prop-desc" rows="3" placeholder="Describe highlights, nearby metro stations, tenant preferences (families/professionals), available parking..."></textarea>
          </div>

          <div class="modal-form-actions">
            <button type="submit" class="btn-gold-full">Submit Property for Verification</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.style.overflow = 'hidden';

  const close = () => {
    container.innerHTML = '';
    document.body.style.overflow = '';
  };

  container.querySelector('#btn-close-list-prop').addEventListener('click', close);
  container.querySelector('#list-prop-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'list-prop-backdrop') close();
  });

  const form = container.querySelector('#owner-submit-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ownerName = container.querySelector('#owner-name').value.trim();
    const phone = container.querySelector('#owner-phone').value.trim();
    const email = container.querySelector('#owner-email').value.trim();
    const title = container.querySelector('#owner-prop-title').value.trim();
    const type = container.querySelector('#owner-prop-type').value;
    const bhk = container.querySelector('#owner-prop-bhk').value;
    const location = container.querySelector('#owner-prop-loc').value;
    const furnishing = container.querySelector('#owner-prop-furnish').value;
    const rent = Number(container.querySelector('#owner-prop-rent').value);
    const deposit = Number(container.querySelector('#owner-prop-deposit').value);
    const size = Number(container.querySelector('#owner-prop-size').value);
    const image = container.querySelector('#owner-prop-image').value.trim() || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
    const description = container.querySelector('#owner-prop-desc').value.trim();
    const facilities = Array.from(container.querySelectorAll('.owner-fac-cb:checked')).map(cb => cb.value);
    const suitableFor = Array.from(container.querySelectorAll('.owner-tenant-cb:checked')).map(cb => cb.value);

    store.addOwnerSubmission({
      ownerName,
      phone,
      email,
      title,
      type,
      bhk,
      location,
      furnishing,
      rent,
      deposit,
      size,
      images: [image],
      description,
      facilities,
      suitableFor: suitableFor.length > 0 ? suitableFor : ['Family']
    });

    close();
    showToastNotification(
      'Property Submitted for Review!',
      'Our team will verify your property details. Once approved in the admin portal, it will be published immediately!'
    );
  });
}
