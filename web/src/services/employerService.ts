// Employer Service - Handles all employer-related operations

import { apiFetch } from '../utils/apiClient';

const API_BASE = '/api';

export interface JobPosting {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  location: string;
  salary_min: number;
  salary_max: number;
  job_type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract';
  skills: string;
  status: 'active' | 'closed' | 'draft';
  created_at: string;
  company_name?: string;
}

export interface CandidateProfile {
  id: number;
  name: string;
  email: string;
  university: string;
  major: string;
  skills: string[];
  experience: string;
  matchIndex: number;
  resumeUrl: string;
}

export interface ApplicationReview {
  id: number;
  jobId: number;
  candidateId: number;
  candidateName: string;
  status: 'applied' | 'interview' | 'shortlisted' | 'rejected' | 'offered';
  appliedDate: string;
  matchIndex: number;
  notes: string;
}

// Employer Service Functions
export const employerService = {
  // Get company profile
  getCompanyProfile: async (_employerId: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/employers/profile`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // Get all job postings for employer (my vacancies)
  getJobPostings: async (): Promise<JobPosting[]> => {
    const res = await apiFetch(`${API_BASE}/vacancies/my`);
    if (!res.ok) throw new Error('Не удалось загрузить вакансии');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.vacancies ?? []);
  },

  // Create new job posting
  createJobPosting: async (jobData: {
    title: string;
    description: string;
    location: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    skills: string;
  }): Promise<JobPosting> => {
    const res = await apiFetch(`${API_BASE}/vacancies/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = `Ошибка ${res.status}`;
      try { message = JSON.parse(text).error || message; } catch { /* non-JSON response */ }
      throw new Error(message);
    }
    return res.json();
  },

  // Update job posting
  updateJobPosting: async (jobId: string, jobData: Partial<JobPosting>): Promise<JobPosting> => {
    const res = await apiFetch(`${API_BASE}/vacancies/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    if (!res.ok) throw new Error('Не удалось обновить вакансию');
    return res.json();
  },

  // Close job posting
  closeJobPosting: async (jobId: string): Promise<boolean> => {
    const res = await apiFetch(`${API_BASE}/vacancies/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    return res.ok;
  },

  // Search candidates — not yet supported by backend
  searchCandidates: async (_employerId: string, _filters?: any): Promise<CandidateProfile[]> => {
    return [];
  },

  // Get candidate profile by user_id
  getCandidateProfile: async (_employerId: string, candidateId: number): Promise<CandidateProfile | null> => {
    try {
      const res = await apiFetch(`${API_BASE}/students/${candidateId}`);
      if (!res.ok) return null;
      const s = await res.json();
      return {
        id: candidateId,
        name: `${s.first_name} ${s.last_name}`,
        email: '',
        university: s.university_id ?? '',
        major: s.specialization ?? '',
        skills: s.skills ? s.skills.split(',').map((x: string) => x.trim()) : [],
        experience: s.bio ?? '',
        matchIndex: 0,
        resumeUrl: '#',
      };
    } catch {
      return null;
    }
  },

  // Get applications for a vacancy
  getApplicationsForJob: async (_employerId: string, jobId: number): Promise<ApplicationReview[]> => {
    try {
      const res = await apiFetch(`${API_BASE}/applications/vacancy/${jobId}`);
      if (!res.ok) return [];
      const data = await res.json();
      const apps = Array.isArray(data) ? data : (data.applications ?? []);
      return apps.map((a: any) => ({
        id: a.id,
        jobId,
        candidateId: a.student_id,
        candidateName: a.student
          ? `${a.student.first_name} ${a.student.last_name}`
          : a.student_id,
        status: a.status,
        appliedDate: new Date(a.created_at).toLocaleDateString('ru-RU'),
        matchIndex: a.match_score ?? 0,
        notes: a.cover_letter ?? '',
      }));
    } catch {
      return [];
    }
  },

  // Update application status
  updateApplicationStatus: async (
    _employerId: string,
    applicationId: number,
    status: ApplicationReview['status']
  ): Promise<boolean> => {
    try {
      const res = await apiFetch(`${API_BASE}/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Send offer — sets application status to "offered"
  sendOffer: async (_employerId: string, applicationId: number, _offerData: any): Promise<boolean> => {
    try {
      const res = await apiFetch(`${API_BASE}/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'offered' }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Schedule interview — delegated to interviewService
  scheduleInterview: async (
    _employerId: string,
    _applicationId: number,
    _interviewData: any
  ): Promise<boolean> => {
    return false;
  },

  // Get employer statistics from analytics
  getStatistics: async (_employerId: string) => {
    try {
      const [jobs, res] = await Promise.all([
        employerService.getJobPostings(),
        apiFetch('/api/analytics/summary'),
      ]);
      const summary = res.ok ? await res.json() : null;
      return {
        activeJobs: jobs.filter(j => j.status === 'active').length,
        totalApplications: summary?.applications?.total ?? 0,
        interviewsScheduled: 0,
        hiresThisMonth: summary?.applications?.offered_count ?? 0,
      };
    } catch {
      return { activeJobs: 0, totalApplications: 0, interviewsScheduled: 0, hiresThisMonth: 0 };
    }
  },
};
