// Student Service - Handles all student-related operations

import { apiFetch } from '../utils/apiClient';

const API_BASE = '/api';

export interface StudentProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  university: string;
  major: string;
  graduationYear: string;
  bio: string;
  skills: string[];
}

// Backend student profile shape returned from /api/students/profile
export interface BackendStudentProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  iin: string;
  university_id: string;
  skills: string;          // comma-separated
  gpa: number;             // 0.0 - 4.0
  specialization: string;
  graduation_year: number;
  bio: string;
  phone: string;
  location_city: string;
  created_at: string;
  updated_at: string;
}

export interface StudentApplication {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: 'applied' | 'interview' | 'shortlisted' | 'rejected';
  matchIndex: number;
}

export interface Resume {
  id: number;
  name: string;
  url: string;
  uploadedDate: string;
  isPrimary: boolean;
}

// Student Profile Functions
export const studentService = {
  // Get student profile from real API
  getProfile: async (): Promise<BackendStudentProfile> => {
    const res = await apiFetch(`${API_BASE}/students/profile`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  // Create student profile via real API
  createProfile: async (data: {
    first_name: string;
    last_name: string;
    iin: string;
    university_id?: string;
    skills?: string;
    gpa?: number;
    specialization?: string;
    graduation_year?: number;
    bio?: string;
    phone?: string;
    location_city?: string;
  }): Promise<BackendStudentProfile> => {
    const res = await apiFetch(`${API_BASE}/students/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error || `Ошибка ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  },

  // Update student profile via real API
  updateProfile: async (data: {
    first_name?: string;
    last_name?: string;
    university_id?: string;
    skills?: string;
    gpa?: number;
    specialization?: string;
    graduation_year?: number;
    bio?: string;
    phone?: string;
    location_city?: string;
  }): Promise<BackendStudentProfile> => {
    const res = await apiFetch(`${API_BASE}/students/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error || `Ошибка ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  },

  // Get student applications
  getApplications: async (_studentId: string): Promise<StudentApplication[]> => {
    return [];
  },

  // Apply for a job
  applyForJob: async (_studentId: string, jobId: number, coverLetter: string): Promise<boolean> => {
    console.log('Applying for job:', jobId, 'with cover letter:', coverLetter);
    return true;
  },

  // Get resumes
  getResumes: async (_studentId: string): Promise<Resume[]> => {
    return [];
  },

  // Upload resume
  uploadResume: async (_studentId: string, file: File): Promise<Resume> => {
    console.log('Uploading resume:', file.name);
    return {
      id: 2,
      name: file.name,
      url: '#',
      uploadedDate: new Date().toISOString().split('T')[0],
      isPrimary: false,
    };
  },

  // List students for university admin (filtered by their university_id automatically)
  listByUniversity: async (): Promise<{ students: BackendStudentProfile[]; total: number }> => {
    const res = await apiFetch(`${API_BASE}/students`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  getRecommendedJobs: async (_studentId: string) => {
    return [];
  },

  saveJob: async (_studentId: string, jobId: number): Promise<boolean> => {
    console.log('Saving job:', jobId);
    return true;
  },

  getSavedJobs: async (_studentId: string) => {
    return [];
  },
};
