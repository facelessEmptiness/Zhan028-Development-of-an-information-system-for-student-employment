import { apiFetch } from '../utils/apiClient';

export interface ChatMessage {
  id: string;
  application_id: string;
  sender_id: string;
  sender_role: 'student' | 'employer';
  content: string;
  created_at: string;
}

export const chatService = {
  getMessages: async (applicationId: string): Promise<ChatMessage[]> => {
    const res = await apiFetch(`/api/chat/${applicationId}`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    return data.messages ?? [];
  },

  sendMessage: async (applicationId: string, content: string): Promise<ChatMessage> => {
    const res = await apiFetch(`/api/chat/${applicationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },
};
