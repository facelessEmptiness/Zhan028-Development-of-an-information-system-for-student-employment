import { apiFetch } from '../utils/apiClient';

const API_BASE = '/api/employers';

export interface EmployerProfile {
  employer_id: string;
  company_name: string;
  company_description: string;
  industry: string;
  company_size: string;
  website: string;
  location: string;
  contact_email: string;
  contact_phone: string;
  created_at: string;
  updated_at: string;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(url, options);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const employerProfileService = {
  getProfile(): Promise<EmployerProfile> {
    return request(`${API_BASE}/profile`);
  },

  createProfile(data: Omit<EmployerProfile, 'employer_id' | 'created_at' | 'updated_at'>): Promise<EmployerProfile> {
    return request(`${API_BASE}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateProfile(data: Omit<EmployerProfile, 'employer_id' | 'created_at' | 'updated_at'>): Promise<EmployerProfile> {
    return request(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};
