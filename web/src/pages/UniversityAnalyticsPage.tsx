
import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Icon from '../components/Icon';
import { apiFetch } from '../utils/apiClient';
import { parseSkills } from '../utils';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { EDUCATIONAL_PROGRAMS, PROGRAM_I18N_KEY, type EducationalProgram } from '../constants/programs';
import { documentService, type Document, getTypeKey } from '../services/documentService';
import { employmentService, type EmploymentRecord } from '../services/employmentService';
import { complianceService, type ComplianceRecord } from '../services/complianceService';
import CompliancePanel from '../components/CompliancePanel';

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

// ── CSS conic-gradient donut chart — no external deps ──
const DonutChart = ({ data, size = 156, totalLabel = 'total' }: { data: { label: string; value: number; color: string }[]; size?: number; totalLabel?: string }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 shrink-0"
      style={{ width: size, height: size }}>—</div>
  );
  let acc = 0;
  const gradient = data
    .filter(d => d.value > 0)
    .map(d => {
      const pct = (d.value / total) * 100;
      const slice = `${d.color} ${acc.toFixed(2)}% ${(acc + pct).toFixed(2)}%`;
      acc += pct;
      return slice;
    })
    .join(', ');
  const inner = size * 0.55;
  const off = (size - inner) / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: `conic-gradient(${gradient})` }} />
      <div className="absolute flex flex-col items-center justify-center"
        style={{ top: off, left: off, width: inner, height: inner, borderRadius: '50%', background: 'white' }}>
        <span className="text-lg font-bold text-gray-900 leading-none">{total}</span>
        <span className="text-[10px] text-gray-400 mt-0.5">{totalLabel}</span>
      </div>
    </div>
  );
};

