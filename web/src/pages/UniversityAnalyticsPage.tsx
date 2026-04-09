import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiFetch } from '../utils/apiClient';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { documentService, type Document, getTypeLabel } from '../services/documentService';

interface SpecializationCount { specialization: string; count: number; }
interface StatusCount         { status: string; count: number; }
interface SkillEntry          { name: string; count: number; }
interface JobTypeEntry        { name: string; count: number; }
interface LocationEntry       { name: string; count: number; }

interface AnalyticsSummary {
  students: {
    total: number;
    by_specialization: SpecializationCount[];
  };
  vacancies: {
    total: number;
    demanded_skills: SkillEntry[];
    by_job_type: JobTypeEntry[];
    by_location: LocationEntry[];
  };
  applications: {
    total: number;
    offered_count: number;
    by_status: StatusCount[];
  };
}

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
    pending:  { label: t('universityAnalytics.docStatus.pending'),   cls: 'bg-yellow-100 text-yellow-700' },
    verified: { label: t('universityAnalytics.docStatus.verified'), cls: 'bg-green-100 text-green-700' },
    rejected: { label: t('universityAnalytics.docStatus.rejected'),    cls: 'bg-red-100 text-red-700' },
  };
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'employers' | 'statistics' | 'my-students' | 'doc-review'>('overview');
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStudents, setMyStudents] = useState<BackendStudentProfile[]>([]);
  const [myStudentsLoading, setMyStudentsLoading] = useState(false);

  // Document review state
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

  const loadStudentDocs = async (userId: string) => {
    if (studentDocs[userId]) return; // already loaded
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
      setStudentDocs(prev => ({
        ...prev,
        [userId]: prev[userId].map(d => d.id === docId ? updated : d),
      }));
      toast.success(t('universityAnalytics.success.docVerified'));
    } catch {
      toast.error(t('universityAnalytics.errors.verifyDoc'));
    }
  };

  const handleReject = async (docId: string, userId: string) => {
    try {
      const updated = await documentService.reject(docId);
      setStudentDocs(prev => ({
        ...prev,
        [userId]: prev[userId].map(d => d.id === docId ? updated : d),
      }));
      toast.success(t('universityAnalytics.success.docRejected'));
    } catch {
      toast.error(t('universityAnalytics.errors.rejectDoc'));
    }
  };

  const employmentRate = data
    ? data.applications.total > 0
      ? Math.round((data.applications.offered_count / data.applications.total) * 100)
      : 0
    : 0;

  const overallStats = [
    { label: t('universityAnalytics.stats.studentsTotal'), value: data ? String(data.students.total) : '—', icon: '👥', color: 'text-blue-600' },
    { label: t('universityAnalytics.stats.applicationsTotal'),        value: data ? String(data.applications.total) : '—', icon: '📨', color: 'text-green-600' },
    { label: t('universityAnalytics.stats.offersReceived'),      value: data ? String(data.applications.offered_count) : '—', icon: '✅', color: 'text-purple-600' },
    { label: t('universityAnalytics.stats.activeVacancies'),   value: data ? String(data.vacancies.total) : '—', icon: '📋', color: 'text-orange-600' },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('universityAnalytics.title')}</h1>
        <p className="text-xl text-gray-600">{t('universityAnalytics.subtitle')}</p>
      </section>

      {loading && (
        <div className="text-center py-16 text-gray-500">{t('universityAnalytics.loading')}</div>
      )}
      {!loading && data && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {overallStats.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="text-4xl mb-4">{stat.icon}</div>
                <p className="text-gray-600 text-sm mb-2">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {(['overview', 'my-students', 'doc-review', 'students', 'employers', 'statistics'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'overview'    ? t('universityAnalytics.tabs.overview')         :
                   tab === 'my-students' ? t('universityAnalytics.tabs.myStudents')     :
                   tab === 'doc-review'  ? t('universityAnalytics.tabs.docReview')     :
                   tab === 'students'    ? t('universityAnalytics.tabs.students')         :
                   tab === 'employers'   ? t('universityAnalytics.tabs.employers')        : t('universityAnalytics.tabs.statistics')}
                </button>
              ))}
            </div>

            <div className="p-8">

              {/* Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Application status breakdown */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('universityAnalytics.overview.applicationStatuses')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {data.applications.by_status.map((item) => {
                          const pct = data.applications.total > 0
                            ? Math.round((item.count / data.applications.total) * 100)
                            : 0;
                          return (
                            <div key={item.status}>
                              <div className="flex justify-between mb-2">
                                <span className="text-gray-700 font-medium">
                                  {STATUS_LABELS[item.status] ?? item.status}
                                </span>
                                <span className="text-gray-900 font-semibold">{item.count}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {data.applications.by_status.length === 0 && (
                          <p className="text-gray-500">{t('universityAnalytics.overview.noApplicationData')}</p>
                        )}
                      </div>
                      <div className="bg-blue-50 rounded-lg p-6 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-5xl font-bold text-blue-600 mb-2">{employmentRate}%</p>
                          <p className="text-gray-600">{t('universityAnalytics.overview.conversionRate')}</p>
                          <p className="text-gray-400 text-sm mt-2">
                            {t('universityAnalytics.overview.offersFromApplications', { offers: data.applications.offered_count, total: data.applications.total })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vacancies by location */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('universityAnalytics.overview.vacanciesByLocation')}</h2>
                    <div className="space-y-3">
                      {data.vacancies.by_location.map((item) => {
                        const max = data.vacancies.by_location[0]?.count || 1;
                        return (
                          <div key={item.name}>
                            <div className="flex justify-between mb-1">
                              <span className="text-gray-700 font-medium">📍 {item.name}</span>
                              <span className="text-gray-900 font-semibold">{item.count}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-indigo-500 h-2 rounded-full"
                                style={{ width: `${(item.count / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {data.vacancies.by_location.length === 0 && (
                        <p className="text-gray-500">{t('universityAnalytics.overview.noVacancies')}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* My Students — filtered list for this university */}
              {activeTab === 'my-students' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {t('universityAnalytics.myStudents.title')}
                    {!myStudentsLoading && (
                      <span className="ml-3 text-lg font-normal text-gray-500">{t('universityAnalytics.myStudents.count', { count: myStudents.length })}</span>
                    )}
                  </h2>
                  {myStudentsLoading && (
                    <div className="text-center py-10 text-gray-500">{t('universityAnalytics.myStudents.loading')}</div>
                  )}
                  {!myStudentsLoading && myStudents.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                      <p>{t('universityAnalytics.myStudents.noStudents')}</p>
                      <p className="text-sm mt-2 text-gray-400">{t('universityAnalytics.myStudents.noStudentsHint')}</p>
                    </div>
                  )}
                  {!myStudentsLoading && myStudents.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.myStudents.table.student')}</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.myStudents.table.specialization')}</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.myStudents.table.gpa')}</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.myStudents.table.graduation')}</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.myStudents.table.skills')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {myStudents.map(s => (
                            <tr
                              key={s.id}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => navigate(`/candidate/${s.user_id}`)}
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm">
                                    {s.first_name.charAt(0)}
                                  </div>
                                  <span className="font-medium text-gray-900">{s.first_name} {s.last_name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-700">{s.specialization || '—'}</td>
                              <td className="px-6 py-4">
                                {s.gpa > 0 ? (
                                  <span className="font-semibold text-green-600">{s.gpa.toFixed(2)}</span>
                                ) : '—'}
                              </td>
                              <td className="px-6 py-4 text-gray-700">{s.graduation_year > 0 ? s.graduation_year : '—'}</td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {s.skills ? s.skills.split(',').slice(0, 3).map(skill => (
                                    <span key={skill.trim()} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{skill.trim()}</span>
                                  )) : '—'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Document Review */}
              {activeTab === 'doc-review' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">{t('universityAnalytics.docReview.title')}</h2>
                    <p className="text-sm text-gray-500">{t('universityAnalytics.docReview.hint')}</p>
                  </div>

                  {docStudentsLoading && <div className="text-center py-10 text-gray-500">{t('universityAnalytics.docReview.loadingStudents')}</div>}
                  {!docStudentsLoading && docStudents.length === 0 && (
                    <div className="text-center py-10 text-gray-500">{t('universityAnalytics.docReview.noStudents')}</div>
                  )}

                  {docStudents.map(s => (
                    <div key={s.user_id} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Student row */}
                      <button
                        onClick={() => toggleStudent(s.user_id)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold">
                            {s.first_name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                            <p className="text-xs text-gray-500">{s.specialization || t('universityAnalytics.docReview.specializationNotSet')}</p>
                          </div>
                        </div>
                        <span className="text-gray-400 text-lg">{expandedStudent === s.user_id ? '▲' : '▼'}</span>
                      </button>

                      {/* Documents panel */}
                      {expandedStudent === s.user_id && (
                        <div className="border-t border-gray-100 bg-gray-50 p-6">
                          {docsLoading[s.user_id] && <p className="text-gray-500 text-sm">{t('universityAnalytics.docReview.loadingDocs')}</p>}
                          {!docsLoading[s.user_id] && (studentDocs[s.user_id]?.length ?? 0) === 0 && (
                            <p className="text-gray-500 text-sm">{t('universityAnalytics.docReview.noDocs')}</p>
                          )}
                          <div className="space-y-3">
                            {(studentDocs[s.user_id] ?? []).map(doc => {
                              const cfg = DOC_STATUS[doc.status as keyof typeof DOC_STATUS] ?? { label: doc.status, cls: 'bg-gray-100 text-gray-700' };
                              return (
                                <div key={doc.id} className="flex items-center justify-between bg-white rounded-lg px-5 py-3 border border-gray-200">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{doc.type === 'cv' ? '📄' : '📜'}</span>
                                    <div>
                                      <p className="font-medium text-gray-900 text-sm">{doc.file_name}</p>
                                      <p className="text-xs text-gray-500">{getTypeLabel(doc.type)} · {(doc.file_size / 1024).toFixed(0)} KB</p>
                                      {doc.comment && <p className="text-xs text-gray-600 italic mt-0.5">«{doc.comment}»</p>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                                    <button
                                      onClick={() => documentService.download(doc.id, doc.file_name).catch(() => toast.error(t('profile.documents.downloadError')))}
                                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                    >
                                      {t('universityAnalytics.docReview.download')}
                                    </button>
                                    {doc.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => handleVerify(doc.id, s.user_id)}
                                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                                        >
                                          {t('universityAnalytics.docReview.verify')}
                                        </button>
                                        <button
                                          onClick={() => handleReject(doc.id, s.user_id)}
                                          className="px-3 py-1 border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-50"
                                        >
                                          {t('universityAnalytics.docReview.reject')}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Students */}
              {activeTab === 'students' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      {t('universityAnalytics.students.bySpecialization')}
                      <span className="ml-3 text-lg font-normal text-gray-500">
                        {t('universityAnalytics.students.totalStudents', { total: data.students.total })}
                      </span>
                    </h2>
                    {data.students.by_specialization.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p>{t('universityAnalytics.students.noSpecializations')}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.students.by_specialization.map((item) => {
                          const pct = data.students.total > 0
                            ? Math.round((item.count / data.students.total) * 100)
                            : 0;
                          return (
                            <div key={item.specialization} className="p-4 border border-gray-200 rounded-lg">
                              <div className="flex justify-between items-center mb-3">
                                <div>
                                  <h3 className="font-semibold text-gray-900">{item.specialization}</h3>
                                  <p className="text-sm text-gray-600">{t('universityAnalytics.students.studentsCount', { count: item.count })}</p>
                                </div>
                                <span className="text-2xl font-bold text-green-600">{pct}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className="bg-green-500 h-3 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Employers */}
              {activeTab === 'employers' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('universityAnalytics.employers.vacanciesByType')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {data.vacancies.by_job_type.map((item) => (
                        <div
                          key={item.name}
                          className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-6 border border-gray-200"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-semibold text-gray-900 text-lg">{item.name}</h3>
                              <p className="text-gray-600 text-sm mt-1">
                                {t('universityAnalytics.employers.percentageOfTotal', { percentage: data.vacancies.total > 0 ? Math.round((item.count / data.vacancies.total) * 100) : 0 })}
                              </p>
                            </div>
                            <span className="text-3xl font-bold text-blue-600">{item.count}</span>
                          </div>
                        </div>
                      ))}
                      {data.vacancies.by_job_type.length === 0 && (
                        <p className="text-gray-500 col-span-2">{t('universityAnalytics.overview.noVacancies')}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics */}
              {activeTab === 'statistics' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      {t('universityAnalytics.statistics.demandedSkills')}
                      <span className="ml-3 text-base font-normal text-gray-500">{t('universityAnalytics.statistics.fromVacancies')}</span>
                    </h2>
                    {data.vacancies.demanded_skills.length === 0 ? (
                      <p className="text-gray-500">{t('universityAnalytics.statistics.noSkillsData')}</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.vacancies.demanded_skills.map((skill, idx) => {
                          const max = data.vacancies.demanded_skills[0]?.count || 1;
                          return (
                            <div
                              key={skill.name}
                              className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="font-semibold text-gray-900">{skill.name}</span>
                                </div>
                                <span className="text-blue-600 font-bold">{skill.count}</span>
                              </div>
                              <div className="w-full bg-blue-100 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${(skill.count / max) * 100}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{t('universityAnalytics.statistics.mentionsInVacancies')}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Summary table */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('universityAnalytics.statistics.summary')}</h2>
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.statistics.metrics.studentsInSystem')}</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.statistics.metrics.activeVacancies')}</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.statistics.metrics.totalApplications')}</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.statistics.metrics.offersReceived')}</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.statistics.metrics.conversionRate')}</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">{t('universityAnalytics.statistics.metrics.uniqueSkills')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          <tr><td className="px-6 py-4 text-gray-700">{t('universityAnalytics.statistics.metrics.studentsInSystem')}</td><td className="px-6 py-4 text-right font-bold text-gray-900">{data.students.total}</td></tr>
                          <tr><td className="px-6 py-4 text-gray-700">{t('universityAnalytics.statistics.metrics.activeVacancies')}</td><td className="px-6 py-4 text-right font-bold text-gray-900">{data.vacancies.total}</td></tr>
                          <tr><td className="px-6 py-4 text-gray-700">{t('universityAnalytics.statistics.metrics.totalApplications')}</td><td className="px-6 py-4 text-right font-bold text-gray-900">{data.applications.total}</td></tr>
                          <tr><td className="px-6 py-4 text-gray-700">{t('universityAnalytics.statistics.metrics.offersReceived')}</td><td className="px-6 py-4 text-right font-bold text-green-600">{data.applications.offered_count}</td></tr>
                          <tr><td className="px-6 py-4 text-gray-700">{t('universityAnalytics.statistics.metrics.conversionRate')}</td><td className="px-6 py-4 text-right font-bold text-blue-600">{employmentRate}%</td></tr>
                          <tr><td className="px-6 py-4 text-gray-700">{t('universityAnalytics.statistics.metrics.uniqueSkills')}</td><td className="px-6 py-4 text-right font-bold text-gray-900">{data.vacancies.demanded_skills.length}+</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UniversityAnalyticsPage;
