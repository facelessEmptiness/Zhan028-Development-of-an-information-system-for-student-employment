import { apiFetch } from './api';

export interface Vacancy {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  location: string;
  salary_min: number;
  salary_max: number;
  job_type: string;
  skills: string;
  status: string;
  company_name?: string;
  created_at: string;
  match_score?: number | null;
}

export interface VacanciesResponse {
  vacancies: Vacancy[];
  total: number;
}

export interface VacancyQueryParams {
  search?:     string;
  page?:       number;
  page_size?:  number;
  job_type?:   string;
  location?:   string;
  salary_min?: number;
  salary_max?: number;
  sort?:       string;
}

export const jobService = {
  async getAll(params?: VacancyQueryParams): Promise<VacanciesResponse> {
    const q = new URLSearchParams();
    if (params?.search)                q.set('search',     params.search);
    if (params?.job_type)              q.set('job_type',   params.job_type);
    if (params?.location)              q.set('location',   params.location);
    if (params?.salary_min != null)    q.set('salary_min', String(params.salary_min));
    if (params?.salary_max != null)    q.set('salary_max', String(params.salary_max));
    if (params?.sort)                  q.set('sort',       params.sort);
    q.set('page',      String(params?.page      ?? 1));
    q.set('page_size', String(params?.page_size ?? 20));
    const res = await apiFetch(`/api/vacancies?${q.toString()}`);
    if (!res.ok) throw new Error('Не удалось загрузить вакансии');
    const data = await res.json();
    return { vacancies: data.vacancies ?? [], total: data.total ?? 0 };
  },

  async getById(id: string): Promise<Vacancy> {
    const res = await apiFetch(`/api/vacancies/${id}`);
    if (!res.ok) throw new Error('Вакансия не найдена');
    return res.json();
  },
};
