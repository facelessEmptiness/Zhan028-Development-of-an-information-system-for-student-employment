import * as SecureStore from 'expo-secure-store';
import { API_BASE, apiFetch } from './api';

export type DocumentType = 'cv' | 'diploma' | 'certificate';
export type DocumentStatus = 'pending' | 'verified' | 'rejected';

export interface Document {
  id: string;
  user_id: string;
  type: DocumentType;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: DocumentStatus;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  cv:          'Резюме (CV)',
  diploma:     'Справка',
  certificate: 'Сертификат',
};

export const documentService = {
  async getMyDocuments(): Promise<Document[]> {
    const res = await apiFetch('/api/documents/my');
    if (!res.ok) throw new Error('Не удалось загрузить документы');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.documents ?? []);
  },

  async getStudentDocuments(userId: string): Promise<Document[]> {
    const res = await apiFetch(`/api/documents/student/${userId}`);
    if (!res.ok) throw new Error('Не удалось загрузить документы');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.documents ?? []);
  },

  async uploadDocument(
    fileUri: string,
    fileName: string,
    mimeType: string,
    docType: DocumentType,
  ): Promise<Document> {
    const token = await SecureStore.getItemAsync('access_token');
    const formData = new FormData();
    formData.append('file', { uri: fileUri, name: fileName, type: mimeType } as any);
    formData.append('type', docType);

    const res = await fetch(`${API_BASE}/api/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Ошибка загрузки файла');
    }
    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Не удалось удалить документ');
  },

  async verifyDocument(id: string): Promise<void> {
    const res = await apiFetch(`/api/documents/${id}/verify`, { method: 'PUT' });
    if (!res.ok) throw new Error('Не удалось верифицировать документ');
  },

  async rejectDocument(id: string, reason: string): Promise<void> {
    const res = await apiFetch(`/api/documents/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Не удалось отклонить документ');
  },

  getDownloadUrl(id: string): string {
    return `${API_BASE}/api/documents/${id}/download`;
  },
};
