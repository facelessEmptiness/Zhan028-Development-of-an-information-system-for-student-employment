import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './api';

export interface User {
  id: string;
  email: string;
  role: 'student' | 'employer' | 'university' | 'admin';
  university_id?: string;
  is_email_verified: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  tokens: TokenResponse;
  user: User;
}

export interface RegisterInput {
  email: string;
  password: string;
  role: 'student' | 'employer' | 'university';
  university_id?: string;
  first_name?: string;
  last_name?: string;
}

export const authService = {
  async register(data: RegisterInput): Promise<{ email: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Ошибка регистрации');
    }
    return res.json();
  },

  async verifyEmail(email: string, code: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? err.error ?? 'Неверный или просроченный код');
    }
  },

  async resendVerification(email: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? err.error ?? 'Ошибка отправки кода');
    }
  },

  async forgotPassword(email: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Ошибка отправки письма');
    }
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Ошибка сброса пароля');
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Ошибка входа');
    }
    const data: AuthResponse = await res.json();
    await SecureStore.setItemAsync('access_token', data.tokens.access_token);
    await SecureStore.setItemAsync('refresh_token', data.tokens.refresh_token);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    return data;
  },

  async logout(): Promise<void> {
    const refresh_token = await AsyncStorage.getItem('refresh_token');
    if (refresh_token) {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      }).catch(() => {});
    }
    try { await SecureStore.deleteItemAsync('access_token'); } catch {}
    try { await SecureStore.deleteItemAsync('refresh_token'); } catch {}
    try { await SecureStore.deleteItemAsync('user'); } catch {}
    // clean up legacy AsyncStorage tokens (migration safety)
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']).catch(() => {});
  },

  async getStoredUser(): Promise<User | null> {
    const raw = await SecureStore.getItemAsync('user');
    return raw ? JSON.parse(raw) : null;
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync('access_token');
  },
};
