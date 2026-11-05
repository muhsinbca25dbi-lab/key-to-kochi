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
    return properties.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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

// ── ENQUIRIES (create-only from client) ────────────────────────────────────

/**
 * Save a new customer enquiry to Firestore.
 * Security rules validate required fields (customerName, phone, email, message).
 * Returns the new Firestore document ID, or null on failure.
 */
export async function addEnquiry(enquiryData) {
  if (!isReady()) return null;
  try {
    const ref = await addDoc(collection(db, 'enquiries'), {
      ...enquiryData,
      createdAt: serverTimestamp(),
      _source: 'client'
    });
    console.info('[KTK Firestore] Enquiry saved:', ref.id);
    return ref.id;
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

