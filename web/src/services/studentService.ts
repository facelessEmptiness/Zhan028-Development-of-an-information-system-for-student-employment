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
  github_url?: string;
  diploma_verified: boolean;
  diploma_verified_at?: string;
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
    github_url?: string;
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
    github_url?: string;
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

  // Get student applications — delegates to applicationService
  getApplications: async (_studentId: string): Promise<StudentApplication[]> => {
    try {
      const res = await apiFetch(`${API_BASE}/applications/my`);
      if (!res.ok) return [];
      const data = await res.json();
      const apps = Array.isArray(data) ? data : (data.applications ?? []);
      return apps.map((a: {
        id: string; vacancy_id: string; status: string; match_score: number; created_at: string;
      }) => ({
        id: parseInt(a.id),
        jobId: parseInt(a.vacancy_id),
        jobTitle: '',
        company: '',
        appliedDate: new Date(a.created_at).toLocaleDateString('ru-RU'),
        status: a.status as StudentApplication['status'],
        matchIndex: a.match_score ?? 0,
      }));
    } catch {
      return [];
    }
  },

  // Apply for a job — delegates to applicationService
  applyForJob: async (_studentId: string, jobId: number, coverLetter: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancy_id: String(jobId), cover_letter: coverLetter }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Get resumes (documents uploaded as CV)
  getResumes: async (_studentId: string): Promise<Resume[]> => {
    try {
      const res = await apiFetch(`${API_BASE}/documents`);
      if (!res.ok) return [];
      const data = await res.json();
      const docs = Array.isArray(data) ? data : (data.documents ?? []);
      return docs
        .filter((d: { type: string }) => d.type === 'cv' || d.type === 'resume')
        .map((d: { id: string; file_name: string; created_at: string; status: string }, idx: number) => ({
          id: parseInt(d.id) || idx + 1,
          name: d.file_name,
          url: `${API_BASE}/documents/${d.id}/download`,
          uploadedDate: new Date(d.created_at).toLocaleDateString('ru-RU'),
          isPrimary: idx === 0,
        }));
    } catch {
      return [];
    }
  },

  // Upload resume — delegates to documentService
  uploadResume: async (_studentId: string, file: File): Promise<Resume> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'cv');
    const res = await apiFetch(`${API_BASE}/documents/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Ошибка загрузки файла');
    const d = await res.json();
    return {
      id: parseInt(d.id) || 1,
      name: d.file_name || file.name,
      url: `${API_BASE}/documents/${d.id}/download`,
      uploadedDate: new Date().toLocaleDateString('ru-RU'),
      isPrimary: false,
    };
  },

  // List students for university admin (filtered by their university_id automatically)
  listByUniversity: async (pageSize = 500): Promise<{ students: BackendStudentProfile[]; total: number }> => {
    const res = await apiFetch(`${API_BASE}/students?page=1&page_size=${pageSize}`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  // Get any student by their auth user_id (for university/employer lookup)
  getById: async (userId: string): Promise<BackendStudentProfile> => {
    const res = await apiFetch(`${API_BASE}/students/${userId}`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  getRecommendedJobs: async (_studentId: string) => {
    return [];
  },

  saveJob: async (_studentId: string, _jobId: number): Promise<boolean> => {
    return true;
  },

  getSavedJobs: async (_studentId: string) => {
    return [];
  },
};
