/**
 * FEDERAL-GRADE: Frontend Authentication System
 */

import { secureStorage } from './secureStorage';

const API_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

class AuthService {
  constructor() {
    this.token = null;
    this.user = null;
    this.loading = false;
  }

  async init() {
    // Load token from secure storage
    const stored = await secureStorage.getItem('auth_token');
    if (stored) {
      this.token = stored.token;
      this.user = stored.user;
      return true;
    }
    return false;
  }

  async register(email, password, firstName, lastName) {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role: 'sales_rep'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      await this.setAuth(data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      await this.setAuth(data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  async setAuth(data) {
    this.token = data.access_token;
    this.user = data.user;
    
    // Store encrypted
    await secureStorage.setItem('auth_token', {
      token: data.access_token,
      user: data.user,
      expires_at: Date.now() + (data.expires_in * 1000)
    });
  }

  async logout() {
    try {
      if (this.token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
      }
    } catch {
      // Logout error - silent
    } finally {
      this.token = null;
      this.user = null;
      await secureStorage.removeItem('auth_token');
    }
  }

  async getCurrentUser() {
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        // Token expired or invalid
        await this.logout();
        return null;
      }

      const user = await response.json();
      this.user = user;
      return user;
    } catch {
      return null;
    }
  }

  getToken() {
    return this.token;
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!this.token;
  }

  hasPermission(permission) {
    if (!this.user || !this.user.permissions) return false;
    return this.user.permissions.includes(permission);
  }

  hasRole(role) {
    if (!this.user) return false;
    return this.user.role === role;
  }
}

// Singleton instance
export const authService = new AuthService();

// API client with auth
export async function authenticatedFetch(url, options = {}) {
  const token = authService.getToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired, logout
    await authService.logout();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return response;
}