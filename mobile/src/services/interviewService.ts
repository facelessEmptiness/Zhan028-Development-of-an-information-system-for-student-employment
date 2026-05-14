import { apiFetch } from './api';

export interface Interview {
  id: string;
  application_id: string;
  employer_id: string;
  student_id: string;
  vacancy_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  vacancy?: { title: string; company_name: string };
  student?: { first_name: string; last_name: string; email: string };
}

export interface InterviewInput {
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string;
  notes?: string;
}

export const interviewService = {
  async getStudentInterviews(): Promise<Interview[]> {
    const res = await apiFetch('/api/interviews/student');
    if (!res.ok) throw new Error('Не удалось загрузить интервью');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.interviews ?? []);
  },

  async getEmployerInterviews(): Promise<Interview[]> {
    const res = await apiFetch('/api/interviews/employer');
    if (!res.ok) throw new Error('Не удалось загрузить интервью');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.interviews ?? []);
  },

  async getForApplication(applicationId: string): Promise<Interview[]> {
    const res = await apiFetch(`/api/interviews/application/${applicationId}`);
    if (!res.ok) throw new Error('Не удалось загрузить интервью');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.interviews ?? []);
  },

  async schedule(input: InterviewInput): Promise<Interview> {
    const res = await apiFetch('/api/interviews', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Не удалось назначить интервью');
    }
    return res.json();
  },

  async cancel(id: string): Promise<void> {
    const res = await apiFetch(`/api/interviews/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Не удалось отменить интервью');
  },
};
