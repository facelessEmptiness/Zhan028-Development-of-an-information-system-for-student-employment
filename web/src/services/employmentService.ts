import { apiFetch } from '../utils/apiClient';

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
  // computed fields
  days_worked: number;
  months_worked: number;
  grant_fulfilled: boolean;
  remaining_days: number;
  progress: number; // 0-100
}

export const employmentService = {
  // Student: get own employment records
  async getMyRecords(): Promise<EmploymentRecord[]> {
    const res = await apiFetch('/api/employment/student');
    if (!res.ok) throw new Error(`Failed to load employment records: ${res.status}`);
    const data = await res.json();
    return data.records ?? [];
  },

  // University: get all employment records (optionally filtered by student IDs)
  async getAllRecords(studentIds?: string[]): Promise<EmploymentRecord[]> {
    let url = '/api/employment/university';
    if (studentIds && studentIds.length > 0) {
      url += `?student_ids=${studentIds.join(',')}`;
    }
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Failed to load employment records: ${res.status}`);
    const data = await res.json();
    return data.records ?? [];
  },

  // University/admin: mark employment as ended early
  async endEmployment(id: string): Promise<void> {
    const res = await apiFetch(`/api/employment/${id}/end`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Failed to end employment: ${res.status}`);
  },
};
