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
    // TODO: Replace with actual API call
    return {
      name: 'Tech Innovators Inc',
      description: 'Leading software development company',
      location: 'Astana, Kazakhstan',
      website: 'https://example.com',
      industry: 'Technology',
    };
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

  // Search candidates
  searchCandidates: async (_employerId: string, _filters?: any): Promise<CandidateProfile[]> => {
    // TODO: Replace with actual API call
    return [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        university: 'Kazakh National University',
        major: 'Computer Science',
        skills: ['JavaScript', 'React', 'Node.js'],
        experience: '2 years of full-stack development',
        matchIndex: 85,
        resumeUrl: '#',
      },
    ];
  },

  // Get candidate profile
  getCandidateProfile: async (_employerId: string, candidateId: number): Promise<CandidateProfile> => {
    // TODO: Replace with actual API call
    return {
      id: candidateId,
      name: 'John Doe',
      email: 'john@example.com',
      university: 'Kazakh National University',
      major: 'Computer Science',
      skills: ['JavaScript', 'React', 'Node.js'],
      experience: '2 years of full-stack development',
      matchIndex: 85,
      resumeUrl: '#',
    };
  },

  // Get applications for job
  getApplicationsForJob: async (_employerId: string, jobId: number): Promise<ApplicationReview[]> => {
    // TODO: Replace with actual API call
    return [
      {
        id: 1,
        jobId,
        candidateId: 1,
        candidateName: 'John Doe',
        status: 'interview',
        appliedDate: '2024-02-01',
        matchIndex: 85,
        notes: 'Strong candidate, good technical skills',
      },
    ];
  },

  // Update application status
  updateApplicationStatus: async (
    _employerId: string,
    applicationId: number,
    status: ApplicationReview['status']
  ): Promise<boolean> => {
    // TODO: Replace with actual API call
    console.log('Updating application status:', applicationId, status);
    return true;
  },

  // Send offer to candidate
  sendOffer: async (_employerId: string, applicationId: number, offerData: any): Promise<boolean> => {
    // TODO: Replace with actual API call
    console.log('Sending offer for application:', applicationId, offerData);
    return true;
  },

  // Schedule interview
  scheduleInterview: async (
    _employerId: string,
    applicationId: number,
    interviewData: any
  ): Promise<boolean> => {
    // TODO: Replace with actual API call
    console.log('Scheduling interview for application:', applicationId, interviewData);
    return true;
  },

  // Get employer statistics
  getStatistics: async (_employerId: string) => {
    // TODO: Replace with actual API call
    return {
      activeJobs: 5,
      totalApplications: 124,
      interviewsScheduled: 12,
      hiresThisMonth: 3,
    };
  },
};
