/**
 * Simple authentication helper
 * In development: auto-authenticates with demo token
 * In production: requires proper login
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'jnotes_auth_token';

class AuthService {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on init
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Set auth token
   */
  setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Clear auth token
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Get demo token (for development)
   */
  async getDemoToken(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/auth/demo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'demo-user' }),
    });

    if (!response.ok) {
      throw new Error('Failed to get demo token');
    }

    const data = await response.json();
    this.setToken(data.token);
    return data.token;
  }

  /**
   * Login (future implementation)
   */
  async login(email: string, password: string): Promise<void> {
    // TODO: Implement proper login
    throw new Error('Login not implemented yet');
  }

  /**
   * Logout
   */
  logout() {
    this.clearToken();
  }
}

// Singleton instance
export const auth = new AuthService();
