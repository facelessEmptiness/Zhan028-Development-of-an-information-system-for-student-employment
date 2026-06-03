import { apiFetch } from '../utils/apiClient';

export type ComplianceState =
  | 'NotYetDue'
  | 'InProgress'
  | 'Compliant'
  | 'AtRisk'
  | 'NonCompliant'
  | 'Exempt';

export interface ComplianceRecord {
  id: string;
  student_id: string;
  university_id?: string;
  state: ComplianceState;
  graduation_date?: string;
  grant_years: number;
  deadline?: string;
  employment_record_id?: string;
  exempt_reason?: string;
  evidence_doc_id?: string;
  transitioned_by?: string;
  transitioned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EnrollInput {
  student_id: string;
  grant_years?: number;
  graduation_date?: string;
  deadline?: string;
}

export const complianceService = {
  // University/admin: list compliance records (dashboard + at-risk panel)
  async getForUniversity(): Promise<ComplianceRecord[]> {
    const res = await apiFetch('/api/compliance/university');
    if (!res.ok) throw new Error(`Failed to load compliance records: ${res.status}`);
    const data = await res.json();
    return data.records ?? [];
  },

  // University/admin: enroll a grant student into compliance tracking
  async enroll(input: EnrollInput): Promise<ComplianceRecord> {
    const res = await apiFetch('/api/compliance/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Failed to enroll student: ${res.status}`);
    return res.json();
  },
};
