/**
 * Firestore Service — KEY TO KOCHI (CLIENT-SIDE)
 *
 * Handles all client-side Firestore read/write operations subject to Security Rules:
 *
 *   PUBLIC READS  : properties (published only), locations
 *   PUBLIC WRITES : enquiries (create-only), submissions (create-only)
 *
 * Admin-privileged operations (read enquiries, delete properties, etc.) are NOT
 * done here — they go through the Netlify Function API routes which use the
 * Firebase Admin SDK and bypass security rules entirely.
 */
import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase.js';

function isReady() {
  return db !== null;
}

// ── PROPERTIES ─────────────────────────────────────────────────────────────

/**
 * Fetch published properties from Firestore.
 * Explicitly queries where('published', '==', true) to comply with Firestore
 * Security Rules (allow read: if resource.data.published == true) and ensure
 * draft/unpublished properties are never returned or exposed to public visitors.
 * Results are sorted client-side by createdAt descending to avoid requiring a
 * manual composite index in Firestore.
 */
export async function getProperties() {
  if (!isReady()) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'properties'), where('published', '==', true))
    );
    const properties = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const parseTs = (prop) => {
      if (!prop) return 0;
      const raw = prop.publishedAt || prop.createdAt;
      if (!raw) return 0;
      if (typeof raw === 'object') {
        if (typeof raw.toDate === 'function') {
          try { const d = raw.toDate(); if (d instanceof Date && !isNaN(d.getTime())) return d.getTime(); } catch (_) {}
        }
        if (typeof raw.seconds === 'number') return raw.seconds * 1000;
        if (typeof raw._seconds === 'number') return raw._seconds * 1000;
      }
      if (typeof raw === 'number' && !isNaN(raw)) return raw;
      const t = Date.parse(raw);
      return !isNaN(t) ? t : 0;
    };
    return properties.sort((a, b) => parseTs(b) - parseTs(a));
  } catch (e) {
    console.warn('[KTK Firestore] getProperties failed:', e.message);
    return [];
  }
}

// ── LOCATIONS ──────────────────────────────────────────────────────────────

/**
 * Fetch all locations from Firestore.
 */
export async function getLocations() {
  if (!isReady()) return [];
  try {
    const snap = await getDocs(collection(db, 'locations'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[KTK Firestore] getLocations failed:', e.message);
    return [];
  }
}

/**
 * Add a new location to Firestore.
 * @param {object} locData
 * @returns {Promise<string|null>}
 */
export async function addLocation(locData) {
  if (!isReady()) return null;
  try {
    const locId = locData.id || doc(collection(db, 'locations')).id;
    const docRef = doc(db, 'locations', locId);
    await setDoc(docRef, {
      ...locData,
      id: locId,
      createdAt: serverTimestamp()
    });
    console.info('[KTK Firestore] Location added:', locId);
    return locId;
  } catch (e) {
    console.warn('[KTK Firestore] addLocation failed:', e.message);
    return null;
  }
}

/**
 * Update an existing location in Firestore.
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<boolean>}
 */
export async function updateLocation(id, updateData) {
  if (!isReady() || !id) return false;
  try {
    const docRef = doc(db, 'locations', id);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    console.info('[KTK Firestore] Location updated:', id);
    return true;
  } catch (e) {
    console.warn('[KTK Firestore] updateLocation failed:', e.message);
    return false;
  }
}

/**
 * Delete a location from Firestore.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteLocation(id) {
  if (!isReady() || !id) return false;
  try {
    const docRef = doc(db, 'locations', id);
    await deleteDoc(docRef);
    console.info('[KTK Firestore] Location deleted:', id);
    return true;
  } catch (e) {
    console.warn('[KTK Firestore] deleteLocation failed:', e.message);
    return false;
  }
}

// ── ENQUIRIES (create-only from client) ────────────────────────────────────

/**
 * Save a new customer enquiry to Firestore.
 * Security rules validate required fields (customerName, phone, email, message).
 * Returns the new Firestore document ID, or null on failure.
 */
export async function addEnquiry(enquiryData) {
  if (!isReady()) return null;
  try {
    const enqId = enquiryData.id || doc(collection(db, 'enquiries')).id;
    const docRef = doc(db, 'enquiries', enqId);
    await setDoc(docRef, {
      ...enquiryData,
      id: enqId,
      createdAt: serverTimestamp(),
      _source: 'client'
    });
    console.info('[KTK Firestore] Enquiry saved:', enqId);
    return enqId;
  } catch (e) {
    console.warn('[KTK Firestore] addEnquiry failed:', e.message);
    return null;
  }
}

// ── OWNER SUBMISSIONS (create-only from client) ────────────────────────────

/**
 * Save a new owner property submission to Firestore.
 * Security rules validate required fields (ownerName, phone, email).
 * Returns the new Firestore document ID, or null on failure.
 */
export async function addSubmission(submissionData) {
  if (!isReady()) return null;
  try {
    const ref = await addDoc(collection(db, 'submissions'), {
      ...submissionData,
      status: 'Pending',
      createdAt: serverTimestamp(),
      _source: 'client'
    });
    console.info('[KTK Firestore] Submission saved:', ref.id);
    return ref.id;
  } catch (e) {
    console.warn('[KTK Firestore] addSubmission failed:', e.message);
    return null;
  }
}

