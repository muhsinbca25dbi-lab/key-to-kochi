import { store } from '../store/state.js';
import { authService } from '../services/authService.js';

export function openEnquiryModal(property = null) {
  const container = document.getElementById('action-modal-container');
  if (!container) return;

  const propTitle = property ? property.title : 'General Rental Inquiry';
  const propId = property ? property.id : null;

  container.innerHTML = `
    <div class="action-modal-backdrop" id="enquiry-modal-backdrop">
      <div class="action-modal-card">
        <button class="modal-close-btn" id="btn-close-enquiry">&times;</button>
        <div class="action-modal-header">
          <div class="modal-icon-badge gold">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h3>Send Rental Enquiry</h3>
          <p class="modal-sub">Inquire directly about verified properties across Kochi</p>
        </div>

        <form id="enquiry-form" class="action-modal-form">
          <div class="form-field full-width">
            <label>Selected Property</label>
            <input type="text" class="input-readonly" value="${propTitle}" readonly />
          </div>

          <div class="form-grid-2col">
            <div class="form-field">
              <label>Full Name <span class="req">*</span></label>
              <input type="text" id="enq-name" required placeholder="e.g. Rahul Sharma" />
            </div>

            <div class="form-field">
              <label>Phone Number <span class="req">*</span></label>
              <input type="tel" id="enq-phone" required placeholder="e.g. +91 98470 12345" />
            </div>
          </div>

          <div class="form-grid-2col">
            <div class="form-field">
              <label>Email Address <span class="req">*</span></label>
              <input type="email" id="enq-email" required placeholder="name@example.com" />
            </div>

            <div class="form-field">
              <label>Target Move-In Date</label>
              <input type="date" id="enq-date" value="${new Date().toISOString().split('T')[0]}" />
            </div>
          </div>

          <div class="form-field full-width">
            <label>Your Message / Specific Requirements</label>
            <textarea id="enq-message" rows="3" placeholder="Tell us if you need immediate possession, family vs bachelor terms, or parking requirements..."></textarea>
          </div>

          <div class="modal-form-actions">
            <button type="submit" class="btn-gold-full">Submit Rental Enquiry</button>
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

  container.querySelector('#btn-close-enquiry').addEventListener('click', close);
  container.querySelector('#enquiry-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'enquiry-modal-backdrop') close();
  });

  const form = container.querySelector('#enquiry-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const customerName = container.querySelector('#enq-name').value.trim();
    const phone = container.querySelector('#enq-phone').value.trim();
    const email = container.querySelector('#enq-email').value.trim();
    const moveDate = container.querySelector('#enq-date').value;
    const msg = container.querySelector('#enq-message').value.trim() || 'Interested in renting this property.';

    store.addEnquiry({
      propertyId: propId,
      propertyTitle: propTitle,
      customerName,
      phone,
      email,
      message: `[Move-in: ${moveDate}] ${msg}`
    });

    close();
    showToastNotification('Enquiry Submitted Successfully!', 'Our Kochi property advisor will contact you within 2 business hours.');
  });
}

export function openScheduleVisitModal(property = null) {
  const container = document.getElementById('action-modal-container');
  if (!container) return;

  const propTitle = property ? property.title : 'Property Visit';
  const propId = property ? property.id : null;

  container.innerHTML = `
    <div class="action-modal-backdrop" id="schedule-modal-backdrop">
      <div class="action-modal-card">
        <button class="modal-close-btn" id="btn-close-schedule">&times;</button>
        <div class="action-modal-header">
          <div class="modal-icon-badge emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3>Schedule a Physical Visit</h3>
          <p class="modal-sub">Walk through the home with our verified property manager</p>
        </div>

        <form id="schedule-form" class="action-modal-form">
          <div class="form-field full-width">
            <label>Selected Property</label>
            <input type="text" class="input-readonly" value="${propTitle}" readonly />
          </div>

          <div class="form-grid-2col">
            <div class="form-field">
              <label>Your Name <span class="req">*</span></label>
              <input type="text" id="sch-name" required placeholder="e.g. Sarah John" />
            </div>

            <div class="form-field">
              <label>Phone Number <span class="req">*</span></label>
              <input type="tel" id="sch-phone" required placeholder="e.g. +91 94471 23456" />
            </div>
          </div>

          <div class="form-grid-2col">
            <div class="form-field">
              <label>Preferred Visit Date <span class="req">*</span></label>
              <input type="date" id="sch-date" required value="${new Date().toISOString().split('T')[0]}" />
            </div>

            <div class="form-field">
              <label>Preferred Time Slot <span class="req">*</span></label>
              <select id="sch-time" required>
                <option value="Morning (10:00 AM - 12:00 PM)">Morning (10:00 AM - 12:00 PM)</option>
                <option value="Afternoon (02:00 PM - 04:00 PM)">Afternoon (02:00 PM - 04:00 PM)</option>
                <option value="Evening (04:30 PM - 07:00 PM)">Evening (04:30 PM - 07:00 PM)</option>
              </select>
            </div>
          </div>

          <div class="form-field full-width">
            <label>Email Address</label>
            <input type="email" id="sch-email" placeholder="name@example.com" />
          </div>

          <div class="modal-form-actions">
            <button type="submit" class="btn-emerald-full">Confirm Visit Appointment</button>
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

  container.querySelector('#btn-close-schedule').addEventListener('click', close);
  container.querySelector('#schedule-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'schedule-modal-backdrop') close();
  });

  const form = container.querySelector('#schedule-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const customerName = container.querySelector('#sch-name').value.trim();
    const phone = container.querySelector('#sch-phone').value.trim();
    const date = container.querySelector('#sch-date').value;
    const time = container.querySelector('#sch-time').value;
    const email = container.querySelector('#sch-email').value.trim() || 'tenant@visit.com';

    store.addEnquiry({
      propertyId: propId,
      propertyTitle: propTitle,
      customerName,
      phone,
      email,
      message: `[Visit Scheduled for ${date} during ${time}] Physical inspection booked.`
    });

    close();
    showToastNotification('Visit Appointment Scheduled!', `We look forward to meeting you on ${date} (${time}).`);
  });
}

