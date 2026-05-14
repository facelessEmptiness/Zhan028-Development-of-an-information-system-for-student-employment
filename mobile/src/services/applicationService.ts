import { apiFetch } from './api';

export interface Application {
  id: string;
  student_id: string;
  vacancy_id: string;
  employer_id: string;
  status: 'applied' | 'review' | 'shortlisted' | 'interview' | 'offered' | 'rejected';
  cover_letter: string;
  match_score: number;
  created_at: string;
  updated_at: string;
  student?: {
    first_name: string;
    last_name: string;
    iin: string;
    university_id: string;
    skills?: string;
  };
}

export const STATUS_LABELS: Record<string, string> = {
  applied:     'Отправлена',
  review:      'На рассмотрении',
  shortlisted: 'Шорт-лист',
  interview:   'Собеседование',
  offered:     'Предложение',
  rejected:    'Отклонена',
};

export const STATUS_COLORS: Record<string, string> = {
  applied:     '#3B82F6',
  review:      '#8B5CF6',
  shortlisted: '#F59E0B',
  interview:   '#6366F1',
  offered:     '#10B981',
  rejected:    '#EF4444',
};

export const applicationService = {
  async getMyApplications(): Promise<Application[]> {
    const res = await apiFetch('/api/applications/my');
    if (!res.ok) throw new Error('Не удалось загрузить заявки');
    const data = await res.json();
    return data.applications ?? [];
  },

  async apply(vacancy_id: string, cover_letter: string, match_score: number): Promise<Application> {
    const res = await apiFetch('/api/applications', {
      method: 'POST',
      body: JSON.stringify({ vacancy_id, cover_letter, match_score }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Не удалось подать заявку');
    }
    return res.json();
  },

  async withdraw(id: string): Promise<void> {
    const res = await apiFetch(`/api/applications/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Не удалось отозвать заявку');
  },

  async getVacancyApplications(vacancyId: string): Promise<Application[]> {
    const res = await apiFetch(`/api/applications/vacancy/${vacancyId}`);
    if (!res.ok) throw new Error('Не удалось загрузить заявки');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.applications ?? []);
  },

  async updateStatus(id: string, status: string): Promise<Application> {
    const res = await apiFetch(`/api/applications/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Не удалось обновить статус');
    return res.json();
  },
};
