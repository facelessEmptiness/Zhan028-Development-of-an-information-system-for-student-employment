// University Service - Handles all university admin operations

// Real university entity from backend
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

// University Service Functions
export const universityService = {
  // Get overall statistics
  getOverallStatistics: async (_universityId: string): Promise<UniversityStats> => {
    // TODO: Replace with actual API call
    return {
      totalStudents: 2450,
      employedGraduates: 1862,
      activeEmployers: 156,
      jobOpenings: 487,
      employmentRate: 76,
    };
  },

  // Get employment by degree program
  getEmploymentByProgram: async (_universityId: string): Promise<EmploymentByProgram[]> => {
    // TODO: Replace with actual API call
    return [
      {
        program: 'Computer Science',
        totalStudents: 98,
        employed: 95,
        employmentRate: 96.9,
      },
      {
        program: 'Business Administration',
        totalStudents: 82,
        employed: 78,
        employmentRate: 95.1,
      },
      {
        program: 'Engineering',
        totalStudents: 125,
        employed: 112,
        employmentRate: 89.6,
      },
    ];
  },

  // Get recent graduate placements
  getGraduatePlacements: async (_universityId: string, _limit: number = 10): Promise<GraduatePlacement[]> => {
    // TODO: Replace with actual API call
    return [
      {
        studentName: 'John Doe',
        major: 'Computer Science',
        employer: 'Tech Innovators Inc',
        position: 'Senior Developer',
        salary: 5500,
        startDate: '2024-02-15',
      },
    ];
  },

  // Get skill demand in labor market
  getSkillDemand: async (_universityId: string): Promise<SkillDemand[]> => {
    // TODO: Replace with actual API call
    return [
      {
        skill: 'JavaScript',
        demand: 156,
        supply: 89,
        gap: 67,
        growth: '+18%',
      },
      {
        skill: 'Python',
        demand: 142,
        supply: 76,
        gap: 66,
        growth: '+15%',
      },
    ];
  },

  // Get employment by industry
  getEmploymentByIndustry: async (_universityId: string): Promise<EmploymentByIndustry[]> => {
    // TODO: Replace with actual API call
    return [
      {
        industry: 'Technology',
        count: 345,
        percentage: 28.5,
      },
      {
        industry: 'Finance',
        count: 198,
        percentage: 16.3,
      },
    ];
  },

  // Get top hiring employers
  getTopEmployers: async (_universityId: string): Promise<TopEmployer[]> => {
    // TODO: Replace with actual API call
    return [
      {
        name: 'Tech Innovators Inc',
        hires: 45,
        openings: 8,
        rating: 4.8,
      },
      {
        name: 'Global Finance Solutions',
        hires: 38,
        openings: 6,
        rating: 4.6,
      },
    ];
  },

  // Get all students
  getAllStudents: async (_universityId: string) => {
    // TODO: Replace with actual API call
    return [];
  },

  // Get student by ID
  getStudent: async (_universityId: string, _studentId: string) => {
    // TODO: Replace with actual API call
    return {};
  },

  // Get all employers
  getAllEmployers: async (_universityId: string) => {
    // TODO: Replace with actual API call
    return [];
  },

  // Verify employer
  verifyEmployer: async (_universityId: string, employerId: string): Promise<boolean> => {
    // TODO: Replace with actual API call
    console.log('Verifying employer:', employerId);
    return true;
  },

  // Get employment trends
  getEmploymentTrends: async (_universityId: string, _months: number = 12) => {
    // TODO: Replace with actual API call
    return [];
  },

  // Export reports
  generateEmploymentReport: async (_universityId: string, period: 'monthly' | 'quarterly' | 'annual') => {
    // TODO: Replace with actual API call
    console.log('Generating employment report for period:', period);
    return {};
  },

  // Get curriculum recommendations based on skill gap
  getCurriculumRecommendations: async (_universityId: string) => {
    // TODO: Replace with actual API call
    // Based on skill gap analysis, recommend curriculum changes
    return [
      {
        skill: 'AI/Machine Learning',
        gap: 61,
        recommendation: 'Add AI/ML course to Computer Science curriculum',
      },
    ];
  },

  // Calculate Match-Index aggregates for analysis
  getMatchIndexStatistics: async (_universityId: string) => {
    // TODO: Replace with actual API call
    return {
      averageMatchIndex: 72.5,
      bestMatchProgram: 'Computer Science',
      worstMatchProgram: 'Liberal Arts',
    };
  },
};