export function openAdminLoginModal(onLoginSuccess) {
  const container = document.getElementById('action-modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="action-modal-backdrop" id="login-modal-backdrop">
      <div class="action-modal-card login-card">
        <button class="modal-close-btn" id="btn-close-login">&times;</button>
        <div class="action-modal-header">
          <div class="modal-icon-badge gold">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h3>Admin Portal Authentication</h3>
          <p class="modal-sub">Access KEY TO KOCHI property management & CRM</p>
        </div>

        <form id="admin-login-form" class="action-modal-form">
          <div class="form-field full-width">
            <label>Admin Email</label>
            <input type="email" id="login-email" required value="admin@keytokochi.com" />
          </div>

          <div class="form-field full-width">
            <label>Password</label>
            <input type="password" id="login-pass" required value="kochi2025" />
          </div>

          <div class="login-quick-hint">
            <span>Demo Credentials: <strong>admin@keytokochi.com</strong> / <strong>kochi2025</strong></span>
          </div>

          <div class="modal-form-actions">
            <button type="submit" class="btn-gold-full">Sign In to Dashboard &rarr;</button>
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

  container.querySelector('#btn-close-login').addEventListener('click', close);
  container.querySelector('#login-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'login-modal-backdrop') close();
  });

  const form = container.querySelector('#admin-login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#login-email').value.trim();
    const pass = container.querySelector('#login-pass').value.trim();

    try {
      const res = await authService.login(email, pass);
      if (res.ok && res.user && res.user.role === 'ADMIN') {
        close();
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        alert(res.error || 'Invalid email or password.');
      }
    } catch (_) {
      alert('Unable to connect to the authentication service. Please try again.');
    }
  });
}

export function showToastNotification(title, message) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-bubble';
  toast.innerHTML = `
    <div class="toast-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <div class="toast-text">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
