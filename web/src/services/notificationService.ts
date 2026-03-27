import { apiFetch } from '../utils/apiClient';

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

const BASE = '/api/notifications';

export const notificationService = {
  list: async (): Promise<Notification[]> => {
    const res = await apiFetch(BASE);
    const data = await res.json();
    return data.notifications ?? [];
  },

  unreadCount: async (): Promise<number> => {
    const res = await apiFetch(`${BASE}/unread-count`);
    const data = await res.json();
    return data.count ?? 0;
  },

  markRead: async (id: string): Promise<void> => {
    await apiFetch(`${BASE}/${id}/read`, { method: 'PUT' });
  },

  markAllRead: async (): Promise<void> => {
    await apiFetch(`${BASE}/read-all`, { method: 'PUT' });
  },
};
