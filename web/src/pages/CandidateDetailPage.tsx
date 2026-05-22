import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import MatchIndex from '../components/MatchIndex';
import Icon from '../components/Icon';
import { apiFetch } from '../utils/apiClient';
import { parseSkills } from '../utils';
import { applicationService } from '../services/applicationService';
import { type BackendStudentProfile } from '../services/studentService';
import { documentService, type Document, getTypeKey } from '../services/documentService';
import { interviewService, type Interview } from '../services/interviewService';

interface LocationState {
  applicationId?: string;
  matchScore?: number;
  status?: string;
  vacancyId?: string;
}

const STATUS_COLOR: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700',
  interview: 'bg-purple-100 text-purple-700',
  shortlisted: 'bg-green-100 text-green-700',
  offered: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

const CandidateDetailPage = () => {
  const { t } = useTranslation();
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

  // Interview scheduling state
  const [interview, setInterview] = useState<Interview | null>(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    date: '',
    time: '',
    location: '',
    notes: '',
  });
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);

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
        toast.error(t('candidate.loadError'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, t]);

  // Load existing interview for this application
  useEffect(() => {
    if (!state.applicationId) return;
    interviewService.getByApplication(state.applicationId)
      .then(setInterview)
      .catch(() => {/* no interview yet */});
  }, [state.applicationId]);

  const handleScheduleInterview = async () => {
    if (!state.applicationId || !id || !state.vacancyId) return;
    if (!interviewForm.date || !interviewForm.time) {
      toast.error(t('interview.validation.dateTimeRequired'));
      return;
    }
    setInterviewSubmitting(true);
    try {
      // Combine date + time into RFC3339
      const scheduledAt = new Date(`${interviewForm.date}T${interviewForm.time}:00`).toISOString();
      const created = await interviewService.schedule({
        application_id: state.applicationId,
        student_id: id,
        vacancy_id: state.vacancyId,
        scheduled_at: scheduledAt,
        location: interviewForm.location,
        notes: interviewForm.notes,
      });
      setInterview(created);
      setShowInterviewModal(false);
      toast.success(t('interview.scheduledSuccess'));
    } catch {
      toast.error(t('interview.scheduleError'));
    } finally {
      setInterviewSubmitting(false);
    }
  };

  const handleCancelInterview = async () => {
    if (!interview) return;
    try {
      await interviewService.cancel(interview.id);
      setInterview(prev => prev ? { ...prev, status: 'cancelled' } : null);
      toast.success(t('interview.cancelledSuccess'));
    } catch {
      toast.error(t('interview.cancelError'));
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!state.applicationId) return;
    setStatusUpdating(true);
    try {
      await applicationService.updateStatus(state.applicationId, newStatus);
      setCurrentStatus(newStatus);
      toast.success(t('candidate.statusUpdated'));
    } catch {
      toast.error(t('candidate.statusUpdateError'));
    } finally {
      setStatusUpdating(false);
    }
  };

  const getStatusLabel = (status: string): string => {
    const key = `candidate.status.${status}` as const;
    const translated = t(key);
    // If the key wasn't found, fall back to the raw status
    return translated !== key ? translated : status;
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">{t('candidate.loading')}</div>;
  }
  if (loadError || !student) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{t('candidate.notFound')}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">{t('common.back')}</button>
      </div>
    );
  }

  const skills = parseSkills(student.skills);
  const fullName = `${student.first_name} ${student.last_name}`.trim();

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
        {t('common.back')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold flex-shrink-0">
                  {student.first_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 break-words">{fullName}</h1>
                  {student.specialization && (
                    <p className="text-lg text-gray-600 mb-3 flex items-center gap-1.5"><Icon name="graduation-cap" size={18} className="shrink-0" />{student.specialization}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-gray-600 text-sm">
                    {student.location_city && <span className="flex items-center gap-1"><Icon name="pin" size={13} className="shrink-0" />{student.location_city}</span>}
                    {student.phone && <span className="flex items-center gap-1"><Icon name="phone" size={13} className="shrink-0" />{student.phone}</span>}
                    {student.graduation_year > 0 && (
                      <span className="flex items-center gap-1"><Icon name="graduation-cap" size={13} className="shrink-0" />{t('candidate.graduation', { year: student.graduation_year })}</span>
                    )}
                    {student.gpa > 0 && (
                      <span className="font-semibold text-green-700">GPA: {student.gpa.toFixed(2)}</span>
                    )}
                    {student.github_url && (
                      <a
                        href={student.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-900 text-white rounded-full text-xs font-medium hover:bg-gray-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                        GitHub
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {state.matchScore != null && state.matchScore > 0 && (
                <MatchIndex percentage={state.matchScore} size="lg" showLabel={false} />
              )}
            </div>
          </div>

          {/* Bio */}
          {student.bio && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{t('candidate.about')}</h2>
              <p className="text-gray-700 leading-relaxed">{student.bio}</p>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('candidate.skills')}</h2>
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('candidate.data')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {student.gpa > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">{t('candidate.gpa')}</p>
                  <p className="text-2xl font-bold text-green-600">{student.gpa.toFixed(2)}</p>
                </div>
              )}
              {student.graduation_year > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">{t('candidate.graduationYear')}</p>
                  <p className="text-2xl font-bold text-gray-900">{student.graduation_year}</p>
                </div>
              )}
              {student.specialization && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 sm:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">{t('candidate.specialization')}</p>
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
              <h3 className="font-semibold text-gray-900 mb-2">{t('candidate.applicationStatus')}</h3>

              {currentStatus && (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${STATUS_COLOR[currentStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                  {getStatusLabel(currentStatus)}
                </span>
              )}

              <button
                onClick={() => handleUpdateStatus('interview')}
                disabled={statusUpdating || currentStatus === 'interview'}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('candidate.toInterview')}
              </button>
              <button
                onClick={() => handleUpdateStatus('shortlisted')}
                disabled={statusUpdating || currentStatus === 'shortlisted'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('candidate.shortlist')}
              </button>
              <button
                onClick={() => handleUpdateStatus('offered')}
                disabled={statusUpdating || currentStatus === 'offered'}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('candidate.offer')}
              </button>
              <button
                onClick={() => handleUpdateStatus('rejected')}
                disabled={statusUpdating || currentStatus === 'rejected'}
                className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('candidate.reject')}
              </button>
            </div>
          )}

          {/* Interview Scheduling */}
          {state.applicationId && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-2">{t('interview.title')}</h3>

              {interview && interview.status === 'scheduled' ? (
                <div className="space-y-2">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-1">
                    <p className="text-sm font-semibold text-purple-800 flex items-center gap-1.5"><Icon name="calendar" size={14} />{t('interview.scheduled')}</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{t('interview.datetime')}:</span>{' '}
                      {new Date(interview.scheduled_at).toLocaleString()}
                    </p>
                    {interview.location && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{t('interview.location')}:</span>{' '}
                        {interview.location}
                      </p>
                    )}
                    {interview.notes && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{t('interview.notes')}:</span>{' '}
                        {interview.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleCancelInterview}
                    className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm"
                  >
                    {t('interview.cancel')}
                  </button>
                </div>
              ) : interview && interview.status === 'cancelled' ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 italic">{t('interview.wasCancelled')}</p>
                  <button
                    onClick={() => setShowInterviewModal(true)}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm"
                  >
                    {t('interview.reschedule')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowInterviewModal(true)}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm"
                >
                  {t('interview.schedule')}
                </button>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{t('candidate.documents')}</h3>
            {docsLoading && <p className="text-sm text-gray-500">{t('candidate.docsLoading')}</p>}
            {!docsLoading && documents.length === 0 && (
              <p className="text-sm text-gray-400">{t('candidate.noDocs')}</p>
            )}
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xl mt-0.5">
                    {doc.type === 'cv' ? <Icon name="document" size={20} /> : doc.type === 'diploma' ? <Icon name="graduation-cap" size={20} /> : <Icon name="certificate" size={20} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{(() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })()}</p>
                    <p className="text-xs text-gray-500">{t(getTypeKey(doc.type))}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {doc.type === 'diploma' ? (
                        doc.status === 'verified' ? (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <Icon name="check-circle" size={11} className="inline mr-0.5" />{t('candidate.docVerifiedByUniversity')}
                          </span>
                        ) : doc.status === 'rejected' ? (
                          <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            <Icon name="x-circle" size={11} className="inline mr-0.5" />{t('candidate.docRejected')}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                            {t('candidate.docPending')}
                          </span>
                        )
                      ) : (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <Icon name="check" size={11} className="inline mr-0.5" />{t('candidate.docUploaded')}
                        </span>
                      )}
                    </div>
                    {doc.type !== 'diploma' && (
                      <button
                        onClick={() => documentService.download(doc.id, doc.file_name).catch(() => {})}
                        className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {t('common.download')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IIN info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">{t('candidate.identification')}</h3>
            <p className="text-xs text-gray-500 mb-1">{t('candidate.iin')}</p>
            <p className="font-mono text-gray-800">{student.iin}</p>
          </div>
        </div>
      </div>
    </div>

    {/* Interview Scheduling Modal */}
    {showInterviewModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{t('interview.modalTitle')}</h2>
            <button
              onClick={() => setShowInterviewModal(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('interview.date')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={interviewForm.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setInterviewForm(f => ({ ...f, date: e.target.value }))}
              style={{ colorScheme: 'light', backgroundColor: '#ffffff' }}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('interview.time')} <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={interviewForm.time}
              onChange={e => setInterviewForm(f => ({ ...f, time: e.target.value }))}
              style={{ colorScheme: 'light', backgroundColor: '#ffffff' }}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('interview.location')}
            </label>
            <input
              type="text"
              value={interviewForm.location}
              placeholder={t('interview.locationPlaceholder')}
              onChange={e => setInterviewForm(f => ({ ...f, location: e.target.value }))}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('interview.notes')}
            </label>
            <textarea
              value={interviewForm.notes}
              placeholder={t('interview.notesPlaceholder')}
              rows={3}
              onChange={e => setInterviewForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowInterviewModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleScheduleInterview}
              disabled={interviewSubmitting}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {interviewSubmitting ? t('common.saving') : t('interview.confirm')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default CandidateDetailPage;
