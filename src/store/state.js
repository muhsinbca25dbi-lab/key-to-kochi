import { INITIAL_PROPERTIES, INITIAL_LOCATIONS, INITIAL_ENQUIRIES, INITIAL_OWNER_SUBMISSIONS } from '../data/initialData.js';

const STORAGE_KEY = 'key_to_kochi_storage_v1';

// ── Firestore modules loaded lazily so the app still works when Firebase
//    env vars are not configured (graceful localStorage-only fallback).
let _firestoreService = null;
async function getFirestoreService() {
  if (_firestoreService) return _firestoreService;
  try {
    _firestoreService = await import('../services/firestoreService.js');
  } catch (e) {
    console.warn('[KTK Store] firestoreService import failed:', e.message);
    _firestoreService = null;
  }
  return _firestoreService;
}

class Store {
  constructor() {
    this.subscribers = new Set();
    this.state = this.loadState();
    if (!this.state.adminAuth) {
      this.state.adminAuth = {
        isAuthenticated: false,
        user: null
      };
    }
    // Kick off async Firestore load without blocking the constructor.
    // The UI renders immediately from localStorage; Firestore data
    // replaces it when available and triggers a re-render via notify().
    this._loadFromFirestore();
  }

  // ── FIRESTORE BOOTSTRAP ─────────────────────────────────────────────────

  /**
   * Load shared data from Firestore and merge into in-memory state.
   * Falls back silently to localStorage if Firestore is unavailable.
   */
  async _loadFromFirestore() {
    const fs = await getFirestoreService();
    if (!fs) return;

    try {
      const [properties, locations] = await Promise.all([
        fs.getProperties(),
        fs.getLocations()
      ]);

      let changed = false;

      if (properties && properties.length > 0) {
        // Ensure suitableFor is always populated (same normalisation as loadState)
        this.state.properties = properties.map(p => {
          if (!p.suitableFor || !Array.isArray(p.suitableFor) || p.suitableFor.length === 0) {
            const bhk = p.bhk || '';
            if (bhk === '1 BHK') return { ...p, suitableFor: ['Bachelors', 'Couples'] };
            if (bhk === '4 BHK') return { ...p, suitableFor: ['Family'] };
            return { ...p, suitableFor: ['Family', 'Couples'] };
          }
          return p;
        });
        changed = true;
      }

      if (locations && locations.length > 0) {
        this.state.locations = locations;
        changed = true;
      }

      // If admin is currently authenticated, also load private data from Netlify API.
      await this._loadAdminDataIfAuthenticated();

      if (changed) {
        this.saveState();
        this.notify('FIRESTORE_LOADED', null);
      }
    } catch (err) {
      console.warn('[KTK Store] Firestore load error:', err.message);
    }
  }

