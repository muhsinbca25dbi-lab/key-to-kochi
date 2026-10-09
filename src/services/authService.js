import { store } from '../store/state.js';

const SESSION_STORAGE_KEY = 'ktk_admin_session';

/**
 * Authentication Service for Key to Kochi
 * Handles backend API integration, session management, and role verification.
 */
class AuthService {
  constructor() {
    this._memorySession = null;
    this._session = this._loadSession();
    this._simulateOffline = false;
  }

  _getStorage(type) {
    if (typeof window !== 'undefined') {
      try {
        if (type === 'session' && window.sessionStorage) return window.sessionStorage;
        if (type === 'local' && window.localStorage) return window.localStorage;
      } catch (_) {}
    }
    return null;
  }

  _loadSession() {
    try {
      const sStore = this._getStorage('session');
      const lStore = this._getStorage('local');
      const data = (sStore && sStore.getItem(SESSION_STORAGE_KEY)) || (lStore && lStore.getItem(SESSION_STORAGE_KEY));
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
    }
    return this._memorySession;
  }

  _saveSession(sessionData) {
    this._session = sessionData;
    this._memorySession = sessionData;
    try {
      const serialized = JSON.stringify(sessionData);
      const sStore = this._getStorage('session');
      const lStore = this._getStorage('local');
      if (sStore) sStore.setItem(SESSION_STORAGE_KEY, serialized);
      if (lStore) lStore.setItem(SESSION_STORAGE_KEY, serialized);
    } catch (e) {
      console.warn('Storage write failed:', e);
    }

    if (store && store.state && store.state.adminAuth) {
      store.state.adminAuth.isAuthenticated = sessionData.user && sessionData.user.role === 'ADMIN';
      store.state.adminAuth.user = sessionData.user;
      if (typeof store.saveState === 'function') {
        try { store.saveState(); } catch (_) {}
      }
    }
  }

  _clearSession() {
    this._session = null;
    this._memorySession = null;
    try {
      const sStore = this._getStorage('session');
      const lStore = this._getStorage('local');
      if (sStore) sStore.removeItem(SESSION_STORAGE_KEY);
      if (lStore) lStore.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('Storage remove failed:', e);
    }

    if (store && store.state && store.state.adminAuth) {
      store.state.adminAuth.isAuthenticated = false;
      store.state.adminAuth.user = null;
      if (typeof store.saveState === 'function') {
        try { store.saveState(); } catch (_) {}
      }
    }
  }

  /**
   * Set simulated offline mode (useful for testing Test G)
   */
  setSimulatedOffline(status) {
    this._simulateOffline = !!status;
  }

  /**
   * Check if current session is authenticated as ADMIN
   */
  isAdmin() {
    if (!this._session) return false;
    if (this._session.expiresAt && this._session.expiresAt <= Date.now()) {
      this._clearSession();
      return false;
    }
    return !!(this._session.user && this._session.user.role === 'ADMIN');
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser() {
    return this._session ? this._session.user : null;
  }

  /**
   * Get current auth token
   */
  getToken() {
    return this._session ? this._session.token : null;
  }

  /**
   * Authenticate with the backend provider
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ ok: boolean, user?: object, token?: string, error?: string }>}
   */
  async login(email, password) {
    if (this._simulateOffline) {
      return {
        ok: false,
        error: 'Unable to connect to the authentication service. Please try again.'
      };
    }

    try {
      const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'http://localhost:5173';

      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        return {
          ok: false,
          error: data.error || 'Invalid email or password.'
        };
      }

      if (response.status === 403 || (data.user && data.user.role !== 'ADMIN')) {
        return {
          ok: false,
          error: data.message || 'You do not have permission to access the Admin Portal.'
        };
      }

      if (!response.ok) {
        if (response.status >= 500) {
          return {
            ok: false,
            error: 'Unable to connect to the authentication service. Please try again.'
          };
        }
        return {
          ok: false,
          error: data.error || 'Invalid email or password.'
        };
      }

      // Verify the returned account has ADMIN role
      if (!data.user || data.user.role !== 'ADMIN') {
        return {
          ok: false,
          error: 'You do not have permission to access the Admin Portal.'
        };
      }

      const sessionData = {
        token: data.token || `ktk_sess_${Date.now()}`,
        user: data.user,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      };

      this._saveSession(sessionData);

      return {
        ok: true,
        user: data.user,
        token: sessionData.token
      };

    } catch (err) {
      // Network failure / server offline
      console.warn('Backend fetch failed or network offline:', err);
      return {
        ok: false,
        error: 'Unable to connect to the authentication service. Please try again.'
      };
    }
  }

  /**
   * Log out and invalidate session
   */
  async logout() {
    const token = this.getToken();
    try {
      if (token) {
        const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
          ? window.location.origin
          : 'http://localhost:5173';
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => {});
      }
    } catch (_) {}

    this._clearSession();
    return { ok: true };
  }
}

export const authService = new AuthService();
