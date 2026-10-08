import { INITIAL_PROPERTIES, INITIAL_LOCATIONS, INITIAL_ENQUIRIES, INITIAL_OWNER_SUBMISSIONS } from '../data/initialData.js';

const STORAGE_KEY = 'key_to_kochi_storage_v1';

class Store {
  constructor() {
    this.subscribers = new Set();
    this.state = this.loadState();
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
    return updated;
  }

  deleteProperty(id) {
    const index = this.state.properties.findIndex(p => p.id === id);
    if (index === -1) return false;

    const removed = this.state.properties.splice(index, 1)[0];
    this.notify('PROPERTY_DELETED', removed);
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
    return newEnquiry;
  }

  markEnquiryAsRead(id) {
    const enquiry = this.state.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    if (enquiry.isRead !== true) {
      enquiry.isRead = true;
      this.notify('ENQUIRY_READ_UPDATED', enquiry);
    }
    return enquiry;
  }

  markEnquiryAsUnread(id) {
    const enquiry = this.state.enquiries.find(e => e.id === id);
    if (!enquiry) return null;

    if (enquiry.isRead !== false) {
      enquiry.isRead = false;
      this.notify('ENQUIRY_READ_UPDATED', enquiry);
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
    return enquiry;
  }

  deleteEnquiry(id) {
    const index = this.state.enquiries.findIndex(e => e.id === id);
    if (index === -1) return false;

    const removed = this.state.enquiries.splice(index, 1)[0];
    this.notify('ENQUIRY_DELETED', removed);
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
    return { submission: sub, property: newProp };
  }

  rejectSubmission(id) {
    const sub = this.state.submissions.find(s => s.id === id);
    if (!sub) return null;
    sub.status = 'Rejected';
    this.notify('SUBMISSION_REJECTED', sub);
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
  }
}

export const store = new Store();