  /**
   * If the admin session token is present in sessionStorage, fetch
   * enquiries and submissions from the Netlify Function API so the
   * admin portal sees all cross-browser submissions.
   */
  async _loadAdminDataIfAuthenticated() {
    try {
      const raw = sessionStorage.getItem('ktk_admin_session');
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || !session.token || session.expiresAt <= Date.now()) return;

      const token = session.token;
      const baseUrl = window.location.origin;
      const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

      const [enquiriesRes, submissionsRes, propertiesRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/enquiries`, { headers }).catch(() => null),
        fetch(`${baseUrl}/api/admin/submissions`, { headers }).catch(() => null),
        fetch(`${baseUrl}/api/admin/properties`, { headers }).catch(() => null)
      ]);

      if (propertiesRes && propertiesRes.ok) {
        const data = await propertiesRes.json().catch(() => ({}));
        if (data.ok && Array.isArray(data.properties)) {
          if (data.properties.length > 0) {
            this.state.properties = data.properties.map(p => {
              if (!p.suitableFor || !Array.isArray(p.suitableFor) || p.suitableFor.length === 0) {
                const bhk = p.bhk || '';
                if (bhk === '1 BHK') return { ...p, suitableFor: ['Bachelors', 'Couples'] };
                if (bhk === '4 BHK') return { ...p, suitableFor: ['Family'] };
                return { ...p, suitableFor: ['Family', 'Couples'] };
              }
              return p;
            });
          }
        }
      }

      if (enquiriesRes && enquiriesRes.ok) {
        const data = await enquiriesRes.json().catch(() => ({}));
        // When the Admin API successfully returns an array (even if empty []),
        // update the state so genuine empty states are displayed instead of dummy initialData.
        if (data.ok && Array.isArray(data.enquiries)) {
          this.state.enquiries = data.enquiries.map(e => ({
            ...e,
            isRead: typeof e.isRead === 'boolean' ? e.isRead : (e.status === 'New' ? false : true)
          }));
        }
      }

      if (submissionsRes && submissionsRes.ok) {
        const data = await submissionsRes.json().catch(() => ({}));
        // When the Admin API successfully returns submissions (even if empty []),
        // update state to reflect genuine database status.
        if (data.ok && Array.isArray(data.submissions)) {
          this.state.submissions = data.submissions;
        }
      }
    } catch (err) {
      console.warn('[KTK Store] Admin data load error:', err.message);
    }
  }

  /**
   * Post an admin operation to the Netlify Function (which uses Admin SDK).
   * Silent failure — the in-memory state is already updated before this is called.
   * @param {string} method  HTTP verb
   * @param {string} path    e.g. '/api/admin/properties/prop-123'
   * @param {object} [body]  JSON body
   */
  async _adminSync(method, path, body) {
    try {
      const raw = sessionStorage.getItem('ktk_admin_session');
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || !session.token || session.expiresAt <= Date.now()) return;

      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        }
      };
      if (body !== undefined) opts.body = JSON.stringify(body);
      await fetch(window.location.origin + path, opts);
    } catch (err) {
      console.warn('[KTK Store] _adminSync failed:', err.message);
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.properties && parsed.properties.length > 0) {
          // Ensure all properties have suitableFor populated
          parsed.properties = parsed.properties.map(p => {
            if (!p.suitableFor || !Array.isArray(p.suitableFor) || p.suitableFor.length === 0) {
              const bhk = p.bhk || '';
              if (bhk === '1 BHK') return { ...p, suitableFor: ['Bachelors', 'Couples'] };
              if (bhk === '4 BHK') return { ...p, suitableFor: ['Family'] };
              return { ...p, suitableFor: ['Family', 'Couples'] };
            }
            return p;
          });

          // Ensure all enquiries have valid isRead boolean
          if (parsed.enquiries && Array.isArray(parsed.enquiries)) {
            parsed.enquiries = parsed.enquiries.map(e => ({
              ...e,
              isRead: typeof e.isRead === 'boolean' ? e.isRead : (e.status === 'New' ? false : true)
            }));
          } else {
            parsed.enquiries = INITIAL_ENQUIRIES;
          }

          if (!parsed.locations || !Array.isArray(parsed.locations)) {
            parsed.locations = INITIAL_LOCATIONS;
          }

          if (!parsed.submissions || !Array.isArray(parsed.submissions)) {
            parsed.submissions = INITIAL_OWNER_SUBMISSIONS;
          }

          // Always reset adminAuth on load — session validity is managed by
          // authService via sessionStorage, not persisted in the data store.
          parsed.adminAuth = {
            isAuthenticated: false,
            user: null
          };

          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse localStorage, resetting to defaults', e);
    }

    const defaultState = {
      properties: INITIAL_PROPERTIES,
      locations: INITIAL_LOCATIONS,
      enquiries: INITIAL_ENQUIRIES,
      submissions: INITIAL_OWNER_SUBMISSIONS,
      adminAuth: {
        isAuthenticated: false,
        user: null
      }
    };
    this.saveState(defaultState);
    return defaultState;
  }

  saveState(stateToSave = this.state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Storage error', e);
    }
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify(eventType, payload) {
    this.saveState();
    this.subscribers.forEach(listener => {
      try {
        listener(eventType, payload, this.state);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    });
  }

  // --- PROPERTIES ---
  getProperties(includeDrafts = false) {
    if (includeDrafts) {
      return [...this.state.properties];
    }
    return this.state.properties.filter(p => p.published !== false);
  }

  getAllProperties() {
    return [...this.state.properties];
  }

  getPropertyById(id) {
    return this.state.properties.find(p => p.id === id);
  }

  addProperty(propertyData) {
    const newProp = {
      id: 'prop-' + Date.now(),
      createdAt: new Date().toISOString(),
      published: propertyData.published !== undefined ? propertyData.published : true,
      availability: propertyData.availability || 'Available',
      featured: !!propertyData.featured,
      images: propertyData.images && propertyData.images.length > 0 
        ? propertyData.images 
        : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
      facilities: propertyData.facilities || [],
      suitableFor: propertyData.suitableFor && propertyData.suitableFor.length > 0 
        ? propertyData.suitableFor 
        : ['Family', 'Couples'],
      ...propertyData
    };

    this.state.properties.unshift(newProp);
    this.notify('PROPERTY_ADDED', newProp);
    this._adminSync('POST', '/api/admin/properties', newProp);
    return newProp;
  }

  updateProperty(id, updateData) {
    const index = this.state.properties.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.state.properties[index] = {
      ...this.state.properties[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    const updated = this.state.properties[index];
    this.notify('PROPERTY_UPDATED', updated);
    this._adminSync('PUT', `/api/admin/properties/${id}`, updated);
    return updated;
  }

  deleteProperty(id) {
    const index = this.state.properties.findIndex(p => p.id === id);
    if (index === -1) return false;

    const removed = this.state.properties.splice(index, 1)[0];
    this.notify('PROPERTY_DELETED', removed);
    this._adminSync('DELETE', `/api/admin/properties/${id}`);
    return true;
  }

  togglePropertyStatus(id) {
    const prop = this.getPropertyById(id);
    if (!prop) return null;
    const newStatus = prop.availability === 'Available' ? 'Rented' : 'Available';
    return this.updateProperty(id, { availability: newStatus });
  }

  togglePropertyPublish(id) {
    const prop = this.getPropertyById(id);
    if (!prop) return null;
    const newPublished = !prop.published;
    return this.updateProperty(id, { published: newPublished });
  }

  // --- ENQUIRIES ---
  getEnquiries() {
    return [...this.state.enquiries];
  }

  addEnquiry(enquiryData) {
    const newEnquiry = {
      id: 'enq-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      status: 'New',
      isRead: false,
      ...enquiryData
    };

    this.state.enquiries.unshift(newEnquiry);
    this.notify('ENQUIRY_ADDED', newEnquiry);

    // Persist to Firestore (non-blocking — UI already updated above)
    getFirestoreService().then(fs => {
      if (fs) fs.addEnquiry(newEnquiry).catch(() => {});
    });

    return newEnquiry;
  }

  markEnquiryAsRead(id) {
    const enquiry = this.state.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    if (enquiry.isRead !== true) {
      enquiry.isRead = true;
      this.notify('ENQUIRY_READ_UPDATED', enquiry);
      this._adminSync('PATCH', `/api/admin/enquiries/${id}`, { isRead: true });
    }
    return enquiry;
  }

  markEnquiryAsUnread(id) {
    const enquiry = this.state.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    if (enquiry.isRead !== false) {
      enquiry.isRead = false;
      this.notify('ENQUIRY_READ_UPDATED', enquiry);
      this._adminSync('PATCH', `/api/admin/enquiries/${id}`, { isRead: false });
    }
    return enquiry;
  }

  markAllEnquiriesAsRead() {
    let hasChanged = false;
    this.state.enquiries.forEach(e => {
      if (e.isRead !== true) {
        e.isRead = true;
        hasChanged = true;
      }
    });

    if (hasChanged) {
      this.notify('ALL_ENQUIRIES_READ', null);
      this._adminSync('PATCH', '/api/admin/enquiries/__all__/read');
    }
    return true;
  }

  getUnreadEnquiriesCount() {
    return this.state.enquiries.filter(e => e.isRead === false).length;
  }

  updateEnquiryStatus(id, newStatus) {
    const enquiry = this.state.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    enquiry.status = newStatus;
    this.notify('ENQUIRY_UPDATED', enquiry);
    this._adminSync('PATCH', `/api/admin/enquiries/${id}`, { status: newStatus });
    return enquiry;
  }

  deleteEnquiry(id) {
    const index = this.state.enquiries.findIndex(e => e.id === id);
    if (index === -1) return false;

    const removed = this.state.enquiries.splice(index, 1)[0];
    this.notify('ENQUIRY_DELETED', removed);
    this._adminSync('DELETE', `/api/admin/enquiries/${id}`);
    return true;
  }

  // --- OWNER SUBMISSIONS ("List Your Property") ---
  getOwnerSubmissions() {
    return [...this.state.submissions];
  }

  addOwnerSubmission(submissionData) {
    const newSubmission = {
      id: 'sub-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      createdAt: new Date().toISOString(),
      ...submissionData
    };

    this.state.submissions.unshift(newSubmission);
    this.notify('SUBMISSION_ADDED', newSubmission);

    // Persist to Firestore (non-blocking — UI already updated above)
    getFirestoreService().then(fs => {
      if (fs) fs.addSubmission(newSubmission).catch(() => {});
    });

    return newSubmission;
  }

  approveSubmission(id) {
    const sub = this.state.submissions.find(s => s.id === id);
    if (!sub) return null;

    sub.status = 'Approved';

    // Automatically convert approved submission to published property!
    const newProp = this.addProperty({
      title: sub.title || `${sub.bhk} in ${sub.location}`,
      type: sub.type || 'Apartment',
      bhk: sub.bhk || '2 BHK',
      rent: Number(sub.rent) || 25000,
      deposit: Number(sub.deposit) || (Number(sub.rent) * 3) || 75000,
      location: sub.location || 'Kakkanad',
      address: sub.address || `${sub.location}, Kochi`,
      size: Number(sub.size) || 1200,
      bedrooms: parseInt(sub.bhk) || 2,
      bathrooms: parseInt(sub.bhk) || 2,
      furnishing: sub.furnishing || 'Semi Furnished',
      availability: 'Available',
      featured: false,
      published: true,
      description: sub.description || 'Verified property listed directly by owner.',
      facilities: sub.facilities || ['Parking', 'Water Supply', 'Security', 'Attached Bathroom'],
      suitableFor: sub.suitableFor && sub.suitableFor.length > 0 ? sub.suitableFor : ['Family', 'Couples'],
      images: sub.images && sub.images.length > 0 ? sub.images : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80'],
      owner: {
        name: sub.ownerName,
        phone: sub.phone,
        email: sub.email
      }
    });

    this.notify('SUBMISSION_APPROVED', { submission: sub, property: newProp });
    // Sync submission status update to Firestore
    this._adminSync('PATCH', `/api/admin/submissions/${id}`, { status: 'Approved' });
    return { submission: sub, property: newProp };
  }

  rejectSubmission(id) {
    const sub = this.state.submissions.find(s => s.id === id);
    if (!sub) return null;
    sub.status = 'Rejected';
    this.notify('SUBMISSION_REJECTED', sub);
    this._adminSync('PATCH', `/api/admin/submissions/${id}`, { status: 'Rejected' });
    return sub;
  }

  // --- LOCATIONS ---
  getLocations() {
    return [...this.state.locations];
  }

  addLocation(locationData) {
    const newLoc = {
      id: 'loc-' + Date.now(),
      ...locationData
    };
    this.state.locations.push(newLoc);
    this.notify('LOCATION_ADDED', newLoc);
    this._adminSync('POST', '/api/admin/locations', newLoc);
    return newLoc;
  }

  // --- DYNAMIC STATISTICS ---
  getStats() {
    const all = this.state.properties;
    const published = all.filter(p => p.published !== false);
    
    const total = published.length;
    const available = published.filter(p => p.availability === 'Available').length;
    const rented = published.filter(p => p.availability === 'Rented').length;

    // BHK breakdown
    const bhkStats = {
      '1 BHK': published.filter(p => p.bhk === '1 BHK').length,
      '2 BHK': published.filter(p => p.bhk === '2 BHK').length,
      '3 BHK': published.filter(p => p.bhk === '3 BHK').length,
      '4 BHK': published.filter(p => p.bhk === '4 BHK').length
    };

    // Furnishing breakdown
    const furnishingStats = {
      'Fully Furnished': published.filter(p => p.furnishing === 'Fully Furnished').length,
      'Semi Furnished': published.filter(p => p.furnishing === 'Semi Furnished').length,
      'Unfurnished': published.filter(p => p.furnishing === 'Unfurnished').length
    };

    // Tenant Type breakdown
    const tenantStats = {
      Family: published.filter(p => p.suitableFor && p.suitableFor.includes('Family')).length,
      Bachelors: published.filter(p => p.suitableFor && p.suitableFor.includes('Bachelors')).length,
      Couples: published.filter(p => p.suitableFor && p.suitableFor.includes('Couples')).length
    };

    // Location breakdown
    const locationStats = {};
    published.forEach(p => {
      locationStats[p.location] = (locationStats[p.location] || 0) + 1;
    });

    // Enquiries
    const enquiries = this.state.enquiries;
    const unreadEnquiries = enquiries.filter(e => e.isRead === false).length;
    const newEnquiries = enquiries.filter(e => e.status === 'New').length;
    const contactedEnquiries = enquiries.filter(e => e.status === 'Contacted').length;
    const closedEnquiries = enquiries.filter(e => e.status === 'Closed').length;

    // Submissions
    const pendingSubmissions = this.state.submissions.filter(s => s.status === 'Pending').length;

    // Average Rent
    const avgRent = total > 0 ? Math.round(published.reduce((acc, curr) => acc + (Number(curr.rent) || 0), 0) / total) : 0;

    return {
      total,
      available,
      rented,
      bhkStats,
      furnishingStats,
      tenantStats,
      locationStats,
      totalEnquiries: enquiries.length,
      unreadEnquiries,
      newEnquiries,
      contactedEnquiries,
      closedEnquiries,
      pendingSubmissions,
      avgRent
    };
  }

  // --- RESET TO DEFAULTS ---
  resetDefaults() {
    this.state = {
      properties: INITIAL_PROPERTIES,
      locations: INITIAL_LOCATIONS,
      enquiries: INITIAL_ENQUIRIES,
      submissions: INITIAL_OWNER_SUBMISSIONS,
      adminAuth: { isAuthenticated: false, user: null }
    };
    this.saveState();
    this.notify('DATA_RESET', null);
    // Trigger one-time initial seed via admin API if Firestore is empty
    this._adminSync('POST', '/api/admin/seed');
  }

  /**
   * Public method for the admin portal to trigger a fresh load of
   * enquiries and submissions from Firestore (called after admin login).
   */
  async refreshAdminData() {
    await this._loadAdminDataIfAuthenticated();
    this.saveState();
    this.notify('ADMIN_DATA_REFRESHED', null);
  }
}

export const store = new Store();
