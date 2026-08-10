import { apiFetch } from './api';

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
  bin: string;
  bin_status: string;
  created_at: string;
  updated_at: string;
}

export type ProfileInput = Omit<EmployerProfile, 'employer_id' | 'created_at' | 'updated_at'>;

export const employerProfileService = {
  async getProfile(): Promise<EmployerProfile> {
    const res = await apiFetch('/api/employers/profile');
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  async saveProfile(data: ProfileInput, exists: boolean): Promise<EmployerProfile> {
    const res = await apiFetch('/api/employers/profile', {
      method: exists ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
    }
    return res.json();
  },
};
