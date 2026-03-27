import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import MatchIndex from '../components/MatchIndex';
import { apiFetch } from '../utils/apiClient';
import { applicationService } from '../services/applicationService';
import { type BackendStudentProfile } from '../services/studentService';
import { documentService, type Document, getTypeLabel } from '../services/documentService';

interface LocationState {
  applicationId?: string;
  matchScore?: number;
  status?: string;
  vacancyId?: string;
}

const STATUS_LABEL: Record<string, string> = {
  applied: 'Подана',
  interview: 'Собеседование',
  shortlisted: 'В шортлисте',
  offered: 'Оффер',
  rejected: 'Отклонена',
};

const STATUS_COLOR: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700',
  interview: 'bg-purple-100 text-purple-700',
  shortlisted: 'bg-green-100 text-green-700',
  offered: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

const CandidateDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [student, setStudent] = useState<BackendStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [currentStatus, setCurrentStatus] = useState(state.status ?? '');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/students/${id}`);
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        const data = await res.json();
        setStudent(data);
        // Load documents for this student (uses user_id from the student profile)
        setDocsLoading(true);
        documentService.listByStudent(data.user_id)
          .then(setDocuments)
          .catch(() => {/* documents are optional, don't toast */})
          .finally(() => setDocsLoading(false));
      } catch {
        setLoadError(true);
        toast.error('Не удалось загрузить профиль кандидата');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!state.applicationId) return;
    setStatusUpdating(true);
    try {
      await applicationService.updateStatus(state.applicationId, newStatus);
      setCurrentStatus(newStatus);
      toast.success('Статус обновлён');
    } catch {
      toast.error('Не удалось обновить статус');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Загрузка профиля...</div>;
  }
  if (loadError || !student) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">Кандидат не найден</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">← Назад</button>
      </div>
    );
  }

  const skills = student.skills ? student.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
  const fullName = `${student.first_name} ${student.last_name}`.trim();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
        ← Назад
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
                  {student.first_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">{fullName}</h1>
                  {student.specialization && (
                    <p className="text-lg text-gray-600 mb-3">🎓 {student.specialization}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-gray-600 text-sm">
                    {student.location_city && <span>📍 {student.location_city}</span>}
                    {student.phone && <span>📱 {student.phone}</span>}
                    {student.graduation_year > 0 && <span>🎓 Выпуск {student.graduation_year}</span>}
                    {student.gpa > 0 && (
                      <span className="font-semibold text-green-700">GPA: {student.gpa.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
              {state.matchScore != null && state.matchScore > 0 && (
                <MatchIndex percentage={state.matchScore} size="lg" />
              )}
            </div>
          </div>

          {/* Bio */}
          {student.bio && (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">О себе</h2>
              <p className="text-gray-700 leading-relaxed">{student.bio}</p>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Навыки</h2>
              <div className="flex flex-wrap gap-3">
                {skills.map((skill) => (
                  <span key={skill} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details table */}
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {student.gpa > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">GPA</p>
                  <p className="text-2xl font-bold text-green-600">{student.gpa.toFixed(2)}</p>
                </div>
              )}
              {student.graduation_year > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Год выпуска</p>
                  <p className="text-2xl font-bold text-gray-900">{student.graduation_year}</p>
                </div>
              )}
              {student.specialization && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 sm:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Специализация</p>
                  <p className="font-semibold text-gray-900">{student.specialization}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Status & Actions */}
          {state.applicationId && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-2">Статус заявки</h3>

              {currentStatus && (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${STATUS_COLOR[currentStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABEL[currentStatus] ?? currentStatus}
                </span>
              )}

              <button
                onClick={() => handleUpdateStatus('interview')}
                disabled={statusUpdating || currentStatus === 'interview'}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                На собеседование
              </button>
              <button
                onClick={() => handleUpdateStatus('shortlisted')}
                disabled={statusUpdating || currentStatus === 'shortlisted'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                В шортлист
              </button>
              <button
                onClick={() => handleUpdateStatus('offered')}
                disabled={statusUpdating || currentStatus === 'offered'}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Выдать оффер
              </button>
              <button
                onClick={() => handleUpdateStatus('rejected')}
                disabled={statusUpdating || currentStatus === 'rejected'}
                className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Отклонить
              </button>
            </div>
          )}

          {/* Documents */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Документы</h3>
            {docsLoading && <p className="text-sm text-gray-500">Загрузка...</p>}
            {!docsLoading && documents.length === 0 && (
              <p className="text-sm text-gray-400">Документов нет</p>
            )}
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xl mt-0.5">
                    {doc.type === 'cv' ? '📄' : doc.type === 'diploma' ? '🎓' : '📜'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-500">{getTypeLabel(doc.type)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {doc.status === 'verified' ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          ✅ Verified by University
                        </span>
                      ) : doc.status === 'rejected' ? (
                        <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                          ❌ Отклонён
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                          На проверке
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => documentService.download(doc.id, doc.file_name).catch(() => {})}
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Скачать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IIN info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Идентификация</h3>
            <p className="text-xs text-gray-500 mb-1">ИИН</p>
            <p className="font-mono text-gray-800">{student.iin}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetailPage;
