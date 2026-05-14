import { apiFetch } from './api';
import type { Vacancy } from './jobService';

export const employerVacancyService = {
  async getMyVacancies(): Promise<Vacancy[]> {
    const res = await apiFetch('/api/vacancies/my');
    if (!res.ok) throw new Error('Не удалось загрузить вакансии');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.vacancies ?? []);
  },

  async create(data: {
    title: string;
    description: string;
    location: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    skills: string;
  }): Promise<Vacancy> {
    const res = await apiFetch('/api/vacancies/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
    }
    return res.json();
  },

  async update(id: string, data: Partial<Vacancy>): Promise<Vacancy> {
    const res = await apiFetch(`/api/vacancies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Ошибка ${res.status}`);
    }
    return res.json();
  },

  async close(id: string): Promise<void> {
    await apiFetch(`/api/vacancies/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'closed' }),
    });
  },
};
