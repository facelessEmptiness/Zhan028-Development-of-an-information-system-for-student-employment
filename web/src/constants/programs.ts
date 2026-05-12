export const EDUCATIONAL_PROGRAMS = [
  'Software Engineering',
  'Computer Science',
  'Big Data Analysis',
  'Mathematical and Computational Science',
  'Cybersecurity',
  'Smart Security Technologies',
  'Industrial Internet of Things',
  'Electronic Engineering',
  'Smart Technologies',
  'Digital Technologies in Nuclear Power Engineering',
  'IT Management',
  'IT Entrepreneurship',
  'AI Business',
  'Media Technologies',
  'Digital Journalism',
  'Digital Public Administration',
] as const;

export type EducationalProgram = typeof EDUCATIONAL_PROGRAMS[number];

export const PROGRAM_I18N_KEY: Record<EducationalProgram, string> = {
  'Software Engineering':                           'softwareEngineering',
  'Computer Science':                               'computerScience',
  'Big Data Analysis':                              'bigDataAnalysis',
  'Mathematical and Computational Science':         'mathComputationalScience',
  'Cybersecurity':                                  'cybersecurity',
  'Smart Security Technologies':                    'smartSecurityTechnologies',
  'Industrial Internet of Things':                  'industrialIoT',
  'Electronic Engineering':                         'electronicEngineering',
  'Smart Technologies':                             'smartTechnologies',
  'Digital Technologies in Nuclear Power Engineering': 'digitalTechNuclearPower',
  'IT Management':                                  'itManagement',
  'IT Entrepreneurship':                            'itEntrepreneurship',
  'AI Business':                                    'aiBusiness',
  'Media Technologies':                             'mediaTechnologies',
  'Digital Journalism':                             'digitalJournalism',
  'Digital Public Administration':                  'digitalPublicAdministration',
};

export const PROGRAM_SCHOOLS = [
  {
    nameKey: 'schoolSoftwareEngineering',
    programs: ['Software Engineering'] as EducationalProgram[],
  },
  {
    nameKey: 'schoolAIDataScience',
    programs: ['Computer Science', 'Big Data Analysis', 'Mathematical and Computational Science'] as EducationalProgram[],
  },
  {
    nameKey: 'schoolCybersecurity',
    programs: ['Cybersecurity', 'Smart Security Technologies'] as EducationalProgram[],
  },
  {
    nameKey: 'schoolIntelligentSystems',
    programs: ['Industrial Internet of Things', 'Electronic Engineering', 'Smart Technologies', 'Digital Technologies in Nuclear Power Engineering'] as EducationalProgram[],
  },
  {
    nameKey: 'schoolCreativeIndustries',
    programs: ['IT Management', 'IT Entrepreneurship', 'AI Business', 'Media Technologies', 'Digital Journalism'] as EducationalProgram[],
  },
  {
    nameKey: 'schoolDigitalGovernance',
    programs: ['Digital Public Administration'] as EducationalProgram[],
  },
] as const;
