
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiFetch } from '../utils/apiClient';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { documentService, type Document, getTypeLabel } from '../services/documentService';
import { employmentService, type EmploymentRecord } from '../services/employmentService';

interface SpecializationCount { specialization: string; count: number; }
interface StatusCount         { status: string; count: number; }
interface SkillEntry          { name: string; count: number; }
interface JobTypeEntry        { name: string; count: number; }
interface LocationEntry       { name: string; count: number; }

interface AnalyticsSummary {
  students: { total: number; by_specialization: SpecializationCount[] };
  vacancies: { total: number; demanded_skills: SkillEntry[]; by_job_type: JobTypeEntry[]; by_location: LocationEntry[] };
  applications: { total: number; offered_count: number; by_status: StatusCount[] };
}

const toneMap: Record<string, { bg: string; fg: string }> = {
  blue:   { bg: '#EFF6FF', fg: '#2563EB' },
  indigo: { bg: '#EEF2FF', fg: '#4F46E5' },
  green:  { bg: '#ECFDF5', fg: '#047857' },
  purple: { bg: '#F5F3FF', fg: '#7C3AED' },
};

const UniversityAnalyticsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const STATUS_LABELS: Record<string, string> = {
    applied:     t('universityAnalytics.status.applied'),
    interview:   t('universityAnalytics.status.interview'),
    shortlisted: t('universityAnalytics.status.shortlisted'),
    offered:     t('universityAnalytics.status.offered'),
    rejected:    t('universityAnalytics.status.rejected'),
  };

  const DOC_STATUS = {
    pending:  { label: t('universityAnalytics.docStatus.pending'),  cls: 'bg-yellow-50 text-yellow-700' },
    verified: { label: t('universityAnalytics.docStatus.verified'), cls: 'bg-green-50 text-green-700' },
    rejected: { label: t('universityAnalytics.docStatus.rejected'), cls: 'bg-red-50 text-red-700' },
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'employers' | 'statistics' | 'my-students' | 'doc-review' | 'employment'>('overview');
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStudents, setMyStudents] = useState<BackendStudentProfile[]>([]);
  const [myStudentsLoading, setMyStudentsLoading] = useState(false);
  const [employmentRecords, setEmploymentRecords] = useState<EmploymentRecord[]>([]);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentDocs, setStudentDocs] = useState<Record<string, Document[]>>({});
  const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});
  const [docStudents, setDocStudents] = useState<BackendStudentProfile[]>([]);
  const [docStudentsLoading, setDocStudentsLoading] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/analytics/summary');
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch {
        toast.error(t('universityAnalytics.errors.loadAnalytics'));
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (activeTab !== 'my-students') return;
    setMyStudentsLoading(true);
    studentService.listByUniversity()
      .then(res => setMyStudents(res.students ?? []))
      .catch(() => toast.error(t('universityAnalytics.errors.loadStudents')))
      .finally(() => setMyStudentsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'doc-review') return;
    setDocStudentsLoading(true);
    studentService.listByUniversity()
      .then(res => setDocStudents(res.students ?? []))
      .catch(() => toast.error(t('universityAnalytics.errors.loadStudents')))
      .finally(() => setDocStudentsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'employment') return;
    setEmploymentLoading(true);
    employmentService.getAllRecords()
      .then(recs => setEmploymentRecords(recs))
      .catch(() => toast.error(t('employment.errors.loadRecords')))
      .finally(() => setEmploymentLoading(false));
  }, [activeTab]);

  const handleEndEmployment = async (id: string) => {
    if (!window.confirm(t('employment.endConfirm'))) return;
    try {
      await employmentService.endEmployment(id);
      setEmploymentRecords(prev =>
        prev.map(r => r.id === id ? { ...r, status: 'terminated_early' as const, ended_at: new Date().toISOString() } : r)
      );
      toast.success(t('employment.endSuccess'));
    } catch {
      toast.error(t('employment.endError'));
    }
  };

  const loadStudentDocs = async (userId: string) => {
    if (studentDocs[userId]) return;
    setDocsLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const docs = await documentService.listByStudent(userId);
      setStudentDocs(prev => ({ ...prev, [userId]: docs }));
    } catch {
      toast.error(t('universityAnalytics.errors.loadStudentDocs'));
    } finally {
      setDocsLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const toggleStudent = (userId: string) => {
    if (expandedStudent === userId) {
      setExpandedStudent(null);
    } else {
      setExpandedStudent(userId);
      loadStudentDocs(userId);
    }
  };

  const handleVerify = async (docId: string, userId: string) => {
    try {
      const updated = await documentService.verify(docId);
      setStudentDocs(prev => ({ ...prev, [userId]: prev[userId].map(d => d.id === docId ? updated : d) }));
      toast.success(t('universityAnalytics.success.docVerified'));
    } catch {
      toast.error(t('universityAnalytics.errors.verifyDoc'));
    }
  };

  const handleReject = async (docId: string, userId: string) => {
    try {
      const updated = await documentService.reject(docId);
      setStudentDocs(prev => ({ ...prev, [userId]: prev[userId].map(d => d.id === docId ? updated : d) }));
      toast.success(t('universityAnalytics.success.docRejected'));
    } catch {
      toast.error(t('universityAnalytics.errors.rejectDoc'));
    }
  };

  const handleAutoVerify = async (userId: string) => {
    try {
      const result = await documentService.autoVerify(userId);
      if (result.verified_count === 0) { toast.info(t('universityAnalytics.autoVerify.noPending')); return; }
      setStudentDocs(prev => ({
        ...prev,
        [userId]: (prev[userId] ?? []).map(d =>
          d.status === 'pending' && d.type !== 'cv' ? { ...d, status: 'verified' as const } : d
        ),
      }));
      toast.success(t('universityAnalytics.autoVerify.success', { count: result.verified_count }));
    } catch {
      toast.error(t('universityAnalytics.autoVerify.error'));
    }
  };

  const employmentRate = data && data.applications.total > 0
    ? Math.round((data.applications.offered_count / data.applications.total) * 100)
    : 0;

  const statCards = data ? [
    { label: t('universityAnalytics.stats.studentsTotal'),      value: String(data.students.total),              tone: 'blue',
      icon: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
    { label: t('universityAnalytics.stats.applicationsTotal'),  value: String(data.applications.total),          tone: 'indigo',
      icon: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    { label: t('universityAnalytics.stats.offersReceived'),     value: String(data.applications.offered_count),  tone: 'green',
      icon: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /> },
    { label: t('universityAnalytics.stats.activeVacancies'),    value: String(data.vacancies.total),             tone: 'purple',
      icon: <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
  ] : [];

  const tabs = [
    { key: 'overview' as const,     label: t('universityAnalytics.tabs.overview') },
    { key: 'my-students' as const,  label: t('universityAnalytics.tabs.myStudents'),  badge: !myStudentsLoading && myStudents.length > 0 ? myStudents.length : undefined },
    { key: 'doc-review' as const,   label: t('universityAnalytics.tabs.docReview'),   badge: !docStudentsLoading && docStudents.length > 0 ? docStudents.length : undefined },
    { key: 'employment' as const,   label: t('universityAnalytics.tabs.employment') },
    { key: 'students' as const,     label: t('universityAnalytics.tabs.students') },
    { key: 'employers' as const,    label: t('universityAnalytics.tabs.employers') },
    { key: 'statistics' as const,   label: t('universityAnalytics.tabs.statistics') },
  ];

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('universityAnalytics.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('universityAnalytics.subtitle')}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400">
          {t('universityAnalytics.loading')}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s, i) => {
              const tone = toneMap[s.tone];
              return (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: tone.bg }}>
                      <svg className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: tone.fg }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        {s.icon}
                      </svg>
                    </div>
                    <span className="text-xs text-gray-500 font-medium leading-tight">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                </div>
              );
            })}
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-5">{t('universityAnalytics.overview.applicationStatuses')}</h2>
                <div className="space-y-3">
                  {data.applications.by_status.map(item => {
                    const pct = data.applications.total > 0 ? Math.round((item.count / data.applications.total) * 100) : 0;
                    return (
                      <div key={item.status}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-700 font-medium">{STATUS_LABELS[item.status] ?? item.status}</span>
                          <span className="text-gray-900 font-semibold">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.applications.by_status.length === 0 && (
                    <p className="text-gray-400 text-sm">{t('universityAnalytics.overview.noApplicationData')}</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center">
                <div className="w-28 h-28 rounded-full border-8 border-blue-100 flex items-center justify-center mb-4">
                  <p className="text-3xl font-bold text-blue-600">{employmentRate}%</p>
                </div>
                <p className="font-semibold text-gray-900 text-center">{t('universityAnalytics.overview.conversionRate')}</p>
                <p className="text-xs text-gray-400 text-center mt-1">
                  {t('universityAnalytics.overview.offersFromApplications', { offers: data.applications.offered_count, total: data.applications.total })}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:col-span-2">
                <h2 className="text-base font-semibold text-gray-900 mb-5">{t('universityAnalytics.overview.vacanciesByLocation')}</h2>
                <div className="space-y-3">
                  {data.vacancies.by_location.map(item => {
                    const max = data.vacancies.by_location[0]?.count || 1;
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-700 font-medium">📍 {item.name}</span>
                          <span className="text-gray-900 font-semibold">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.vacancies.by_location.length === 0 && (
                    <p className="text-gray-400 text-sm">{t('universityAnalytics.overview.noVacancies')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── My Students ── */}
          {activeTab === 'my-students' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{t('universityAnalytics.myStudents.title')}</h2>
                {!myStudentsLoading && (
                  <span className="text-sm text-gray-400">{t('universityAnalytics.myStudents.count', { count: myStudents.length })}</span>
                )}
              </div>
              {myStudentsLoading && <div className="p-10 text-center text-gray-400">{t('universityAnalytics.myStudents.loading')}</div>}
              {!myStudentsLoading && myStudents.length === 0 && (
                <div className="p-10 text-center text-gray-400">
                  <p>{t('universityAnalytics.myStudents.noStudents')}</p>
                  <p className="text-sm mt-1">{t('universityAnalytics.myStudents.noStudentsHint')}</p>
                </div>
              )}
              {!myStudentsLoading && myStudents.length > 0 && (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.myStudents.table.student')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.myStudents.table.specialization')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.myStudents.table.gpa')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.myStudents.table.graduation')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.myStudents.table.skills')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myStudents.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/candidate/${s.user_id}`)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                              {s.first_name.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900 text-sm">{s.first_name} {s.last_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{s.specialization || '—'}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-green-600">{s.gpa > 0 ? s.gpa.toFixed(2) : '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{s.graduation_year > 0 ? s.graduation_year : '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {s.skills
                              ? s.skills.split(',').slice(0, 3).map(skill => (
                                  <span key={skill.trim()} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{skill.trim()}</span>
                                ))
                              : <span className="text-gray-400 text-xs">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Document Review ── */}
          {activeTab === 'doc-review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-900">{t('universityAnalytics.docReview.title')}</h2>
                <p className="text-xs text-gray-400">{t('universityAnalytics.docReview.hint')}</p>
              </div>

              {docStudentsLoading && (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">{t('universityAnalytics.docReview.loadingStudents')}</div>
              )}
              {!docStudentsLoading && docStudents.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">{t('universityAnalytics.docReview.noStudents')}</div>
              )}

              {docStudents.map(s => (
                <div key={s.user_id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4">
                    <button onClick={() => toggleStudent(s.user_id)} className="flex items-center gap-3 flex-1 text-left">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                        {s.first_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-gray-400">{s.specialization || t('universityAnalytics.docReview.specializationNotSet')}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAutoVerify(s.user_id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('universityAnalytics.autoVerify.button')}
                      </button>
                      <button onClick={() => toggleStudent(s.user_id)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          {expandedStudent === s.user_id
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expandedStudent === s.user_id && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
                      {docsLoading[s.user_id] && <p className="text-gray-400 text-sm text-center py-4">{t('universityAnalytics.docReview.loadingDocs')}</p>}
                      {!docsLoading[s.user_id] && (studentDocs[s.user_id]?.length ?? 0) === 0 && (
                        <p className="text-gray-400 text-sm text-center py-4">{t('universityAnalytics.docReview.noDocs')}</p>
                      )}
                      {(studentDocs[s.user_id] ?? []).map(doc => {
                        const cfg = DOC_STATUS[doc.status as keyof typeof DOC_STATUS] ?? { label: doc.status, cls: 'bg-gray-100 text-gray-700' };
                        return (
                          <div key={doc.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                                <span className="text-red-500 font-bold text-[10px]">PDF</span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{doc.file_name}</p>
                                <p className="text-xs text-gray-400">{getTypeLabel(doc.type)} · {(doc.file_size / 1024).toFixed(0)} KB</p>
                                {doc.comment && <p className="text-xs text-gray-500 italic mt-0.5">«{doc.comment}»</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                              <button
                                onClick={() => documentService.download(doc.id, doc.file_name).catch(() => toast.error(t('profile.documents.downloadError')))}
                                className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                              >
                                {t('universityAnalytics.docReview.download')}
                              </button>
                              {doc.status === 'pending' && (
                                <>
                                  <button onClick={() => handleVerify(doc.id, s.user_id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                                    {t('universityAnalytics.docReview.verify')}
                                  </button>
                                  <button onClick={() => handleReject(doc.id, s.user_id)} className="px-3 py-1 border border-red-200 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50">
                                    {t('universityAnalytics.docReview.reject')}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Employment Monitoring ── */}
          {activeTab === 'employment' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">{t('employment.title')}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('employment.subtitle')}</p>
              </div>
              {employmentLoading && <div className="p-10 text-center text-gray-400">{t('employment.loading')}</div>}
              {!employmentLoading && employmentRecords.length === 0 && (
                <div className="p-16 text-center">
                  <p className="font-medium text-gray-500">{t('employment.noRecords')}</p>
                  <p className="text-sm text-gray-400 mt-1">{t('employment.noRecordsHint')}</p>
                </div>
              )}
              {!employmentLoading && employmentRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.company')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.position')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.startDate')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.daysWorked')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.progress')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.status')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employmentRecords.map(rec => {
                        const statusColors: Record<string, string> = {
                          active: 'bg-green-50 text-green-700',
                          completed: 'bg-blue-50 text-blue-700',
                          terminated_early: 'bg-red-50 text-red-700',
                        };
                        const statusCls = statusColors[rec.status] ?? 'bg-gray-100 text-gray-600';
                        const startDate = new Date(rec.started_at).toLocaleDateString('ru-RU');
                        return (
                          <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-4 font-medium text-gray-900 text-sm">{rec.company_name || '—'}</td>
                            <td className="px-5 py-4 text-gray-600 text-sm">{rec.job_title || '—'}</td>
                            <td className="px-5 py-4 text-gray-500 text-sm">{startDate}</td>
                            <td className="px-5 py-4 text-gray-700 font-semibold text-sm">{rec.days_worked}</td>
                            <td className="px-5 py-4 min-w-[160px]">
                              {rec.grant_fulfilled ? (
                                <span className="text-green-600 font-semibold text-sm">{t('employment.grantFulfilled')}</span>
                              ) : (
                                <div>
                                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>{rec.progress}%</span>
                                    <span>{t('employment.remaining', { days: rec.remaining_days })}</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${rec.progress}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCls}`}>
                                {t(`employment.status.${rec.status}` as const, rec.status)}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {rec.status === 'active' && (
                                <button onClick={() => handleEndEmployment(rec.id)} className="px-3 py-1 border border-red-200 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50">
                                  {t('employment.endEmployment')}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Students by Specialization ── */}
          {activeTab === 'students' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-5">
                {t('universityAnalytics.students.bySpecialization')}
                <span className="ml-2 text-sm font-normal text-gray-400">{t('universityAnalytics.students.totalStudents', { total: data.students.total })}</span>
              </h2>
              {data.students.by_specialization.length === 0 ? (
                <p className="text-center py-10 text-gray-400">{t('universityAnalytics.students.noSpecializations')}</p>
              ) : (
                <div className="space-y-3">
                  {data.students.by_specialization.map(item => {
                    const pct = data.students.total > 0 ? Math.round((item.count / data.students.total) * 100) : 0;
                    return (
                      <div key={item.specialization} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{item.specialization}</h3>
                            <p className="text-xs text-gray-500">{t('universityAnalytics.students.studentsCount', { count: item.count })}</p>
                          </div>
                          <span className="text-lg font-bold text-green-600">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Employers / Vacancy types ── */}
          {activeTab === 'employers' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-5">{t('universityAnalytics.employers.vacanciesByType')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.vacancies.by_job_type.map(item => (
                  <div key={item.name} className="p-5 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t('universityAnalytics.employers.percentageOfTotal', { percentage: data.vacancies.total > 0 ? Math.round((item.count / data.vacancies.total) * 100) : 0 })}
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">{item.count}</span>
                  </div>
                ))}
                {data.vacancies.by_job_type.length === 0 && (
                  <p className="text-gray-400 text-sm col-span-2 py-4 text-center">{t('universityAnalytics.overview.noVacancies')}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Statistics ── */}
          {activeTab === 'statistics' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-5">
                  {t('universityAnalytics.statistics.demandedSkills')}
                  <span className="ml-2 text-sm font-normal text-gray-400">{t('universityAnalytics.statistics.fromVacancies')}</span>
                </h2>
                {data.vacancies.demanded_skills.length === 0 ? (
                  <p className="text-gray-400 text-sm">{t('universityAnalytics.statistics.noSkillsData')}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.vacancies.demanded_skills.map((skill, idx) => {
                      const max = data.vacancies.demanded_skills[0]?.count || 1;
                      return (
                        <div key={skill.name} className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                              <span className="font-semibold text-gray-900 text-sm">{skill.name}</span>
                            </div>
                            <span className="text-blue-600 font-bold text-sm">{skill.count}</span>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-1.5">
                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${(skill.count / max) * 100}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{t('universityAnalytics.statistics.mentionsInVacancies')}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">{t('universityAnalytics.statistics.summary')}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: t('universityAnalytics.statistics.metrics.studentsInSystem'), value: data.students.total,                       cls: 'text-gray-900' },
                    { label: t('universityAnalytics.statistics.metrics.activeVacancies'),  value: data.vacancies.total,                       cls: 'text-gray-900' },
                    { label: t('universityAnalytics.statistics.metrics.totalApplications'),value: data.applications.total,                    cls: 'text-gray-900' },
                    { label: t('universityAnalytics.statistics.metrics.offersReceived'),   value: data.applications.offered_count,            cls: 'text-green-600' },
                    { label: t('universityAnalytics.statistics.metrics.conversionRate'),   value: `${employmentRate}%`,                       cls: 'text-blue-600' },
                    { label: t('universityAnalytics.statistics.metrics.uniqueSkills'),     value: `${data.vacancies.demanded_skills.length}+`, cls: 'text-gray-900' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-6 py-4">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`text-sm font-bold ${row.cls}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UniversityAnalyticsPage;
