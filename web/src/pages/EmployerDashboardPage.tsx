import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MatchIndex from '../components/MatchIndex';
import { ChatModal } from '../components';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';
import { employerService, type JobPosting } from '../services/employerService';
import { parseSkills } from '../utils';
import { applicationService, type Application } from '../services/applicationService';
import { employmentService } from '../services/employmentService';
import { employerProfileService, type EmployerProfile } from '../services/employerProfileService';

interface FormData {
  title: string;
  description: string;
  location: string;
  salary_min: string;
  salary_max: string;
  job_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  skills: string;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  location: '',
  salary_min: '',
  salary_max: '',
  job_type: 'Full-time',
  skills: '',
};

const emptyProfile: Omit<EmployerProfile, 'employer_id' | 'created_at' | 'updated_at'> = {
  company_name: '',
  company_description: '',
  industry: '',
  company_size: '',
  website: '',
  location: '',
  contact_email: '',
  contact_phone: '',
  bin: '',
  bin_status: '',
};

const INDUSTRIES = [
  'Технологии', 'Финансы', 'Образование', 'Здравоохранение',
  'Производство', 'Торговля', 'Консалтинг', 'Медиа', 'Строительство', 'Другое',
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

function getCompanyColor(name: string): string {
  const colors = ['#EF2D30', '#00B74F', '#FF7A00', '#0033A0', '#7C3AED', '#2563EB', '#E11D48', '#0891B2'];
  return colors[name.charCodeAt(0) % colors.length];
}

const statusDotColor: Record<string, string> = {
  applied:    '#2563EB',
  interview:  '#7C3AED',
  offered:    '#10B981',
  rejected:   '#EF4444',
  shortlisted:'#10B981',
  review:     '#F59E0B',
};
const statusBg: Record<string, string> = {
  applied:    '#EFF6FF',
  interview:  '#F5F3FF',
  offered:    '#ECFDF5',
  rejected:   '#FEF2F2',
  shortlisted:'#ECFDF5',
  review:     '#FFFBEB',
};
const statusFg: Record<string, string> = {
  applied:    '#1D4ED8',
  interview:  '#6D28D9',
  offered:    '#047857',
  rejected:   '#B91C1C',
  shortlisted:'#047857',
  review:     '#92400E',
};

const EmployerDashboardPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openedFromUrl = useRef(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'applications' | 'profile'>('overview');
  const [showJobForm, setShowJobForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [myJobs, setMyJobs] = useState<JobPosting[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [vacancyAppCounts, setVacancyAppCounts] = useState<Record<string, number>>({});

  const [applications, setApplications] = useState<Application[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState('');
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [chatApp, setChatApp] = useState<{ id: string; studentName: string } | null>(null);

  const [profile, setProfile] = useState<Omit<EmployerProfile, 'employer_id' | 'created_at' | 'updated_at'>>(emptyProfile);
  const [profileExists, setProfileExists] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');


  const fetchMyJobs = async () => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const jobs = await employerService.getJobPostings();
      setMyJobs(jobs);
    } catch {
      setJobsError(t('employerDashboard.errors.loadJobs'));
    } finally {
      setJobsLoading(false);
    }
  };

  const fetchApplications = async (vacancyId: string) => {
    if (!vacancyId) return;
    setAppsLoading(true);
    setAppsError('');
    try {
      const apps = await applicationService.getVacancyApplications(vacancyId);
      setApplications(apps);
    } catch {
      setAppsError(t('employerDashboard.errors.loadApplications'));
    } finally {
      setAppsLoading(false);
    }
  };

  const fetchAllApplicationsForOverview = async (jobs: JobPosting[]) => {
    if (jobs.length === 0) { setAllApplications([]); return; }
    try {
      const results = await Promise.all(
        jobs.map(j => applicationService.getVacancyApplications(j.id).catch(() => [] as Application[]))
      );
      setAllApplications(results.flat());
    } catch {
      setAllApplications([]);
    }
  };

  const fetchProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const p = await employerProfileService.getProfile();
      setProfile({
        company_name: p.company_name,
        company_description: p.company_description,
        industry: p.industry,
        company_size: p.company_size,
        website: p.website,
        location: p.location,
        contact_email: p.contact_email,
        contact_phone: p.contact_phone,
        bin: p.bin ?? '',
        bin_status: p.bin_status ?? '',
      });
      setProfileExists(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404') || msg.includes('not found')) {
        setProfileExists(false);
      } else {
        setProfileError(t('employerDashboard.errors.loadProfile'));
      }
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const openChatId = searchParams.get('openChat');
    const vacancyId = searchParams.get('vacancyId');
    if (openChatId && vacancyId) {
      setActiveTab('applications');
      setSelectedVacancyId(vacancyId);
      return;
    }
    const tab = searchParams.get('tab');
    if (tab === 'jobs' || tab === 'applications' || tab === 'profile' || tab === 'overview') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (openedFromUrl.current) return;
    const openChatId = searchParams.get('openChat');
    if (!openChatId || applications.length === 0) return;
    const app = applications.find(a => a.id === openChatId);
    if (app) {
      openedFromUrl.current = true;
      setChatApp({
        id: app.id,
        studentName: app.student
          ? `${app.student.first_name} ${app.student.last_name}`.trim() || t('chat.student')
          : t('chat.student'),
      });
    }
  }, [applications]);


  useEffect(() => {
    if (activeTab === 'jobs') {
      employerService.getJobPostings().then(jobs => {
        setMyJobs(jobs);
        Promise.all(
          jobs.map(j => applicationService.getVacancyApplications(j.id).catch(() => [] as Application[]))
        ).then(results => {
          const counts: Record<string, number> = {};
          jobs.forEach((j, i) => { counts[j.id] = results[i].length; });
          setVacancyAppCounts(counts);
        });
      }).catch(() => {});
    }
    if (activeTab === 'applications') fetchMyJobs();
    if (activeTab === 'profile') fetchProfile();
    if (activeTab === 'overview') {
      fetchProfile();
      employerService.getJobPostings().then(jobs => {
        setMyJobs(jobs);
        fetchAllApplicationsForOverview(jobs);
      }).catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'applications' && selectedVacancyId) fetchApplications(selectedVacancyId);
  }, [selectedVacancyId, activeTab]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmitJob = async () => {
    setFormError('');
    setFormSuccess('');
    if (!formData.title.trim() || !formData.description.trim() || !formData.job_type) {
      setFormError(t('employerDashboard.form.errors.missingFields'));
      return;
    }
    setSubmitting(true);
    try {
      await employerService.createJobPosting({
        title: formData.title,
        description: formData.description,
        location: formData.location,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : 0,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : 0,
        job_type: formData.job_type,
        skills: formData.skills,
      });
      setFormSuccess(t('employerDashboard.form.success.posted'));
      setFormData(emptyForm);
      fetchMyJobs();
      setTimeout(() => { setShowJobForm(false); setFormSuccess(''); }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('employerDashboard.form.errors.createJob'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.company_name.trim()) {
      setProfileError(t('employerDashboard.companyProfile.companyNameRequired'));
      return;
    }
    setProfileError('');
    setProfileSuccess('');
    setProfileSaving(true);
    try {
      if (profileExists) {
        await employerProfileService.updateProfile(profile);
      } else {
        await employerProfileService.createProfile(profile);
        setProfileExists(true);
      }
      setProfileSuccess(t('employerDashboard.profile.success.saved'));
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch {
      setProfileError(t('employerDashboard.companyProfile.saveError'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCloseJob = async (jobId: string) => {
    try {
      await employerService.closeJobPosting(jobId);
      fetchMyJobs();
    } catch { /* ignore */ }
  };

  const handleUpdateStatus = async (appId: string, newStatus: string) => {
    setStatusUpdating(appId);
    try {
      await applicationService.updateStatus(appId, newStatus);
      if (selectedVacancyId) await fetchApplications(selectedVacancyId);
    } catch { /* ignore */ }
    finally { setStatusUpdating(null); }
  };

  const [fireConfirmId, setFireConfirmId] = useState<string | null>(null);

  const handleFireEmployee = async (appId: string) => {
    setFireConfirmId(null);
    setStatusUpdating(appId);
    try {
      await employmentService.fireByApplicationID(appId);
      await applicationService.updateStatus(appId, 'rejected');
      if (selectedVacancyId) await fetchApplications(selectedVacancyId);
    } catch { /* ignore */ }
    finally { setStatusUpdating(null); }
  };

  const activeJobsCount = myJobs.filter(j => j.status === 'active').length;
  const companyName = profileExists && profile.company_name ? profile.company_name : 'Компания';
  const companyColor = getCompanyColor(companyName);

  const statusLabel = (s: string) => {
    const key = `candidate.status.${s}`;
    const translated = t(key);
    return translated !== key ? translated : s;
  };

  const tabs = [
    { key: 'overview' as const,      label: t('employerDashboard.tabs.overview') },
    { key: 'jobs' as const,          label: t('employerDashboard.tabs.jobs'),         badge: myJobs.length || undefined },
    { key: 'applications' as const,  label: t('employerDashboard.tabs.applications'), badge: applications.length || undefined },
    { key: 'profile' as const,       label: t('employerDashboard.tabs.profile') },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-13 h-13 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0 w-12 h-12" style={{ background: companyColor }}>
            {companyName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('employerDashboard.title')}</h1>
            <p className="text-sm text-gray-500">
              {profileExists && profile.company_name ? profile.company_name : 'Manage your jobs & applications'} · {t('employerDashboard.updatedNow', { defaultValue: 'обновлено сейчас' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowJobForm(true); setFormError(''); setFormSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-white font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          {t('employerDashboard.jobs.postNew')}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('employerDashboard.stats.activeJobs'),        val: String(activeJobsCount),                                              delta: null, tone: 'blue',   icon: 'clipboard-list' as IconName },
          { label: t('employerDashboard.stats.totalApplications'), val: String(applications.length),                                         delta: null, tone: 'indigo', icon: 'send'           as IconName },
          { label: t('employerDashboard.stats.interviews'),        val: String(applications.filter(a => a.status === 'interview').length),    delta: null, tone: 'purple', icon: 'calendar'       as IconName },
          { label: t('employerDashboard.stats.offers'),            val: String(applications.filter(a => a.status === 'offered').length),      delta: null, tone: 'green',  icon: 'check-circle'   as IconName },
        ].map((s, i) => {
          const toneMap: Record<string, { bg: string; fg: string }> = {
            blue:   { bg: '#EFF6FF', fg: '#2563EB' },
            indigo: { bg: '#EEF2FF', fg: '#4F46E5' },
            purple: { bg: '#F5F3FF', fg: '#7C3AED' },
            green:  { bg: '#ECFDF5', fg: '#047857' },
          };
          const tone = toneMap[s.tone];
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: tone.bg, color: tone.fg }}>
                  <Icon name={s.icon} size={20} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">{tab.badge}</span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Hiring funnel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-4">{t('employerDashboard.overview.hiringFunnel')}</h3>
              <div className="space-y-3">
                {(() => {
                  const total = allApplications.length;
                  const maxN = total || 1;
                  const reviewN = allApplications.filter(a => a.status === 'applied' || a.status === 'shortlisted').length;
                  const interviewN = allApplications.filter(a => a.status === 'interview').length;
                  const offeredN = allApplications.filter(a => a.status === 'offered').length;
                  return [
                    { label: t('employerDashboard.funnel.submitted'),  n: total,      color: '#2563EB' },
                    { label: t('employerDashboard.funnel.review'),     n: reviewN,    color: '#F59E0B' },
                    { label: t('employerDashboard.funnel.interview'),  n: interviewN, color: '#7C3AED' },
                    { label: t('employerDashboard.funnel.offered'),    n: offeredN,   color: '#10B981' },
                  ].map((r, i) => {
                    const pct = r.n > 0 ? Math.max((r.n / maxN) * 100, 5) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-24 sm:w-32 shrink-0 truncate">{r.label}</span>
                        <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                          <div className="h-full rounded-md flex items-center px-2.5 text-white text-xs font-semibold transition-all" style={{ width: `${pct}%`, background: r.color }}>
                            {r.n}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Recent applications */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-4">{t('employerDashboard.overview.recentApplications', { defaultValue: 'Последние заявки' })}</h3>
              {allApplications.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">{t('employerDashboard.applications.selectToView')}</p>
              ) : (
                <div className="space-y-2">
                  {allApplications.slice(0, 3).map(app => {
                    const name = app.student ? `${app.student.first_name} ${app.student.last_name}`.trim() || 'Студент' : 'Студент';
                    const bg = statusBg[app.status] || '#EFF6FF';
                    const fg = statusFg[app.status] || '#1D4ED8';
                    const dot = statusDotColor[app.status] || '#2563EB';
                    return (
                      <button
                        key={app.id}
                        onClick={() => { setActiveTab('applications'); }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left border border-gray-100"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-sm" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
                          <p className="text-xs text-gray-500">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: bg, color: fg }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
                          {statusLabel(app.status)}
                        </span>
                        {app.match_score > 0 && <MatchIndex percentage={app.match_score} size="sm" showLabel={false} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {/* Top vacancies */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3">{t('employerDashboard.overview.topJobs', { defaultValue: 'Топ-вакансии' })}</h3>
              {myJobs.length === 0 ? (
                <p className="text-sm text-gray-500">{t('employerDashboard.jobs.empty')}</p>
              ) : (
                myJobs.slice(0, 3).map((j, i) => (
                  <div key={j.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 border-gray-100">
                    <span className="text-sm font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{j.title}</p>
                      <p className="text-[11px] text-gray-500">{j.status === 'active' ? t('employerDashboard.jobs.statusActive') : t('employerDashboard.jobs.statusClosed')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Company profile quick-fill prompt */}
            {!profileExists && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                <p className="text-sm text-amber-800 font-medium mb-3">{t('employerDashboard.overview.fillProfilePrompt')}</p>
                <button onClick={() => setActiveTab('profile')} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600">
                  {t('employerDashboard.overview.fillProfileBtn')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vacancies ── */}
      {activeTab === 'jobs' && (
        <div className="space-y-5">
          {jobsLoading && <p className="text-gray-500 text-center py-8">{t('employerDashboard.jobs.loading')}</p>}
          {jobsError && <p className="text-red-600 text-center py-4">{jobsError}</p>}
          {!jobsLoading && !jobsError && myJobs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">{t('employerDashboard.jobs.empty')}</p>
              <p className="text-sm mt-1">{t('employerDashboard.jobs.emptyHint')}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myJobs.map(job => (
              <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${job.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {job.status === 'active' ? <><Icon name="check" size={10} className="inline mr-0.5" />{t('employerDashboard.jobs.statusActive')}</> : t('employerDashboard.jobs.statusClosed')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {job.location && `${job.location} · `}{job.job_type}
                      {(job.salary_min > 0 || job.salary_max > 0) && ` · ${job.salary_min > 0 ? job.salary_min.toLocaleString() : ''}${job.salary_min > 0 && job.salary_max > 0 ? ' – ' : ''}${job.salary_max > 0 ? job.salary_max.toLocaleString() + ' ₸' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {job.status === 'active' && (
                      <button onClick={() => handleCloseJob(job.id)} className="text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"><Icon name="x" size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-base font-bold text-gray-900">{vacancyAppCounts[job.id] ?? '—'}</p>
                    <p className="text-[10px] text-gray-500">{t('employerDashboard.jobs.viewApplications')}</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 text-xs">{new Date(job.created_at).toLocaleDateString('ru-RU')}</p>
                    <p className="text-[10px] text-gray-500">{t('employerDashboard.jobs.published')}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedVacancyId(job.id); setActiveTab('applications'); }}
                  className="mt-3 w-full py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  {t('employerDashboard.jobs.viewApplications')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Applications ── */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Vacancy selector + filter bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
            {jobsLoading ? (
              <p className="text-gray-500 text-sm">{t('employerDashboard.jobs.loading')}</p>
            ) : (
              <select
                value={selectedVacancyId}
                onChange={e => setSelectedVacancyId(e.target.value)}
                className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none text-gray-700 max-w-xs"
              >
                <option value="">{t('employerDashboard.applications.selectVacancyPlaceholder')}</option>
                {myJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.status === 'active' ? t('employerDashboard.applications.vacancyActive') : t('employerDashboard.applications.vacancyClosed')})
                  </option>
                ))}
              </select>
            )}
          </div>

          {!selectedVacancyId && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">{t('employerDashboard.applications.selectToView')}</p>
            </div>
          )}

          {selectedVacancyId && appsLoading && <p className="text-gray-500 text-center py-8">{t('employerDashboard.applications.loading')}</p>}
          {selectedVacancyId && appsError && <p className="text-red-600 text-center py-4">{appsError}</p>}
          {selectedVacancyId && !appsLoading && !appsError && applications.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">{t('employerDashboard.applications.empty')}</p>
            </div>
          )}

          {applications.map(app => {
            const name = app.student ? `${app.student.first_name} ${app.student.last_name}`.trim() || 'Студент' : 'Студент';
            const bg = statusBg[app.status] || '#EFF6FF';
            const fg = statusFg[app.status] || '#1D4ED8';
            const dot = statusDotColor[app.status] || '#2563EB';
            const skills = parseSkills(app.student?.skills);
            return (
              <div key={app.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                  {name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{name}</p>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: bg, color: fg }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
                      {statusLabel(app.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skills.slice(0, 3).map(s => (
                        <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{s}</span>
                      ))}
                      {skills.length > 3 && <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">+{skills.length - 3}</span>}
                    </div>
                  )}
                  {app.cover_letter && (
                    <p className="text-xs text-gray-500 mt-2 italic line-clamp-1">«{app.cover_letter}»</p>
                  )}
                </div>
                {app.match_score > 0 && <MatchIndex percentage={app.match_score} size="sm" showLabel={false} />}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleUpdateStatus(app.id, 'interview')}
                    disabled={statusUpdating === app.id || app.status === 'interview'}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                    style={{ background: '#F5F3FF', color: '#6D28D9' }}
                  >
                    <Icon name="calendar" size={12} className="inline mr-1" />{t('employerDashboard.applications.toInterview')}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(app.id, 'offered')}
                    disabled={statusUpdating === app.id || app.status === 'offered'}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                    style={{ background: '#ECFDF5', color: '#047857' }}
                  >
                    <Icon name="check" size={12} className="inline mr-1" />{t('employerDashboard.applications.accept')}
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(app.id, 'rejected')}
                    disabled={statusUpdating === app.id || app.status === 'rejected'}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                    style={{ background: '#FEF2F2', color: '#B91C1C' }}
                  >
                    <Icon name="x" size={12} className="inline mr-1" />{t('employerDashboard.applications.reject')}
                  </button>
                  {app.status === 'offered' && fireConfirmId !== app.id && (
                    <button
                      onClick={() => setFireConfirmId(app.id)}
                      disabled={statusUpdating === app.id}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                      style={{ background: '#FFF7ED', color: '#C2410C' }}
                    >
                      <Icon name="x" size={12} className="inline mr-1" />{t('employerDashboard.applications.fire')}
                    </button>
                  )}
                  {fireConfirmId === app.id && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: '#FFF7ED', color: '#C2410C' }}>
                      {t('employerDashboard.applications.fireConfirm')}
                      <button
                        onClick={() => handleFireEmployee(app.id)}
                        disabled={statusUpdating === app.id}
                        className="underline hover:no-underline disabled:opacity-50"
                      >{t('employerDashboard.applications.yes')}</button>
                      <span className="text-gray-400">/</span>
                      <button onClick={() => setFireConfirmId(null)} className="text-gray-500 hover:text-gray-700">{t('employerDashboard.applications.no')}</button>
                    </span>
                  )}
                  <button
                    onClick={() => setChatApp({
                      id: app.id,
                      studentName: app.student
                        ? `${app.student.first_name} ${app.student.last_name}`.trim() || t('chat.student')
                        : t('chat.student'),
                    })}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700"
                  >
                    <Icon name="chat" size={12} className="inline mr-1" />{t('chat.open')}
                  </button>
                  {app.student_id && (
                    <button
                      onClick={() => navigate(`/candidate/${app.student_id}`, {
                        state: { applicationId: app.id, matchScore: app.match_score, status: app.status, vacancyId: app.vacancy_id },
                      })}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {t('employerDashboard.applications.viewProfile')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {chatApp && (
            <ChatModal
              applicationId={chatApp.id}
              otherPartyName={chatApp.studentName}
              onClose={() => setChatApp(null)}
            />
          )}
        </div>
      )}

      {/* ── Company Profile ── */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('employerDashboard.companyProfile.title')}</h2>
            <p className="text-sm text-gray-500">
              {profileExists ? t('employerDashboard.companyProfile.updateSubtitle') : t('employerDashboard.companyProfile.createSubtitle')}
            </p>
          </div>

          {profileLoading && <p className="text-gray-500 py-8 text-center">{t('employerDashboard.companyProfile.loading')}</p>}

          {!profileLoading && (
            <>
              {profileError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{profileError}</div>}
              {profileSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">{profileSuccess}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.binLabel')}</label>
                  <div className="relative">
                    <input type="text" name="bin" value={profile.bin} onChange={handleProfileChange}
                      placeholder={t('employerDashboard.companyProfile.binPlaceholder')} maxLength={12} inputMode="numeric"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-32" />
                    {profile.bin_status === 'verified' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">{t('employerDashboard.companyProfile.binVerified')}</span>
                    )}
                    {profile.bin_status === 'pending' && profile.bin && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">{t('employerDashboard.companyProfile.binPending')}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.companyName')}</label>
                  <input type="text" name="company_name" value={profile.company_name} onChange={handleProfileChange}
                    placeholder={t('employerDashboard.companyProfile.companyNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.description')}</label>
                  <textarea name="company_description" value={profile.company_description} onChange={handleProfileChange}
                    placeholder={t('employerDashboard.companyProfile.descriptionPlaceholder')} rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.industry')}</label>
                    <select name="industry" value={profile.industry} onChange={handleProfileChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{t('employerDashboard.companyProfile.industryPlaceholder')}</option>
                      {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.companySize')}</label>
                    <select name="company_size" value={profile.company_size} onChange={handleProfileChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">{t('employerDashboard.companyProfile.companySizePlaceholder')}</option>
                      {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} {t('employerDashboard.companyProfile.employees')}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.location')}</label>
                    <input type="text" name="location" value={profile.location} onChange={handleProfileChange}
                      placeholder={t('employerDashboard.companyProfile.locationPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.website')}</label>
                    <input type="url" name="website" value={profile.website} onChange={handleProfileChange}
                      placeholder="https://company.kz"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.contactEmail')}</label>
                    <input type="email" name="contact_email" value={profile.contact_email} onChange={handleProfileChange}
                      placeholder="hr@company.kz"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.companyProfile.contactPhone')}</label>
                    <input type="tel" name="contact_phone" value={profile.contact_phone} onChange={handleProfileChange}
                      placeholder="+7 (777) 000-00-00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <button onClick={handleSaveProfile} disabled={profileSaving}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {profileSaving ? t('employerDashboard.companyProfile.saving') : profileExists ? t('employerDashboard.companyProfile.update') : t('employerDashboard.companyProfile.create')}
              </button>
            </>
          )}
        </div>
      )}


      {/* Job Posting Modal */}
      {showJobForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t('employerDashboard.jobModal.title')}</h2>
              <button onClick={() => { setShowJobForm(false); setFormData(emptyForm); setFormError(''); setFormSuccess(''); }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"><Icon name="x" size={16} /></button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[80dvh] sm:max-h-[70vh] space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}
              {formSuccess && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">{formSuccess}</div>}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.titleLabel')}</label>
                <input type="text" name="title" value={formData.title} onChange={handleFormChange}
                  placeholder={t('employerDashboard.jobModal.titlePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.descriptionLabel')}</label>
                <textarea name="description" value={formData.description} onChange={handleFormChange}
                  placeholder={t('employerDashboard.jobModal.descriptionPlaceholder')} rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.locationLabel')}</label>
                <input type="text" name="location" value={formData.location} onChange={handleFormChange}
                  placeholder={t('employerDashboard.jobModal.locationPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.jobTypeLabel')}</label>
                <select name="job_type" value={formData.job_type} onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.minSalaryLabel')}</label>
                  <input type="number" name="salary_min" value={formData.salary_min} onChange={handleFormChange}
                    placeholder="300000" min={0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.maxSalaryLabel')}</label>
                  <input type="number" name="salary_max" value={formData.salary_max} onChange={handleFormChange}
                    placeholder="500000" min={0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('employerDashboard.jobModal.skillsLabel')}</label>
                <input type="text" name="skills" value={formData.skills} onChange={handleFormChange}
                  placeholder={t('employerDashboard.jobModal.skillsPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">{t('employerDashboard.jobModal.skillsHint')}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setShowJobForm(false); setFormData(emptyForm); setFormError(''); setFormSuccess(''); }}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg">
                {t('employerDashboard.jobModal.cancel')}
              </button>
              <button onClick={handleSubmitJob} disabled={submitting}
                className="px-5 py-2 text-sm text-white font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {submitting ? t('employerDashboard.jobModal.submitting') : t('employerDashboard.jobModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerDashboardPage;
