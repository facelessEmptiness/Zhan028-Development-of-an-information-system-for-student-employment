import { apiFetch } from './api';

export interface ChatMessage {
  id: string;
  application_id: string;
  sender_id: string;
  sender_role: 'student' | 'employer';
  content: string;
  created_at: string;
}

export const chatService = {
  async getMessages(applicationId: string): Promise<ChatMessage[]> {
    const res = await apiFetch(`/api/chat/${applicationId}`);
    if (!res.ok) throw new Error('Не удалось загрузить сообщения');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.messages ?? []);
  },

  async sendMessage(applicationId: string, content: string): Promise<ChatMessage> {
    const res = await apiFetch(`/api/chat/${applicationId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Не удалось отправить сообщение');
    }
    return res.json();
  },
};
