// Utility functions
// Export utility functions from here

/**
 * Normalizes skills from backend (text[] array OR comma-separated string) → string[]
 */
export const parseSkills = (skills: string | string[] | null | undefined): string[] => {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.map(s => s.trim()).filter(Boolean);
  return skills.split(',').map(s => s.trim()).filter(Boolean);
};

/**
 * Converts skills array → comma-separated string for form fields
 */
export const skillsToString = (skills: string | string[] | null | undefined): string => {
  if (!skills) return '';
  if (Array.isArray(skills)) return skills.join(', ');
  return skills;
};

/**
 * Calculates skill match percentage between student skills and vacancy skills.
 * Returns 0-100. Returns 50 if vacancy has no skills, 10 if student has no skills.
 */
export const calculateSkillMatch = (
  studentSkills: string | string[] | null | undefined,
  vacancySkills: string | string[] | null | undefined,
): number => {
  const vacancy = parseSkills(vacancySkills).map(s => s.toLowerCase());
  if (vacancy.length === 0) return 50;
  const student = parseSkills(studentSkills).map(s => s.toLowerCase());
  if (student.length === 0) return 10;
  const matched = vacancy.filter(vs => student.some(ss => ss.includes(vs) || vs.includes(ss))).length;
  return Math.round((matched / vacancy.length) * 100);
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
