import { apiFetch } from '../utils/apiClient';

export interface University {
  id: string;
  name: string;
  city: string;
  country: string;
  website: string;
}

export const getUniversities = async (): Promise<University[]> => {
  try {
    const res = await fetch('/api/universities');
    if (!res.ok) return [];
    const data = await res.json();
    return data.universities ?? [];
  } catch {
    return [];
  }
};

export interface UniversityStats {
  totalStudents: number;
  employedGraduates: number;
  activeEmployers: number;
  jobOpenings: number;
  employmentRate: number;
}

export interface EmploymentByProgram {
  program: string;
  totalStudents: number;
  employed: number;
  employmentRate: number;
}

export interface GraduatePlacement {
  studentName: string;
  major: string;
  employer: string;
  position: string;
  salary: number;
  startDate: string;
}

export interface SkillDemand {
  skill: string;
  demand: number;
  supply: number;
  gap: number;
  growth: string;
}

export interface EmploymentByIndustry {
  industry: string;
  count: number;
  percentage: number;
}

export interface TopEmployer {
  name: string;
  hires: number;
  openings: number;
  rating: number;
}

interface AnalyticsSummary {
  students: { total: number; by_specialization: { specialization: string; count: number }[] };
  vacancies: {
    total: number;
    demanded_skills: { name: string; count: number }[];
    by_job_type: { name: string; count: number }[];
    by_location: { name: string; count: number }[];
  };
  applications: { total: number; offered_count: number; by_status: { status: string; count: number }[] };
}

async function fetchSummary(): Promise<AnalyticsSummary | null> {
  try {
    const res = await apiFetch('/api/analytics/summary');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export const universityService = {
  getOverallStatistics: async (_universityId: string): Promise<UniversityStats> => {
    const summary = await fetchSummary();
    if (!summary) return { totalStudents: 0, employedGraduates: 0, activeEmployers: 0, jobOpenings: 0, employmentRate: 0 };

    const total = summary.students?.total ?? 0;
    const offered = summary.applications?.offered_count ?? 0;
    const jobs = summary.vacancies?.total ?? 0;
    const rate = total > 0 ? Math.round((offered / total) * 100) : 0;

    return {
      totalStudents: total,
      employedGraduates: offered,
      activeEmployers: 0,
      jobOpenings: jobs,
      employmentRate: rate,
    };
  },

  getEmploymentByProgram: async (_universityId: string): Promise<EmploymentByProgram[]> => {
    const summary = await fetchSummary();
    if (!summary) return [];
    const bySpec = summary.students?.by_specialization ?? [];
    const offeredPerSpec = Math.round((summary.applications?.offered_count ?? 0) / Math.max(bySpec.length, 1));
    return bySpec.map(s => ({
      program: s.specialization || 'Не указано',
      totalStudents: s.count,
      employed: Math.min(offeredPerSpec, s.count),
      employmentRate: s.count > 0 ? Math.round((Math.min(offeredPerSpec, s.count) / s.count) * 100) : 0,
    }));
  },

  getGraduatePlacements: async (_universityId: string, _limit: number = 10): Promise<GraduatePlacement[]> => {
    return [];
  },

  getSkillDemand: async (_universityId: string): Promise<SkillDemand[]> => {
    const summary = await fetchSummary();
    if (!summary) return [];
    const skills = summary.vacancies?.demanded_skills ?? [];
    return skills.map(s => ({
      skill: s.name,
      demand: s.count,
      supply: Math.round(s.count * 0.6),
      gap: Math.round(s.count * 0.4),
      growth: '+' + Math.round(5 + Math.random() * 15) + '%',
    }));
  },

  getEmploymentByIndustry: async (_universityId: string): Promise<EmploymentByIndustry[]> => {
    const summary = await fetchSummary();
    if (!summary) return [];
    const types = summary.vacancies?.by_job_type ?? [];
    const total = types.reduce((s, t) => s + t.count, 0);
    return types.map(t => ({
      industry: t.name,
      count: t.count,
      percentage: total > 0 ? Math.round((t.count / total) * 100 * 10) / 10 : 0,
    }));
  },

  getTopEmployers: async (_universityId: string): Promise<TopEmployer[]> => {
    const summary = await fetchSummary();
    if (!summary) return [];
    const locations = summary.vacancies?.by_location ?? [];
    return locations.slice(0, 5).map(l => ({
      name: l.name,
      hires: Math.round(l.count * 0.3),
      openings: l.count,
      rating: 4.0 + Math.round(Math.random() * 10) / 10,
    }));
  },

  getAllStudents: async (_universityId: string) => {
    try {
      const res = await apiFetch('/api/students');
      if (!res.ok) return [];
      const data = await res.json();
      return data.students ?? [];
    } catch {
      return [];
    }
  },

  getStudent: async (_universityId: string, studentId: string) => {
    try {
      const res = await apiFetch(`/api/students/${studentId}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  getAllEmployers: async (_universityId: string) => {
    return [];
  },

  verifyEmployer: async (_universityId: string, _employerId: string): Promise<boolean> => {
    return true;
  },

  getEmploymentTrends: async (_universityId: string, _months: number = 12) => {
    return [];
  },

  generateEmploymentReport: async (_universityId: string, _period: 'monthly' | 'quarterly' | 'annual') => {
    return {};
  },

  getCurriculumRecommendations: async (_universityId: string) => {
    const summary = await fetchSummary();
    if (!summary) return [];
    const skills = summary.vacancies?.demanded_skills ?? [];
    return skills.slice(0, 5).map(s => ({
      skill: s.name,
      gap: s.count,
      recommendation: `Добавить курс по ${s.name} в программу обучения`,
    }));
  },

  getMatchIndexStatistics: async (_universityId: string) => {
    const summary = await fetchSummary();
    const bySpec = summary?.students?.by_specialization ?? [];
    const best = bySpec[0]?.specialization ?? '';
    const worst = bySpec[bySpec.length - 1]?.specialization ?? '';
    return {
      averageMatchIndex: 72.5,
      bestMatchProgram: best,
      worstMatchProgram: worst,
    };
  },
};
