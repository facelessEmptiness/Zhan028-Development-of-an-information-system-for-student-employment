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

interface EmploymentRecord {
  id: string;
  student_id: string;
  employer_id: string;
  vacancy_id: string;
  company_name: string;
  job_title: string;
  started_at: string;
  status: string;
}

async function fetchEmploymentRecords(): Promise<EmploymentRecord[]> {
  try {
    const res = await apiFetch('/api/employment/university');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.records ?? []);
  } catch {
    return [];
  }
}

export const universityService = {
  getOverallStatistics: async (_universityId: string): Promise<UniversityStats> => {
    const [summary, records] = await Promise.all([fetchSummary(), fetchEmploymentRecords()]);
    if (!summary) return { totalStudents: 0, employedGraduates: 0, activeEmployers: 0, jobOpenings: 0, employmentRate: 0 };

    const total = summary.students?.total ?? 0;
    const employed = records.filter(r => r.status === 'active').length;
    const jobs = summary.vacancies?.total ?? 0;
    const employerSet = new Set(records.map(r => r.employer_id));
    const rate = total > 0 ? Math.round((employed / total) * 100) : 0;

    return {
      totalStudents: total,
      employedGraduates: employed,
      activeEmployers: employerSet.size,
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

  getGraduatePlacements: async (_universityId: string, limit: number = 10): Promise<GraduatePlacement[]> => {
    const records = await fetchEmploymentRecords();
    return records.slice(0, limit).map(r => ({
      studentName: r.student_id,
      major: '',
      employer: r.company_name ?? '',
      position: r.job_title ?? '',
      salary: 0,
      startDate: r.started_at ? new Date(r.started_at).toLocaleDateString('ru-RU') : '',
    }));
  },

  getSkillDemand: async (_universityId: string): Promise<SkillDemand[]> => {
    const summary = await fetchSummary();
    if (!summary) return [];
    const skills = summary.vacancies?.demanded_skills ?? [];
    const maxCount = skills[0]?.count ?? 1;
    return skills.map(s => ({
      skill: s.name,
      demand: s.count,
      supply: Math.round(s.count * 0.6),
      gap: Math.round(s.count * 0.4),
      growth: s.count >= maxCount * 0.7 ? '+высокий' : s.count >= maxCount * 0.4 ? '+средний' : '+низкий',
    }));
  },

  getEmploymentByIndustry: async (_universityId: string): Promise<EmploymentByIndustry[]> => {
    const records = await fetchEmploymentRecords();
    const byCompany: Record<string, number> = {};
    for (const r of records) {
      const key = r.company_name || 'Другое';
      byCompany[key] = (byCompany[key] ?? 0) + 1;
    }
    const total = records.length;
    return Object.entries(byCompany)
      .sort((a, b) => b[1] - a[1])
      .map(([industry, count]) => ({
        industry,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }));
  },

  getTopEmployers: async (_universityId: string): Promise<TopEmployer[]> => {
    const [records, summary] = await Promise.all([fetchEmploymentRecords(), fetchSummary()]);
    const hiresByCompany: Record<string, { name: string; hires: number; employer_id: string }> = {};
    for (const r of records) {
      const key = r.employer_id;
      if (!hiresByCompany[key]) hiresByCompany[key] = { name: r.company_name ?? '', hires: 0, employer_id: key };
      hiresByCompany[key].hires += 1;
    }
    const vacanciesByEmployer: Record<string, number> = {};
    // Use analytics summary data for openings count (approximate by total vacancies / employers)
    const totalVacancies = summary?.vacancies?.total ?? 0;
    const employerCount = Object.keys(hiresByCompany).length || 1;
    const avgVacancies = Math.round(totalVacancies / employerCount);

    return Object.values(hiresByCompany)
      .sort((a, b) => b.hires - a.hires)
      .slice(0, 10)
      .map(e => ({
        name: e.name,
        hires: e.hires,
        openings: vacanciesByEmployer[e.employer_id] ?? avgVacancies,
      }));
  },

  getAllStudents: async (_universityId: string) => {
    try {
      const res = await apiFetch('/api/students?page=1&page_size=500');
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

  getAllEmployers: async (_universityId: string): Promise<{ id: string; name: string; hires: number }[]> => {
    const records = await fetchEmploymentRecords();
    const map: Record<string, { id: string; name: string; hires: number }> = {};
    for (const r of records) {
      if (!map[r.employer_id]) map[r.employer_id] = { id: r.employer_id, name: r.company_name ?? '', hires: 0 };
      map[r.employer_id].hires += 1;
    }
    return Object.values(map).sort((a, b) => b.hires - a.hires);
  },

  getEmploymentTrends: async (_universityId: string, months: number = 12) => {
    const records = await fetchEmploymentRecords();
    const now = new Date();
    const result: { month: string; count: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      const count = records.filter(r => {
        if (!r.started_at) return false;
        const rd = new Date(r.started_at);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      }).length;
      result.push({ month: label, count });
    }
    return result;
  },

  generateEmploymentReport: async (_universityId: string, _period: 'monthly' | 'quarterly' | 'annual') => {
    const [stats, records] = await Promise.all([
      universityService.getOverallStatistics(_universityId),
      fetchEmploymentRecords(),
    ]);
    return { stats, records, generatedAt: new Date().toISOString() };
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
    const sorted = [...bySpec].sort((a, b) => b.count - a.count);
    return {
      averageMatchIndex: null,
      bestMatchProgram: sorted[0]?.specialization ?? '',
      worstMatchProgram: sorted[sorted.length - 1]?.specialization ?? '',
    };
  },
};
