import { apiFetch } from '../utils/apiClient';

const BASE = '/api/documents';

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
  verified_by?: string;
  verified_at?: string;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export const getTypeKey = (type: string) =>
  `docTypes.${type}`;

export const documentService = {
  /** Student: upload a document */
  upload: async (file: File, type: DocumentType): Promise<Document> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await apiFetch(`${BASE}/upload`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? `Ошибка ${res.status}`);
    }
    return res.json();
  },

  /** Student: list own documents */
  listMy: async (): Promise<Document[]> => {
    const res = await apiFetch(`${BASE}/my`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    return data.documents ?? [];
  },

  /** University / employer: list documents of a specific student */
  listByStudent: async (userId: string): Promise<Document[]> => {
    const res = await apiFetch(`${BASE}/student/${userId}`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    return data.documents ?? [];
  },

  /** Download a file — fetches with Authorization header, triggers browser save dialog */
  download: async (id: string, fileName: string): Promise<void> => {
    const res = await apiFetch(`${BASE}/${id}/download`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** University: verify a document */
  verify: async (id: string, comment?: string): Promise<Document> => {
    const res = await apiFetch(`${BASE}/${id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment ?? '' }),
    });
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  /** University: reject a document */
  reject: async (id: string, comment?: string): Promise<Document> => {
    const res = await apiFetch(`${BASE}/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment ?? '' }),
    });
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  /** University: auto-verify all pending non-CV documents for a student */
  autoVerify: async (userId: string): Promise<{ verified_count: number; documents: Document[] }> => {
    const res = await apiFetch(`${BASE}/auto-verify/${userId}`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  },

  /** University: count pending diploma docs for all university students */
  pendingCount: async (): Promise<number> => {
    const res = await apiFetch(`${BASE}/pending-count`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  },

  /** Student: delete own document */
  delete: async (id: string): Promise<void> => {
    const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  },
};
