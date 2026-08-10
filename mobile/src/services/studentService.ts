import { apiFetch } from './api';

export interface StudentProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  iin: string;
  university_id: string;
  skills: string;
  gpa: number;
  specialization: string;
  graduation_year: number;
  bio: string;
  phone: string;
  location_city: string;
  github_url?: string;
  diploma_verified: boolean;
  created_at: string;
  updated_at: string;
}

type ProfileInput = Partial<Omit<StudentProfile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'diploma_verified'>>;

export const studentService = {
  async getProfile(): Promise<StudentProfile> {
    const res = await apiFetch('/api/students/profile');
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  async createProfile(data: ProfileInput): Promise<StudentProfile> {
    const res = await apiFetch('/api/students/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
    }
    return res.json();
  },

  async updateProfile(data: ProfileInput): Promise<StudentProfile> {
    const res = await apiFetch('/api/students/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
    }
    return res.json();
  },

  async listByUniversity(): Promise<{ students: StudentProfile[]; total: number }> {
    const res = await apiFetch('/api/students');
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },
};
