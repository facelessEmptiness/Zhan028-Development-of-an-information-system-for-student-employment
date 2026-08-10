import { apiFetch } from './api';

export interface AnalyticsSummary {
  students: {
    total: number;
    by_specialization: { specialization: string; count: number }[];
  };
  vacancies: {
    total: number;
    demanded_skills: { name: string; count: number }[];
    by_job_type: { name: string; count: number }[];
    by_location: { name: string; count: number }[];
  };
  applications: {
    total: number;
    offered_count: number;
    by_status: { status: string; count: number }[];
  };
}

export const universityService = {
  async getAnalytics(): Promise<AnalyticsSummary | null> {
    const res = await apiFetch('/api/analytics/summary');
    if (!res.ok) return null;
    return res.json();
  },

  async getStudents(): Promise<any[]> {
    const res = await apiFetch('/api/students');
    if (!res.ok) return [];
    const data = await res.json();
    return data.students ?? [];
  },
};
