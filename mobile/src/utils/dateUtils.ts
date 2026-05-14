export function formatDate(
  value: string | null | undefined,
  locale = 'ru-RU',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, options);
}

export function formatTime(
  value: string | null | undefined,
  locale = 'ru-RU',
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale, options);
}
