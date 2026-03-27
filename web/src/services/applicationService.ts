import { apiFetch } from '../utils/apiClient';

const API_BASE = '/api';

export interface Application {
  id: string;
  student_id: string;
  vacancy_id: string;
  status: 'applied' | 'interview' | 'shortlisted' | 'rejected' | 'offered';
  cover_letter: string;
  match_score: number;
  created_at: string;
  student?: {
    first_name: string;
    last_name: string;
    iin: string;
    university_id: string;
    skills?: string;
  };
}

export const applicationService = {
  apply: async (vacancyId: string, coverLetter: string): Promise<Application> => {
    const res = await apiFetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vacancy_id: vacancyId, cover_letter: coverLetter }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = `Ошибка ${res.status}`;
      try { message = JSON.parse(text).error || message; } catch { /* */ }
      throw new Error(message);
    }
    return res.json();
  },

  getMyApplications: async (): Promise<Application[]> => {
    const res = await apiFetch(`${API_BASE}/applications/my`);
    if (!res.ok) throw new Error('Не удалось загрузить заявки');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.applications ?? []);
  },

  getVacancyApplications: async (vacancyId: string): Promise<Application[]> => {
    const res = await apiFetch(`${API_BASE}/applications/vacancy/${vacancyId}`);
    if (!res.ok) throw new Error('Не удалось загрузить заявки');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.applications ?? []);
  },

  updateStatus: async (id: string, status: string): Promise<Application> => {
    const res = await apiFetch(`${API_BASE}/applications/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Не удалось обновить статус');
    return res.json();
  },

  withdraw: async (id: string): Promise<void> => {
    await apiFetch(`${API_BASE}/applications/${id}`, { method: 'DELETE' });
  },
};
