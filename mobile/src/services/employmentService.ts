import { apiFetch } from './api';

export interface EmploymentRecord {
  id: string;
  student_id: string;
  employer_id: string;
  application_id: string;
  vacancy_id: string;
  company_name: string;
  job_title: string;
  started_at: string;
  ended_at?: string;
  status: 'active' | 'completed' | 'terminated_early';
  created_at: string;
  updated_at: string;
  days_worked: number;
  months_worked: number;
  grant_fulfilled: boolean;
  remaining_days: number;
  progress: number;
}

export const employmentService = {
  async getMyRecords(): Promise<EmploymentRecord[]> {
    const res = await apiFetch('/api/employment/student');
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    return data.records ?? [];
  },

  async getForEmployer(): Promise<EmploymentRecord[]> {
    const res = await apiFetch('/api/employment/employer');
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    return data.records ?? [];
  },

  async getAllRecords(): Promise<EmploymentRecord[]> {
    const res = await apiFetch('/api/employment/university');
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    return data.records ?? [];
  },
};
