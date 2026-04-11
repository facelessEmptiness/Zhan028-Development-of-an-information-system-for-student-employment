import { apiFetch } from '../utils/apiClient';

const API_BASE = '/api';

export interface Interview {
  id: string;
  application_id: string;
  student_id: string;
  employer_id: string;
  vacancy_id: string;
  scheduled_at: string; // ISO 8601 / RFC3339
  location: string;
  notes: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ScheduleInterviewRequest {
  application_id: string;
  student_id: string;
  vacancy_id: string;
  scheduled_at: string; // RFC3339 e.g. "2025-05-20T14:00:00+06:00"
  location: string;
  notes?: string;
}

export const interviewService = {
  schedule: async (req: ScheduleInterviewRequest): Promise<Interview> => {
    const res = await apiFetch(`${API_BASE}/interviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = `Error ${res.status}`;
      try { message = JSON.parse(text).error || message; } catch { /* */ }
      throw new Error(message);
    }
    return res.json();
  },

  getForEmployer: async (): Promise<Interview[]> => {
    const res = await apiFetch(`${API_BASE}/interviews/employer`);
    if (!res.ok) throw new Error('Failed to load interviews');
    const data = await res.json();
    return data.interviews ?? [];
  },

  getForStudent: async (): Promise<Interview[]> => {
    const res = await apiFetch(`${API_BASE}/interviews/student`);
    if (!res.ok) throw new Error('Failed to load interviews');
    const data = await res.json();
    return data.interviews ?? [];
  },

  getByApplication: async (applicationId: string): Promise<Interview | null> => {
    const res = await apiFetch(`${API_BASE}/interviews/application/${applicationId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to load interview');
    return res.json();
  },

  cancel: async (id: string): Promise<void> => {
    const res = await apiFetch(`${API_BASE}/interviews/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to cancel interview');
  },
};
