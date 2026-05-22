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
 * Format date to readable string
 */
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) return 'только что'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} минут назад`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} часов назад`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} дней назад`
  
  return formatDate(date)
}

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