const STATUS_COLORS: Record<string, string> = {
  applied:     '#3B82F6',
  interview:   '#8B5CF6',
  shortlisted: '#F59E0B',
  offered:     '#10B981',
  rejected:    '#EF4444',
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

  const [activeTab, setActiveTab] = useState<'overview' | 'employers' | 'statistics' | 'employment' | 'programs' | 'compliance'>('overview');
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStudents, setMyStudents] = useState<BackendStudentProfile[]>([]);
  const [myStudentsLoading, setMyStudentsLoading] = useState(false);
  const [employmentRecords, setEmploymentRecords] = useState<EmploymentRecord[]>([]);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [studentDetailsMap, setStudentDetailsMap] = useState<Record<string, BackendStudentProfile>>({});
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [studentDocs, setStudentDocs] = useState<Record<string, Document[]>>({});
  const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});
  const [programSearch, setProgramSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [pendingDocsCount, setPendingDocsCount] = useState(0);
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollingIds, setEnrollingIds] = useState<Set<string>>(new Set());

  // ── Rejection reason modal state ──
  const [rejectModal, setRejectModal] = useState<{ docId: string; userId: string } | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  // ── Load analytics summary on mount ──
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/analytics/summary');
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        setData(await res.json());
      } catch {
        toast.error(t('universityAnalytics.errors.loadAnalytics'));
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  // ── Eagerly load students + employment records + pending count on mount ──
  // (feeds real employment rate in overview; avoids waiting for specific tabs)
  useEffect(() => {
    Promise.all([
      studentService.listByUniversity().then(r => r.students ?? []),
      employmentService.getAllRecords().catch(() => [] as EmploymentRecord[]),
      documentService.pendingCount().catch(() => 0),
      complianceService.getForUniversity().catch(() => [] as ComplianceRecord[]),
    ]).then(([students, records, count, compliance]) => {
      setMyStudents(students);
      setEmploymentRecords(records);
      setPendingDocsCount(count);
      setComplianceRecords(compliance);
    }).catch(() => {});
  }, []);

  // Programs tab: ensure students + employment loaded (no-op if already loaded)
  useEffect(() => {
    if (activeTab !== 'programs') return;
    const needStudents = myStudents.length === 0;
    const needRecords  = employmentRecords.length === 0;
    if (!needStudents && !needRecords) return;
    setMyStudentsLoading(true);
    Promise.all([
      needStudents ? studentService.listByUniversity().then(r => r.students ?? []) : Promise.resolve(myStudents),
      needRecords  ? employmentService.getAllRecords().catch(() => [] as EmploymentRecord[]) : Promise.resolve(employmentRecords),
    ]).then(([students, records]) => {
      if (needStudents) setMyStudents(students);
      if (needRecords)  setEmploymentRecords(records);
    }).catch(() => toast.error(t('universityAnalytics.errors.loadStudents')))
      .finally(() => setMyStudentsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'employment') return;
    setEmploymentLoading(true);
    Promise.all([
      employmentRecords.length > 0 ? Promise.resolve(employmentRecords) : employmentService.getAllRecords(),
      myStudents.length === 0 ? studentService.listByUniversity().then(r => r.students ?? []) : Promise.resolve(myStudents),
    ]).then(([recs, students]) => {
      setEmploymentRecords(recs);
      const knownStudents = myStudents.length > 0 ? myStudents : students;
      if (myStudents.length === 0) setMyStudents(students);
      const knownIds = new Set(knownStudents.map(s => s.user_id));
      const missingIds = [...new Set(recs.map(r => r.student_id))].filter(id => !knownIds.has(id));
      missingIds.forEach(id => {
        studentService.getById(id)
          .then(profile => setStudentDetailsMap(prev => ({ ...prev, [id]: profile })))
          .catch(() => {});
      });
    }).catch(() => toast.error(t('employment.errors.loadRecords')))
      .finally(() => setEmploymentLoading(false));
  }, [activeTab]);

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
    if (expandedStudent === userId) { setExpandedStudent(null); return; }
    setExpandedStudent(userId);
    loadStudentDocs(userId);
  };

  const handleVerify = async (docId: string, userId: string) => {
    try {
      const updated = await documentService.verify(docId);
      setStudentDocs(prev => ({ ...prev, [userId]: prev[userId].map(d => d.id === docId ? updated : d) }));
      // Decrement pending count
      setPendingDocsCount(prev => Math.max(0, prev - 1));
      toast.success(t('universityAnalytics.success.docVerified'));
    } catch { toast.error(t('universityAnalytics.errors.verifyDoc')); }
  };

  // Open rejection modal instead of immediately rejecting
  const openRejectModal = (docId: string, userId: string) => {
    setRejectComment('');
    setRejectModal({ docId, userId });
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    const { docId, userId } = rejectModal;
    setRejectModal(null);
    try {
      const updated = await documentService.reject(docId, rejectComment);
      setStudentDocs(prev => ({ ...prev, [userId]: prev[userId].map(d => d.id === docId ? updated : d) }));
      setPendingDocsCount(prev => Math.max(0, prev - 1));
      toast.success(t('universityAnalytics.success.docRejected'));
    } catch { toast.error(t('universityAnalytics.errors.rejectDoc')); }
  };

  const handleAutoVerify = async (userId: string) => {
    try {
      const result = await documentService.autoVerify(userId);
      if (result.verified_count === 0) { toast.info(t('universityAnalytics.autoVerify.noPending')); return; }
      setStudentDocs(prev => ({
        ...prev,
        ...(prev[userId] ? {
          [userId]: prev[userId].map(d =>
            d.status === 'pending' && d.type === 'diploma' ? { ...d, status: 'verified' as const } : d
          ),
        } : {}),
      }));
      setPendingDocsCount(prev => Math.max(0, prev - result.verified_count));
      toast.success(t('universityAnalytics.autoVerify.success', { count: result.verified_count }));
    } catch { toast.error(t('universityAnalytics.autoVerify.error')); }
  };

  const handleEnroll = async (student: BackendStudentProfile) => {
    setEnrollingId(student.user_id);
    const gradYear = student.graduation_year;
    const dates = gradYear > 0
      ? { graduation_date: `${gradYear}-09-01T00:00:00Z`, deadline: `${gradYear + 3}-09-01T00:00:00Z` }
      : {};
    try {
      await complianceService.enroll({ student_id: student.user_id, grant_years: 3, ...dates });
      setComplianceRecords(await complianceService.getForUniversity());
      toast.success(t('universityAnalytics.compliance.enrolled', { defaultValue: 'Студент добавлен в отслеживание' }));
    } catch {
      toast.error(t('universityAnalytics.compliance.enrollError', { defaultValue: 'Не удалось добавить студента' }));
    } finally {
      setEnrollingId(null);
    }
  };

  const handleEnrollMany = async (students: BackendStudentProfile[]) => {
    if (students.length === 0) return;
    setEnrollingIds(new Set(students.map(s => s.user_id)));
    let successCount = 0;
    await Promise.all(
      students.map(async student => {
        const gradYear = student.graduation_year;
        const dates = gradYear > 0
          ? { graduation_date: `${gradYear}-09-01T00:00:00Z`, deadline: `${gradYear + 3}-09-01T00:00:00Z` }
          : {};
        try {
          await complianceService.enroll({ student_id: student.user_id, grant_years: 3, ...dates });
          successCount++;
        } catch { /* skip individual failures */ } finally {
          setEnrollingIds(prev => { const n = new Set(prev); n.delete(student.user_id); return n; });
        }
      })
    );
    setComplianceRecords(await complianceService.getForUniversity());
    if (successCount > 0) {
      toast.success(t('universityAnalytics.compliance.enrolledMany', { count: successCount, defaultValue: `Добавлено в отслеживание: ${successCount}` }));
    }
    if (successCount < students.length) {
      toast.error(t('universityAnalytics.compliance.enrollError', { defaultValue: 'Не удалось добавить некоторых студентов' }));
    }
    setEnrollingIds(new Set());
  };

  // ── Computed: real employment rate from loaded data ──
  const employedIds = new Set(
    employmentRecords
      .filter(r => r.status === 'active' || r.status === 'completed')
      .map(r => r.student_id)
  );
  const totalEmployedStudents = myStudents.filter(s => employedIds.has(s.user_id)).length;
  const realEmploymentRate = myStudents.length > 0
    ? Math.round((totalEmployedStudents / myStudents.length) * 100) : 0;

  // Application-based conversion rate (kept for historical reference)
  const conversionRate = data && data.applications.total > 0
    ? Math.round((data.applications.offered_count / data.applications.total) * 100)
    : 0;

  // ── Computed: employment rate per program (for Statistics chart) ──
  const programChartStats = EDUCATIONAL_PROGRAMS.map(prog => {
    const progStudents = myStudents.filter(s => s.specialization === prog);
    const employedCount = progStudents.filter(s => employedIds.has(s.user_id)).length;
    const empRate = progStudents.length > 0 ? Math.round((employedCount / progStudents.length) * 100) : 0;
    return { name: prog, count: progStudents.length, employedCount, empRate };
  }).filter(p => p.count > 0).sort((a, b) => b.empRate - a.empRate);

  // ── Computed: year dynamics ──
  const yearMap = new Map<number, { total: number; employed: number }>();
  myStudents.forEach(s => {
    const yr = s.graduation_year;
    if (!yr || yr < 2018 || yr > 2030) return;
    const e = yearMap.get(yr) ?? { total: 0, employed: 0 };
    e.total++;
    if (employedIds.has(s.user_id)) e.employed++;
    yearMap.set(yr, e);
  });
  const yearStats = [...yearMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, v]) => ({ year, ...v, rate: v.total > 0 ? Math.round((v.employed / v.total) * 100) : 0 }));

  // ── Computed: GPA histogram (4.0 scale — max accepted by the profile form) ──
  const gpaBuckets = [
    { label: '0–1.0', min: 0.01, max: 1.0,  color: '#EF4444' },
    { label: '1.0–2.0', min: 1.0, max: 2.0,  color: '#F97316' },
    { label: '2.0–2.5', min: 2.0, max: 2.5,  color: '#F59E0B' },
    { label: '2.5–3.0', min: 2.5, max: 3.0,  color: '#84CC16' },
    { label: '3.0–3.5', min: 3.0, max: 3.5,  color: '#10B981' },
    { label: '3.5–4.0', min: 3.5, max: 4.01, color: '#06B6D4' },
  ];
  const gpaDistribution = gpaBuckets.map(b => ({
    ...b,
    count: myStudents.filter(s => s.gpa >= b.min && s.gpa < b.max).length,
  }));
  const maxGpaCount = Math.max(...gpaDistribution.map(b => b.count), 1);

  const statCards = data ? [
    { label: t('universityAnalytics.stats.studentsTotal'),     value: String(data.students.total),             tone: 'blue',
      icon: <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> },
    { label: t('universityAnalytics.stats.applicationsTotal'), value: String(data.applications.total),         tone: 'indigo',
      icon: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    { label: t('universityAnalytics.stats.offersReceived'),    value: String(data.applications.offered_count), tone: 'green',
      icon: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /> },
    { label: t('universityAnalytics.stats.activeVacancies'),   value: String(data.vacancies.total),            tone: 'purple',
      icon: <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
  ] : [];

  const complianceAtRisk = complianceRecords.filter(r => r.state === 'AtRisk' || r.state === 'NonCompliant').length;

  const tabs = [
    { key: 'overview'   as const, label: t('universityAnalytics.tabs.overview') },
    { key: 'programs'   as const, label: t('universityAnalytics.tabs.programs', { defaultValue: 'ОП' }), badge: !myStudentsLoading && myStudents.length > 0 ? myStudents.length : undefined },
    { key: 'employment' as const, label: t('universityAnalytics.tabs.employment') },
    { key: 'compliance' as const, label: t('universityAnalytics.tabs.compliance', { defaultValue: 'Грант' }), badge: complianceAtRisk > 0 ? complianceAtRisk : undefined },
    { key: 'employers'  as const, label: t('universityAnalytics.tabs.employers') },
    { key: 'statistics' as const, label: t('universityAnalytics.tabs.statistics') },
  ];

  // ── Doc card: render verification audit line ──
  const renderAuditLine = (doc: Document) => {
    if (doc.status === 'verified' && doc.verified_at) {
      const date = new Date(doc.verified_at).toLocaleDateString('ru-RU');
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          <p className="text-[10px] text-green-600">{t('universityAnalytics.docReview.verifiedAt', { date })}</p>
          {doc.comment && <p className="text-[10px] text-gray-400">{t('universityAnalytics.docReview.comment', { text: doc.comment })}</p>}
        </div>
      );
    }
    if (doc.status === 'rejected' && doc.verified_at) {
      const date = new Date(doc.verified_at).toLocaleDateString('ru-RU');
      return (
        <div className="flex flex-col gap-0.5 mt-1">
          <p className="text-[10px] text-red-500">{t('universityAnalytics.docReview.rejectedAt', { date })}</p>
          {doc.comment && <p className="text-[10px] text-gray-400">{t('universityAnalytics.docReview.comment', { text: doc.comment })}</p>}
        </div>
      );
    }
    return null;
  };

  // ── Reusable diploma doc card ──
  const renderDocCard = (doc: Document, userId: string, compact = false) => {
    const cfg = DOC_STATUS[doc.status as keyof typeof DOC_STATUS] ?? { label: doc.status, cls: 'bg-gray-100 text-gray-700' };
    return (
      <div key={doc.id} className={`flex items-start justify-between bg-white rounded-xl border border-gray-200 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} bg-red-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
            <span className="text-red-500 font-bold text-[9px]">PDF</span>
          </div>
          <div className="min-w-0">
            <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'} truncate`}>{(() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })()}</p>
            <p className="text-[10px] text-gray-400">{t(getTypeKey(doc.type))} · {(doc.file_size / 1024).toFixed(0)} KB</p>
            {renderAuditLine(doc)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0 ml-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
          <button
            onClick={() => documentService.download(doc.id, doc.file_name).catch(() => toast.error(t('profile.documents.downloadError')))}
            className="text-blue-600 hover:text-blue-700 text-xs font-medium">
            {t('universityAnalytics.docReview.download')}
          </button>
          {doc.status === 'pending' && (
            <>
              <button onClick={() => handleVerify(doc.id, userId)}
                className={`${compact ? 'px-2 py-0.5' : 'px-3 py-1'} bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700`}>
                {t('universityAnalytics.docReview.verify')}
              </button>
              <button onClick={() => openRejectModal(doc.id, userId)}
                className={`${compact ? 'px-2 py-0.5' : 'px-3 py-1'} border border-red-200 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50`}>
                {t('universityAnalytics.docReview.reject')}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">

      {/* ── Rejection reason modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">{t('universityAnalytics.rejectModal.title')}</h3>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              placeholder={t('universityAnalytics.rejectModal.placeholder')}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                {t('universityAnalytics.rejectModal.cancel')}
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700">
                {t('universityAnalytics.rejectModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{t('universityAnalytics.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('universityAnalytics.subtitle')}</p>
          </div>
          {/* ── Pending справки notification badge ── */}
          {pendingDocsCount > 0 && (
            <button
              onClick={() => setActiveTab('programs')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-300 rounded-xl hover:bg-amber-100 transition-colors">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                {t('universityAnalytics.pendingAlert', { count: pendingDocsCount })}
              </span>
            </button>
          )}
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
                      <svg style={{ width: 18, height: 18, color: tone.fg }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
                {tab.badge !== undefined && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.key && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Application statuses with donut chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-5">{t('universityAnalytics.overview.applicationStatuses')}</h2>
                {data.applications.by_status.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <DonutChart
                      size={140}
                      totalLabel={t('universityAnalytics.programs.donutTotal')}
                      data={data.applications.by_status.map(s => ({
                        label: STATUS_LABELS[s.status] ?? s.status,
                        value: s.count,
                        color: STATUS_COLORS[s.status] ?? '#94A3B8',
                      }))}
                    />
                    <div className="flex-1 space-y-2.5">
                      {data.applications.by_status.map(item => (
                        <div key={item.status} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: STATUS_COLORS[item.status] ?? '#94A3B8' }} />
                            <span className="text-gray-600">{STATUS_LABELS[item.status] ?? item.status}</span>
                          </div>
                          <span className="font-semibold text-gray-900 ml-2">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">{t('universityAnalytics.overview.noApplicationData')}</p>
                )}
              </div>

              {/* Employment rates — two rings side by side */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex gap-6 items-center justify-center">
                {/* Real employment rate (from employment records) */}
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full border-8 border-green-100 flex items-center justify-center mb-3">
                    <p className="text-2xl font-bold text-green-600">{realEmploymentRate}%</p>
                  </div>
                  <p className="font-semibold text-gray-900 text-center text-sm">{t('universityAnalytics.overview.realEmploymentRate')}</p>
                  {myStudents.length > 0 && (
                    <p className="text-xs text-gray-400 text-center mt-1">
                      {t('universityAnalytics.overview.employedStudents', { employed: totalEmployedStudents, total: myStudents.length })}
                    </p>
                  )}
                </div>
                {/* Application-to-offer conversion */}
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full border-8 border-blue-100 flex items-center justify-center mb-3">
                    <p className="text-2xl font-bold text-blue-600">{conversionRate}%</p>
                  </div>
                  <p className="font-semibold text-gray-900 text-center text-sm">{t('universityAnalytics.overview.conversionRate')}</p>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    {t('universityAnalytics.overview.offersFromApplications', { offers: data.applications.offered_count, total: data.applications.total })}
                  </p>
                </div>
              </div>

              {/* Vacancies by location */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:col-span-2">
                <h2 className="text-base font-semibold text-gray-900 mb-5">{t('universityAnalytics.overview.vacanciesByLocation')}</h2>
                <div className="space-y-3">
                  {data.vacancies.by_location.map(item => {
                    const max = data.vacancies.by_location[0]?.count || 1;
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-gray-700 font-medium flex items-center gap-1"><Icon name="pin" size={13} className="text-gray-400 shrink-0" />{item.name}</span>
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

          {/* ── Compliance / grant-obligation at-risk panel ── */}
          {activeTab === 'compliance' && (
            <CompliancePanel
              records={complianceRecords}
              myStudents={myStudents}
              onEnroll={handleEnroll}
              onEnrollMany={handleEnrollMany}
              enrollingId={enrollingId}
              enrollingIds={enrollingIds}
            />
          )}

          {/* ── Educational Programs (ОП) ── */}
          {activeTab === 'programs' && (() => {
            const programStats = EDUCATIONAL_PROGRAMS.map(prog => {
              const students = myStudents.filter(s => s.specialization === prog);
              const employedCount = students.filter(s => employedIds.has(s.user_id)).length;
              const avgGpa = students.length > 0
                ? students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length : 0;
              const empRate = students.length > 0 ? Math.round((employedCount / students.length) * 100) : 0;
              return { name: prog, count: students.length, avgGpa, students, employedCount, empRate };
            }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);

            const unassigned = myStudents.filter(
              s => !s.specialization || !EDUCATIONAL_PROGRAMS.includes(s.specialization as EducationalProgram)
            );

            const maxCount = programStats[0]?.count || 1;
            const overallEmpRate = myStudents.length > 0 ? Math.round((totalEmployedStudents / myStudents.length) * 100) : 0;

            const searchLower = programSearch.toLowerCase();
            const filtered = programSearch
              ? programStats.filter(p =>
                  t(`programNames.${PROGRAM_I18N_KEY[p.name as EducationalProgram]}`, p.name)
                    .toLowerCase().includes(searchLower)
                )
              : programStats;

            const exportCSV = () => {
              const headers = [
                t('universityAnalytics.programs.pdf.colStudent'),
                t('universityAnalytics.programs.pdf.colProgram'),
                'GPA',
                t('universityAnalytics.programs.pdf.colGraduation'),
                t('universityAnalytics.programs.pdf.colSkills'),
                t('universityAnalytics.programs.pdf.colStatus'),
              ];
              const rows = myStudents.map(s => {
                const emp = employedIds.has(s.user_id);
                const prog = s.specialization
                  ? t(`programNames.${PROGRAM_I18N_KEY[s.specialization as EducationalProgram]}`, s.specialization) : '';
                return [
                  `${s.first_name} ${s.last_name}`,
                  prog,
                  s.gpa > 0 ? s.gpa.toFixed(2) : '',
                  s.graduation_year > 0 ? String(s.graduation_year) : '',
                  s.skills || '',
                  emp ? t('universityAnalytics.programs.pdf.employedStatus') : t('universityAnalytics.programs.pdf.seekingStatus'),
                ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
              });
              const csv = '﻿' + [headers.join(','), ...rows].join('\r\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            };

            const exportPDF = () => {
              const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const date = new Date().toLocaleDateString('ru-RU');
              const rows = myStudents.map(s => {
                const emp = employedIds.has(s.user_id);
                const prog = s.specialization
                  ? t(`programNames.${PROGRAM_I18N_KEY[s.specialization as EducationalProgram]}`, s.specialization)
                  : '—';
                return `<tr>
                  <td>${esc(s.first_name + ' ' + s.last_name)}</td>
                  <td>${esc(prog)}</td>
                  <td style="text-align:center">${s.gpa > 0 ? s.gpa.toFixed(2) : '—'}</td>
                  <td style="text-align:center">${s.graduation_year > 0 ? s.graduation_year : '—'}</td>
                  <td>${esc(s.skills || '—')}</td>
                  <td style="text-align:center">
                    <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:bold;background:${emp ? '#D1FAE5' : '#F3F4F6'};color:${emp ? '#065F46' : '#6B7280'}">
                      ${emp ? t('universityAnalytics.programs.pdf.employedStatus') : t('universityAnalytics.programs.pdf.seekingStatus')}
                    </span>
                  </td>
                </tr>`;
              }).join('');

              const totalEmp = myStudents.filter(s => employedIds.has(s.user_id)).length;
              const avgGpa = myStudents.length > 0
                ? (myStudents.reduce((s, st) => s + (st.gpa || 0), 0) / myStudents.length).toFixed(2) : '—';

              const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${t('universityAnalytics.programs.pdf.title')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
  h1 { font-size: 18px; color: #1e3a5f; margin-bottom: 4px; }
  .subtitle { color: #6B7280; font-size: 11px; margin-bottom: 16px; }
  .stats { display:flex; gap:24px; margin-bottom:20px; padding:12px 16px; background:#F0F7FF; border-radius:8px; border-left:4px solid #3B82F6; }
  .stat { text-align:center; }
  .stat-val { font-size:20px; font-weight:bold; color:#1d4ed8; }
  .stat-lbl { font-size:10px; color:#6B7280; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  thead tr { background:#1e3a5f; color:white; }
  th { padding:8px 10px; text-align:left; font-size:11px; font-weight:600; letter-spacing:.3px; }
  td { padding:7px 10px; font-size:11px; border-bottom:1px solid #E5E7EB; }
  tr:nth-child(even) td { background:#F9FAFB; }
  tr:hover td { background:#EFF6FF; }
  .footer { margin-top:20px; font-size:10px; color:#9CA3AF; text-align:right; }
  @page { size: A4 landscape; margin: 12mm; }
  @media print { body { padding:0; } }
</style>
</head><body>
<h1>${t('universityAnalytics.programs.pdf.title')}</h1>
<div class="subtitle">${t('universityAnalytics.programs.pdf.generated')} ${date}</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${myStudents.length}</div><div class="stat-lbl">${t('universityAnalytics.programs.pdf.totalStudents')}</div></div>
  <div class="stat"><div class="stat-val">${programStats.length}</div><div class="stat-lbl">${t('universityAnalytics.programs.pdf.activePrograms')}</div></div>
  <div class="stat"><div class="stat-val">${totalEmp}</div><div class="stat-lbl">${t('universityAnalytics.programs.pdf.employed')}</div></div>
  <div class="stat"><div class="stat-val">${myStudents.length > 0 ? Math.round(totalEmp/myStudents.length*100) : 0}%</div><div class="stat-lbl">${t('universityAnalytics.programs.pdf.employmentRate')}</div></div>
  <div class="stat"><div class="stat-val">${avgGpa}</div><div class="stat-lbl">${t('universityAnalytics.programs.pdf.avgGpa')}</div></div>
</div>
<table>
  <thead><tr>
    <th>${t('universityAnalytics.programs.pdf.colStudent')}</th><th>${t('universityAnalytics.programs.pdf.colProgram')}</th>
    <th style="text-align:center">${t('universityAnalytics.programs.pdf.colGpa')}</th><th style="text-align:center">${t('universityAnalytics.programs.pdf.colGraduation')}</th>
    <th>${t('universityAnalytics.programs.pdf.colSkills')}</th><th style="text-align:center">${t('universityAnalytics.programs.pdf.colStatus')}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">${t('universityAnalytics.programs.pdf.footer')} · ${date}</div>
</body></html>`;

              const win = window.open('', '_blank', 'width=1000,height=700');
              if (!win) { toast.error(t('universityAnalytics.programs.popupBlocked')); return; }
              win.document.write(html);
              win.document.close();
              win.onload = () => { win.focus(); win.print(); };
            };

            const rateColor = (r: number) =>
              r >= 61 ? '#10B981' : r >= 31 ? '#F59E0B' : r > 0 ? '#EF4444' : '#9CA3AF';

            return (
              <div className="space-y-4">

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: t('universityAnalytics.programs.cards.totalStudents'), value: myStudents.length,   color: '#2563EB', bg: '#EFF6FF' },
                    { label: t('universityAnalytics.programs.cards.activePrograms'), value: programStats.length, color: '#7C3AED', bg: '#F5F3FF' },
                    { label: t('universityAnalytics.programs.cards.employed'),   value: `${overallEmpRate}%`,color: '#10B981', bg: '#ECFDF5' },
                    { label: t('universityAnalytics.programs.cards.avgGpa'),
                      value: myStudents.length > 0
                        ? (myStudents.reduce((s, st) => s + (st.gpa || 0), 0) / myStudents.length).toFixed(2)
                        : '—',
                      color: '#F59E0B', bg: '#FFFBEB' },
                  ].map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                      <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                      <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* Programs list */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

                  {/* Header: title + search + export */}
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                    <h2 className="font-semibold text-gray-900 flex-1 min-w-0">{t('universityAnalytics.programs.title')}</h2>
                    {/* Pending справки badge */}
                    {pendingDocsCount > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {t('universityAnalytics.programs.pendingDocsCount', { count: pendingDocsCount })}
                      </span>
                    )}
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder={t('universityAnalytics.programs.searchPlaceholder')}
                        value={programSearch}
                        onChange={e => setProgramSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <input
                        type="text"
                        placeholder={t('universityAnalytics.programs.studentSearchPlaceholder')}
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={exportCSV}
                      disabled={myStudents.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
                      </svg>
                      {t('universityAnalytics.programs.exportCsv')}
                    </button>
                    <button
                      onClick={exportPDF}
                      disabled={myStudents.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {t('universityAnalytics.programs.exportPdf')}
                    </button>
                    {myStudentsLoading && <span className="text-xs text-gray-400">{t('common.loading')}</span>}
                  </div>

                  {/* Student search results */}
                  {studentSearch && (() => {
                    const searchLowerSt = studentSearch.toLowerCase();
                    const results = myStudents.filter(s =>
                      `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLowerSt)
                    );
                    return (
                      <div className="divide-y divide-gray-100">
                        {results.length === 0 && (
                          <div className="p-8 text-center text-gray-400">
                            <p>{t('universityAnalytics.programs.noStudentsFound')}</p>
                          </div>
                        )}
                        {results.map(s => {
                          const employed = employedIds.has(s.user_id);
                          const progName = s.specialization
                            ? t(`programNames.${PROGRAM_I18N_KEY[s.specialization as EducationalProgram]}`, s.specialization)
                            : '—';
                          const isStudentExpanded = expandedStudent === s.user_id;
                          return (
                            <Fragment key={s.id}>
                              <div className="flex items-center gap-3 px-6 py-4">
                                <button onClick={() => navigate(`/candidate/${s.user_id}`)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                                    {s.first_name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900 text-sm truncate">{s.first_name} {s.last_name}</p>
                                    <p className="text-xs text-gray-400 truncate">{progName}</p>
                                  </div>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  {s.gpa > 0 && <span className="text-sm font-semibold text-green-600 hidden sm:inline">GPA {s.gpa.toFixed(2)}</span>}
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${employed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {employed ? t('universityAnalytics.programs.employedBadge') : t('universityAnalytics.programs.seekingBadge')}
                                  </span>
                                  <button
                                    onClick={() => { handleAutoVerify(s.user_id); loadStudentDocs(s.user_id); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100">
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t('universityAnalytics.autoVerify.button')}
                                  </button>
                                  <button onClick={() => toggleStudent(s.user_id)}
                                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                                    <svg className={`w-4 h-4 transition-transform ${isStudentExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              {isStudentExpanded && (
                                <div className="border-t border-gray-100 bg-blue-50 p-4 space-y-2">
                                  {docsLoading[s.user_id] && (
                                    <p className="text-gray-400 text-sm text-center py-2">{t('universityAnalytics.docReview.loadingDocs')}</p>
                                  )}
                                  {!docsLoading[s.user_id] && (studentDocs[s.user_id]?.filter(d => d.type === 'diploma').length ?? 0) === 0 && (
                                    <p className="text-gray-400 text-sm text-center py-2">{t('universityAnalytics.docReview.noDocs')}</p>
                                  )}
                                  {(studentDocs[s.user_id] ?? []).filter(doc => doc.type === 'diploma').map(doc =>
                                    renderDocCard(doc, s.user_id)
                                  )}
                                </div>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!studentSearch && !myStudentsLoading && programStats.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      <p className="text-lg">{t('universityAnalytics.programs.noData')}</p>
                      <p className="text-sm mt-1">{t('universityAnalytics.programs.noDataHint')}</p>
                    </div>
                  )}

                  {!studentSearch && filtered.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {filtered.map((prog, i) => {
                        const progName = t(`programNames.${PROGRAM_I18N_KEY[prog.name as EducationalProgram]}`, prog.name);
                        const rc = rateColor(prog.empRate);
                        const isOpen = expandedProgram === prog.name;
                        return (
                          <div key={prog.name}>
                            {/* Program row — clickable */}
                            <button
                              onClick={() => setExpandedProgram(isOpen ? null : prog.name)}
                              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                            >
                              <span className="w-6 text-sm font-bold text-gray-300 shrink-0">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">{progName}</p>
                                <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${(prog.count / maxCount) * 100}%` }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0 text-right">
                                <div>
                                  <p className="text-base font-bold text-gray-900">{prog.count}</p>
                                  <p className="text-[10px] text-gray-400">{t('universityAnalytics.programs.columns.students')}</p>
                                </div>
                                {prog.avgGpa > 0 && (
                                  <div>
                                    <p className="text-base font-bold text-green-600">{prog.avgGpa.toFixed(2)}</p>
                                    <p className="text-[10px] text-gray-400">{t('universityAnalytics.programs.columns.avgGpa')}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-base font-bold" style={{ color: rc }}>{prog.empRate}%</p>
                                  <p className="text-[10px] text-gray-400">{t('universityAnalytics.programs.columns.employed')}</p>
                                </div>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {/* Expanded: students of this program */}
                            {isOpen && (
                              <div className="border-t border-gray-100 bg-gray-50 overflow-x-auto">
                                <table className="w-full min-w-[720px]">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.programs.table.student')}</th>
                                      <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">GPA</th>
                                      <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.programs.table.graduation')}</th>
                                      <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.programs.table.skills')}</th>
                                      <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.programs.table.status')}</th>
                                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.programs.table.docs', { defaultValue: 'Документы' })}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {prog.students.map(s => {
                                      const employed = employedIds.has(s.user_id);
                                      const isStudentExpanded = expandedStudent === s.user_id;
                                      return (
                                        <Fragment key={s.id}>
                                          <tr className="hover:bg-white cursor-pointer transition-colors"
                                            onClick={() => navigate(`/candidate/${s.user_id}`)}>
                                            <td className="px-6 py-3">
                                              <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                                                  style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                                                  {s.first_name.charAt(0)}
                                                </div>
                                                <span className="font-medium text-gray-900 text-sm whitespace-nowrap">{s.first_name} {s.last_name}</span>
                                              </div>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-semibold text-green-600">{s.gpa > 0 ? s.gpa.toFixed(2) : '—'}</td>
                                            <td className="px-6 py-3 text-sm text-gray-600">{s.graduation_year > 0 ? s.graduation_year : '—'}</td>
                                            <td className="px-6 py-3">
                                              <div className="flex flex-wrap gap-1">
                                                {s.skills
                                                  ? parseSkills(s.skills).slice(0, 3).map(sk => (
                                                      <span key={sk} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium whitespace-nowrap">
                                                        {sk}
                                                      </span>
                                                    ))
                                                  : <span className="text-gray-400 text-xs">—</span>}
                                              </div>
                                            </td>
                                            <td className="px-6 py-3">
                                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${employed ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {employed ? t('universityAnalytics.programs.employedBadge') : t('universityAnalytics.programs.seekingBadge')}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                              <div className="flex items-center gap-1 justify-end">
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleAutoVerify(s.user_id); loadStudentDocs(s.user_id); }}
                                                  className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 whitespace-nowrap">
                                                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                  {t('universityAnalytics.autoVerify.button')}
                                                </button>
                                                <button
                                                  onClick={e => { e.stopPropagation(); toggleStudent(s.user_id); }}
                                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                                                  <svg className={`w-3.5 h-3.5 transition-transform ${isStudentExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                          {isStudentExpanded && (
                                            <tr>
                                              <td colSpan={6} className="p-0">
                                                <div className="bg-blue-50 p-3 space-y-2">
                                                  {docsLoading[s.user_id] && (
                                                    <p className="text-gray-400 text-xs text-center py-2">{t('universityAnalytics.docReview.loadingDocs')}</p>
                                                  )}
                                                  {!docsLoading[s.user_id] && (studentDocs[s.user_id]?.filter(d => d.type === 'diploma').length ?? 0) === 0 && (
                                                    <p className="text-gray-400 text-xs text-center py-2">{t('universityAnalytics.docReview.noDocs')}</p>
                                                  )}
                                                  {(studentDocs[s.user_id] ?? []).filter(doc => doc.type === 'diploma').map(doc =>
                                                    renderDocCard(doc, s.user_id, true)
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Без ОП — warning accordion */}
                  {!studentSearch && unassigned.length > 0 && (
                    <div className="border-t-2 border-amber-200">
                      <button
                        onClick={() => setExpandedProgram(expandedProgram === '__unassigned__' ? null : '__unassigned__')}
                        className="w-full flex items-center gap-3 px-6 py-4 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                      >
                        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="flex-1 text-sm font-semibold text-amber-800">
                          {t('universityAnalytics.programs.unassignedWarning', { count: unassigned.length })}
                        </span>
                        <svg
                          className={`w-4 h-4 text-amber-500 transition-transform shrink-0 ${expandedProgram === '__unassigned__' ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {expandedProgram === '__unassigned__' && (
                        <div className="bg-amber-50 border-t border-amber-100 overflow-x-auto">
                          <table className="w-full min-w-[400px]">
                            <thead className="bg-amber-100">
                              <tr>
                                <th className="px-6 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase">{t('universityAnalytics.programs.table.student')}</th>
                                <th className="px-6 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase">GPA</th>
                                <th className="px-6 py-2.5 text-left text-xs font-semibold text-amber-700 uppercase">{t('universityAnalytics.programs.table.graduationYear')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {unassigned.map(s => (
                                <tr key={s.id} className="hover:bg-amber-100 cursor-pointer transition-colors"
                                  onClick={() => navigate(`/candidate/${s.user_id}`)}>
                                  <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 bg-amber-400">
                                        {s.first_name.charAt(0)}
                                      </div>
                                      <span className="font-medium text-gray-900 text-sm whitespace-nowrap">{s.first_name} {s.last_name}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 text-sm font-semibold text-green-600">{s.gpa > 0 ? s.gpa.toFixed(2) : '—'}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{s.graduation_year > 0 ? s.graduation_year : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* All programs reference */}
                  {!studentSearch && (
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-500 mb-3">{t('universityAnalytics.programs.allPrograms')}</p>
                      <div className="flex flex-wrap gap-2">
                        {EDUCATIONAL_PROGRAMS.map(prog => {
                          const active = programStats.some(p => p.name === prog);
                          return (
                            <span key={prog}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                              {t(`programNames.${PROGRAM_I18N_KEY[prog]}`, prog)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}


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
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.student')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.company')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.position')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.startDate')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.daysWorked')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.progress')}</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('employment.table.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employmentRecords.map(rec => {
                        const student = myStudents.find(s => s.user_id === rec.student_id) ?? studentDetailsMap[rec.student_id];
                        const studentName = student ? `${student.first_name} ${student.last_name}` : '…';
                        const studentUserId = student?.user_id ?? rec.student_id;
                        const statusColors: Record<string, string> = {
                          active: 'bg-green-50 text-green-700',
                          completed: 'bg-blue-50 text-blue-700',
                          terminated_early: 'bg-red-50 text-red-700',
                        };
                        const startDate = new Date(rec.started_at).toLocaleDateString('ru-RU');
                        return (
                          <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-4">
                              <button onClick={() => navigate(`/candidate/${studentUserId}`)}
                                className="flex items-center gap-2 text-left group">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                                  style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                                  {studentName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 whitespace-nowrap">{studentName}</span>
                              </button>
                            </td>
                            <td className="px-5 py-4 font-medium text-gray-900 text-sm">{rec.company_name || '—'}</td>
                            <td className="px-5 py-4 text-gray-600 text-sm">{rec.job_title || '—'}</td>
                            <td className="px-5 py-4 text-gray-500 text-sm">{startDate}</td>
                            <td className="px-5 py-4 text-gray-700 font-semibold text-sm">
                              {rec.not_started ? '—' : rec.days_worked}
                            </td>
                            <td className="px-5 py-4 min-w-[160px]">
                              {rec.not_started ? (
                                <span className="text-gray-400 text-sm">—</span>
                              ) : rec.grant_fulfilled ? (
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
                              {rec.not_started ? (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                                  Срок не наступил
                                </span>
                              ) : (
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[rec.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {t(`employment.status.${rec.status}` as const, rec.status)}
                                </span>
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

          {/* ── Employers / Vacancy types + Companies that hired ── */}
          {activeTab === 'employers' && (() => {
            // Build company summary from employment records
            const companyMap = new Map<string, { students: Set<string>; positions: Set<string>; activeCount: number; completedCount: number }>();
            employmentRecords.forEach(rec => {
              if (!rec.company_name) return;
              const entry = companyMap.get(rec.company_name) ?? { students: new Set(), positions: new Set(), activeCount: 0, completedCount: 0 };
              entry.students.add(rec.student_id);
              if (rec.job_title) entry.positions.add(rec.job_title);
              if (rec.status === 'active') entry.activeCount++;
              if (rec.status === 'completed') entry.completedCount++;
              companyMap.set(rec.company_name, entry);
            });
            const companies = [...companyMap.entries()]
              .map(([name, v]) => ({ name, studentCount: v.students.size, positions: [...v.positions], activeCount: v.activeCount, completedCount: v.completedCount }))
              .sort((a, b) => b.studentCount - a.studentCount);

            return (
              <div className="space-y-5">
                {/* Vacancy types */}
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

                {/* Companies that hired university students */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">{t('universityAnalytics.employers.companiesTitle')}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{t('universityAnalytics.employers.companiesHint')}</p>
                  </div>
                  {companies.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                      <p className="font-medium text-gray-500">{t('universityAnalytics.employers.noHires')}</p>
                      <p className="text-sm text-gray-400 mt-1">{t('universityAnalytics.employers.noHiresHint')}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {companies.map((company, idx) => (
                        <div key={company.name} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                          {/* Rank + logo placeholder */}
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <span className="text-xs font-bold text-gray-300 w-5 text-center">{idx + 1}</span>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                              style={{ background: `hsl(${(company.name.charCodeAt(0) * 47) % 360}, 60%, 55%)` }}>
                              {company.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{company.name}</p>
                            {company.positions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {company.positions.slice(0, 3).map(pos => (
                                  <span key={pos} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{pos}</span>
                                ))}
                                {company.positions.length > 3 && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">+{company.positions.length - 3}</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {company.activeCount > 0 && (
                                <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                                  {company.activeCount} {t('universityAnalytics.employers.active')}
                                </span>
                              )}
                              {company.completedCount > 0 && (
                                <span className="text-xs text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                                  {company.completedCount} {t('universityAnalytics.employers.completed')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xl font-bold text-gray-900">{company.studentCount}</p>
                            <p className="text-[10px] text-gray-400">{t('universityAnalytics.employers.companyStudents')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Statistics ── */}
          {activeTab === 'statistics' && (
            <div className="space-y-5">
              {/* Export button */}
              {data && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                      const date = new Date().toLocaleDateString('ru-RU');
                      const statusRows = data.applications.by_status.map(s => {
                        const lbl: Record<string,string> = { applied:'Подано', interview:'Интервью', shortlisted:'Отобрано', offered:'Оффер', rejected:'Отказ' };
                        return `<tr><td>${esc(lbl[s.status] ?? s.status)}</td><td style="text-align:center">${s.count}</td></tr>`;
                      }).join('');
                      const skillRows = data.vacancies.demanded_skills.slice(0, 15).map((sk, i) =>
                        `<tr><td>${i+1}</td><td>${esc(sk.name)}</td><td style="text-align:center">${sk.count}</td></tr>`
                      ).join('');
                      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
                        <title>Статистика</title>
                        <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
                        h1{font-size:18px;margin-bottom:4px}
                        .sub{color:#666;font-size:13px;margin-bottom:20px}
                        table{width:100%;border-collapse:collapse;margin-bottom:24px}
                        th{background:#f3f4f6;padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280}
                        td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}
                        h2{font-size:14px;font-weight:600;margin:20px 0 8px}
                        </style></head><body>
                        <h1>Отчёт по статистике университета</h1>
                        <div class="sub">Сформирован: ${date}</div>
                        <h2>Общие показатели</h2>
                        <table><thead><tr><th>Показатель</th><th>Значение</th></tr></thead><tbody>
                        <tr><td>Студентов в системе</td><td style="text-align:center">${data.students.total}</td></tr>
                        <tr><td>Активных вакансий</td><td style="text-align:center">${data.vacancies.total}</td></tr>
                        <tr><td>Всего заявок</td><td style="text-align:center">${data.applications.total}</td></tr>
                        <tr><td>Получили оффер</td><td style="text-align:center">${data.applications.offered_count}</td></tr>
                        <tr><td>Уровень трудоустройства</td><td style="text-align:center">${realEmploymentRate}%</td></tr>
                        </tbody></table>
                        <h2>Статусы заявок</h2>
                        <table><thead><tr><th>Статус</th><th>Кол-во</th></tr></thead><tbody>${statusRows}</tbody></table>
                        <h2>Топ навыки (из вакансий)</h2>
                        <table><thead><tr><th>#</th><th>Навык</th><th>Кол-во вакансий</th></tr></thead><tbody>${skillRows}</tbody></table>
                        </body></html>`;
                      const w = window.open('', '_blank');
                      if (!w) return;
                      w.document.write(html);
                      w.document.close();
                      w.focus();
                      setTimeout(() => { w.print(); }, 400);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Экспорт PDF
                  </button>
                </div>
              )}

              {/* 1. Employment by program — horizontal bar chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-baseline gap-2 mb-5">
                  <h2 className="font-semibold text-gray-900">{t('universityAnalytics.statistics.employmentByProgram')}</h2>
                  <span className="text-sm text-gray-400">{t('universityAnalytics.statistics.employmentByProgramHint')}</span>
                </div>
                {programChartStats.length === 0 ? (
                  <p className="text-gray-400 text-sm">{t('universityAnalytics.statistics.noStudentData')}</p>
                ) : (
                  <div className="space-y-3">
                    {programChartStats.map(prog => {
                      const progName = t(`programNames.${PROGRAM_I18N_KEY[prog.name as EducationalProgram]}`, prog.name);
                      const rc = prog.empRate >= 61 ? '#10B981' : prog.empRate >= 31 ? '#F59E0B' : prog.empRate > 0 ? '#EF4444' : '#9CA3AF';
                      return (
                        <div key={prog.name}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-700 font-medium truncate max-w-[60%]" title={progName}>{progName}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-gray-400">{prog.employedCount}/{prog.count} {t('universityAnalytics.statistics.students')}</span>
                              <span className="text-sm font-bold w-10 text-right" style={{ color: rc }}>{prog.empRate}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${prog.empRate}%`, background: rc }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Year dynamics */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-baseline gap-2 mb-5">
                  <h2 className="font-semibold text-gray-900">{t('universityAnalytics.statistics.yearDynamics')}</h2>
                  <span className="text-sm text-gray-400">{t('universityAnalytics.statistics.yearDynamicsHint')}</span>
                </div>
                {yearStats.length === 0 ? (
                  <p className="text-gray-400 text-sm">{t('universityAnalytics.statistics.noStudentData')}</p>
                ) : (
                  <div className="space-y-4">
                    {yearStats.map(yr => {
                      const maxYr = Math.max(...yearStats.map(y => y.total), 1);
                      const rc = yr.rate >= 61 ? '#10B981' : yr.rate >= 31 ? '#F59E0B' : yr.rate > 0 ? '#EF4444' : '#9CA3AF';
                      return (
                        <div key={yr.year} className="flex items-center gap-4">
                          <span className="text-sm font-bold text-gray-700 w-12 shrink-0">{yr.year}</span>
                          <div className="flex-1 relative h-6 bg-gray-100 rounded-lg overflow-hidden">
                            {/* total bar */}
                            <div className="absolute inset-y-0 left-0 bg-blue-100 rounded-lg"
                              style={{ width: `${(yr.total / maxYr) * 100}%` }} />
                            {/* employed bar */}
                            <div className="absolute inset-y-0 left-0 rounded-lg opacity-80"
                              style={{ width: `${(yr.employed / maxYr) * 100}%`, background: rc }} />
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-right">
                            <span className="text-xs text-gray-400 w-16">{yr.employed}/{yr.total} {t('universityAnalytics.statistics.students')}</span>
                            <span className="text-sm font-bold w-10" style={{ color: rc }}>{yr.rate}%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded bg-blue-100 inline-block" />
                        {t('universityAnalytics.stats.studentsTotal')}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded bg-green-400 inline-block" />
                        {t('universityAnalytics.statistics.employed')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. GPA distribution histogram */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-baseline gap-2 mb-6">
                  <h2 className="font-semibold text-gray-900">{t('universityAnalytics.statistics.gpaDistribution')}</h2>
                  <span className="text-sm text-gray-400">{t('universityAnalytics.statistics.gpaDistributionHint')}</span>
                </div>
                {myStudents.filter(s => s.gpa > 0).length === 0 ? (
                  <p className="text-gray-400 text-sm">{t('universityAnalytics.statistics.noStudentData')}</p>
                ) : (
                  <div className="flex items-end gap-3 h-36">
                    {gpaDistribution.map(b => (
                      <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-gray-700">{b.count > 0 ? b.count : ''}</span>
                        <div className="w-full rounded-t-lg transition-all"
                          style={{ height: `${Math.max((b.count / maxGpaCount) * 100, b.count > 0 ? 4 : 0)}%`, background: b.color, opacity: b.count === 0 ? 0.15 : 1 }} />
                        <span className="text-[10px] text-gray-500 text-center leading-tight">{b.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Demanded skills */}
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

              {/* 5. Summary table */}
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
                    { label: t('universityAnalytics.overview.realEmploymentRate'),          value: `${realEmploymentRate}%`,                   cls: 'text-green-600' },
                    { label: t('universityAnalytics.overview.conversionRate'),              value: `${conversionRate}%`,                       cls: 'text-blue-600' },
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
