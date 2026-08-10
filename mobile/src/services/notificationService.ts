import { apiFetch } from './api';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_id?: string;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  async getAll(): Promise<Notification[]> {
    const res = await apiFetch('/api/notifications');
    if (!res.ok) throw new Error('Не удалось загрузить уведомления');
    const data = await res.json();
    return data.notifications ?? [];
  },

  async getUnreadCount(): Promise<number> {
    try {
      const res = await apiFetch('/api/notifications/unread-count');
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count ?? 0;
    } catch {
      return 0;
    }
  },

  async markAllRead(): Promise<void> {
    await apiFetch('/api/notifications/read-all', { method: 'PUT' });
  },

  async markRead(id: string): Promise<void> {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
  },
};
