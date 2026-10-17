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
      // Prefer sessionStorage. Also check localStorage to clear any stale entries
      // left by an older build that wrote sessions there.
      const sStore = this._getStorage('session');
      const lStore = this._getStorage('local');

      // Always purge any leftover localStorage session (old build artifact).
      if (lStore && lStore.getItem(SESSION_STORAGE_KEY)) {
        lStore.removeItem(SESSION_STORAGE_KEY);
      }

      const data = sStore && sStore.getItem(SESSION_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.token && parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed;
        }
        // Session is expired or malformed — remove it.
        if (sStore) sStore.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
    }
    return null;
  }

  _saveSession(sessionData) {
    this._session = sessionData;
    this._memorySession = sessionData;
    try {
      const serialized = JSON.stringify(sessionData);
      // Use sessionStorage ONLY — sessions must not persist across browser restarts.
      // Writing to localStorage would cause ghost sessions that bypass login on reload.
      const sStore = this._getStorage('session');
      if (sStore) sStore.setItem(SESSION_STORAGE_KEY, serialized);
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  }

  _clearSession() {
    this._session = null;
    this._memorySession = null;
    try {
      // Clear from both storages in case a stale localStorage entry exists from an older build.
      const sStore = this._getStorage('session');
      const lStore = this._getStorage('local');
      if (sStore) sStore.removeItem(SESSION_STORAGE_KEY);
      if (lStore) lStore.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn('Storage remove failed:', e);
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
    // Always re-load from storage so we catch expiry or concurrent logout.
    this._session = this._loadSession();

    if (!this._session) {
      // No valid session token — not an admin.
      // NOTE: We deliberately do NOT fall back to store.state.adminAuth here.
      // That flag is a stale localStorage value with no expiry and must not be
      // used as a substitute for a real authenticated session.
      return false;
    }

    // Double-check expiry (loadSession already validates, but be explicit).
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
   * Authenticate email and password with backend
   * Initiates Two-Factor OTP verification upon matching credentials.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ ok: boolean, requiresOtp?: boolean, preAuthToken?: string, maskedEmail?: string, error?: string }>}
   */
  async login(email, password) {
    if (this._simulateOffline) {
      return {
        ok: false,
        error: 'Unable to connect to the authentication service. Please try again.'
      };
    }

    const normEmail = (email || '').trim().toLowerCase();
    const normPass = (password || '').trim();

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
        body: JSON.stringify({ email: normEmail, password: normPass })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok && data.requiresOtp) {
        return {
          ok: true,
          requiresOtp: true,
          preAuthToken: data.preAuthToken,
          maskedEmail: data.maskedEmail,
          emailSent: !!data.emailSent,
          deliveryMethod: data.deliveryMethod || (data.emailSent ? 'email' : 'dev_file'),
          expiresInSeconds: data.expiresInSeconds || 300
        };
      }

      if (response.status === 401) {
        return {
          ok: false,
          error: data.error || 'Invalid email or password.'
        };
      }

      if (response.status >= 500) {
        return {
          ok: false,
          error: data.error || 'Authentication service error. Please try again later.'
        };
      }

      return {
        ok: false,
        error: data.error || 'Invalid email or password.'
      };

    } catch (err) {
      console.warn('Backend fetch failed or offline:', err);
      return {
        ok: false,
        error: 'Unable to connect to the authentication service. Please try again.'
      };
    }
  }

  /**
   * Resend OTP verification code
   * @param {string} preAuthToken
   * @returns {Promise<{ ok: boolean, emailSent?: boolean, deliveryMethod?: string, expiresInSeconds?: number, error?: string }>}
   */
  async sendOtp(preAuthToken) {
    try {
      const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'http://localhost:5173';

      const response = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ preAuthToken })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        return {
          ok: true,
          emailSent: !!data.emailSent,
          deliveryMethod: data.deliveryMethod || (data.emailSent ? 'email' : 'dev_file'),
          expiresInSeconds: data.expiresInSeconds || 300
        };
      }

      return {
        ok: false,
        error: data.error || 'Failed to resend code. Please try again.'
      };
    } catch (err) {
      return {
        ok: false,
        error: 'Unable to connect to the server. Please try again.'
      };
    }
  }

  /**
   * Verify the one-time code and create authenticated admin session
   * @param {string} preAuthToken
   * @param {string} otp
   * @returns {Promise<{ ok: boolean, user?: object, token?: string, attemptsLeft?: number, error?: string }>}
   */
  async verifyOtp(preAuthToken, otp) {
    try {
      const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'http://localhost:5173';

      const response = await fetch(`${baseUrl}/api/auth/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ preAuthToken, otp })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok && data.user && data.user.role === 'ADMIN') {
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
      }

      return {
        ok: false,
        attemptsLeft: data.attemptsLeft,
        error: data.error || 'Invalid verification code.'
      };

    } catch (err) {
      console.warn('Backend fetch failed or offline:', err);
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

