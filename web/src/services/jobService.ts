import { apiFetch } from '../utils/apiClient';
import type { JobPosting } from './employerService';
import { parseSkills } from '../utils';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: { min: number; max: number };
  type: 'Full-time' | 'Part-time' | 'Internship' | 'Contract';
  description: string;
  requirements: string[];
  skills: string[];
  postedDate: string;
  applicants: number;
  matchIndex?: number;
}

export interface JobSearchFilters {
  searchTerm?: string;
  jobType?: string;
  location?: string;
  minSalary?: number;
  maxSalary?: number;
  skills?: string[];
  page?: number;
  pageSize?: number;
}

interface VacancyListResponse {
  vacancies: JobPosting[];
  total: number;
}

function toJob(v: JobPosting): Job {
  return {
    id: v.id,
    title: v.title,
    company: v.company_name || 'Работодатель',
    location: v.location || '',
    salary: { min: v.salary_min, max: v.salary_max },
    type: v.job_type as Job['type'],
    description: v.description,
    requirements: [],
    skills: parseSkills(v.skills),
    postedDate: v.created_at ? new Date(v.created_at).toLocaleDateString('ru-RU') : '',
    applicants: 0,
  };
}

export const jobService = {
  getAllJobs: async (filters?: JobSearchFilters): Promise<Job[]> => {
    const params = new URLSearchParams();
    params.set('page', String(filters?.page ?? 1));
    params.set('page_size', String(filters?.pageSize ?? 20));
    if (filters?.searchTerm) params.set('search', filters.searchTerm);
    if (filters?.jobType) params.set('job_type', filters.jobType);
    if (filters?.location) params.set('location', filters.location);
    if (filters?.minSalary) params.set('salary_min', String(filters.minSalary));
    if (filters?.maxSalary) params.set('salary_max', String(filters.maxSalary));
    if (filters?.skills?.length) params.set('skills', filters.skills.join(','));

    const res = await apiFetch(`/api/vacancies/?${params.toString()}`);
    if (!res.ok) return [];
    const data: VacancyListResponse = await res.json();
    return (data.vacancies ?? []).map(toJob);
  },

  getJobById: async (jobId: string): Promise<Job | null> => {
    const res = await apiFetch(`/api/vacancies/${jobId}`);
    if (!res.ok) return null;
    const v: JobPosting = await res.json();
    return toJob(v);
  },

  searchJobs: async (searchTerm: string, filters?: JobSearchFilters): Promise<Job[]> => {
    return jobService.getAllJobs({ ...filters, searchTerm });
  },

  getRecommendedJobs: async (_studentId: string, limit: number = 5): Promise<Job[]> => {
    const jobs = await jobService.getAllJobs({ pageSize: limit * 3 });
    return jobs.slice(0, limit);
  },

  getTrendingJobs: async (limit: number = 6): Promise<Job[]> => {
    const jobs = await jobService.getAllJobs({ pageSize: limit });
    return jobs.slice(0, limit);
  },

  getJobsByCategory: async (category: string): Promise<Job[]> => {
    return jobService.getAllJobs({ searchTerm: category });
  },

  getJobsByLocation: async (location: string): Promise<Job[]> => {
    return jobService.getAllJobs({ location });
  },

  getJobsByCompany: async (companyId: string): Promise<Job[]> => {
    return jobService.getAllJobs({ searchTerm: companyId });
  },

  calculateMatchIndex: async (_jobId: string, _candidateId?: string): Promise<number> => {
    return 0;
  },

  getSimilarJobs: async (jobId: string, limit: number = 3): Promise<Job[]> => {
    const job = await jobService.getJobById(jobId);
    if (!job) return [];
    const skill = job.skills[0] ?? '';
    const jobs = await jobService.getAllJobs({ searchTerm: skill, pageSize: limit + 1 });
    return jobs.filter(j => j.id !== jobId).slice(0, limit);
  },

  getSkillStatistics: async (): Promise<{ skill: string; demand: number }[]> => {
    const res = await apiFetch('/api/analytics/summary');
    if (!res.ok) return [];
    const data = await res.json();
    const skills: { name: string; count: number }[] = data?.vacancies?.demanded_skills ?? [];
    return skills.map(s => ({ skill: s.name, demand: s.count }));
  },

  getJobStatistics: async () => {
    const res = await apiFetch('/api/analytics/summary');
    if (!res.ok) return { totalJobs: 0, newJobsThisWeek: 0, averageSalary: 0, topLocation: '' };
    const data = await res.json();
    const total = data?.vacancies?.total ?? 0;
    const topLocation = data?.vacancies?.by_location?.[0]?.name ?? '';
    return { totalJobs: total, newJobsThisWeek: 0, averageSalary: 0, topLocation };
  },
};
