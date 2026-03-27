import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MatchIndex from '../components/MatchIndex';
import { employerService, type JobPosting } from '../services/employerService';
import { applicationService, type Application } from '../services/applicationService';
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
};

const INDUSTRIES = [
  'Технологии', 'Финансы', 'Образование', 'Здравоохранение',
  'Производство', 'Торговля', 'Консалтинг', 'Медиа', 'Строительство', 'Другое',
];

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

const EmployerDashboardPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'applications' | 'profile'>('overview');
  const [showJobForm, setShowJobForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [myJobs, setMyJobs] = useState<JobPosting[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');

  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState('');
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // Employer Profile state
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
      setJobsError('Не удалось загрузить вакансии');
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
      setAppsError('Не удалось загрузить заявки');
    } finally {
      setAppsLoading(false);
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
      });
      setProfileExists(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404') || msg.includes('not found')) {
        setProfileExists(false);
      } else {
        setProfileError('Не удалось загрузить профиль');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'jobs' || activeTab === 'applications') {
      fetchMyJobs();
    }
    if (activeTab === 'profile') {
      fetchProfile();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'applications' && selectedVacancyId) {
      fetchApplications(selectedVacancyId);
    }
  }, [selectedVacancyId, activeTab]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmitJob = async () => {
    setFormError('');
    setFormSuccess('');
    if (!formData.title.trim() || !formData.description.trim() || !formData.job_type) {
      setFormError('Заполните обязательные поля: название, описание и тип занятости');
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
      setFormSuccess('Вакансия успешно опубликована!');
      setFormData(emptyForm);
      fetchMyJobs();
      setTimeout(() => { setShowJobForm(false); setFormSuccess(''); }, 1500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Ошибка при создании вакансии');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.company_name.trim()) {
      setProfileError('Название компании обязательно');
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
      setProfileSuccess('Профиль компании сохранён!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Ошибка при сохранении');
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

  const activeJobsCount = myJobs.filter((j) => j.status === 'active').length;

  const stats = [
    { label: 'Active Jobs', value: String(activeJobsCount), icon: '📋', color: 'bg-blue-50 text-blue-700' },
    { label: 'Total Applications', value: String(applications.length), icon: '📨', color: 'bg-green-50 text-green-700' },
    { label: 'Interviews', value: String(applications.filter((a) => a.status === 'interview').length), icon: '📅', color: 'bg-purple-50 text-purple-700' },
    { label: 'Offers', value: String(applications.filter((a) => a.status === 'offered').length), icon: '✅', color: 'bg-yellow-50 text-yellow-700' },
  ];

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case 'interview':   return 'bg-purple-100 text-purple-700';
      case 'shortlisted': return 'bg-green-100 text-green-700';
      case 'rejected':    return 'bg-red-100 text-red-700';
      case 'offered':     return 'bg-yellow-100 text-yellow-700';
      default:            return 'bg-blue-100 text-blue-700';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'applied':     return 'Подана';
      case 'interview':   return 'Собеседование';
      case 'shortlisted': return 'В шортлисте';
      case 'rejected':    return 'Отклонена';
      case 'offered':     return 'Оффер';
      default:            return s;
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Employer Dashboard</h1>
        <p className="text-xl text-gray-600">
          {profileExists && profile.company_name ? profile.company_name : 'Manage your jobs, applications, and company'}
        </p>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center text-2xl mb-4`}>
              {stat.icon}
            </div>
            <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {(['overview', 'jobs', 'applications', 'profile'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'profile' ? 'Company Profile' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-8">

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {profileExists && profile.company_name && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                      {profile.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900">{profile.company_name}</h2>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                        {profile.industry && <span>🏭 {profile.industry}</span>}
                        {profile.location && <span>📍 {profile.location}</span>}
                        {profile.company_size && <span>👥 {profile.company_size} сотрудников</span>}
                        {profile.website && (
                          <a href={profile.website} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline">
                            🌐 {profile.website}
                          </a>
                        )}
                      </div>
                      {profile.company_description && (
                        <p className="text-gray-600 mt-3 text-sm">{profile.company_description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!profileExists && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                  <p className="text-yellow-800 font-medium mb-3">
                    Заполните профиль компании, чтобы ваши вакансии выглядели профессионально
                  </p>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
                  >
                    Заполнить профиль →
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Быстрые действия</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => { setActiveTab('jobs'); setShowJobForm(true); }}
                    className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-medium hover:bg-blue-100 transition-colors text-left"
                  >
                    <div className="text-2xl mb-2">📋</div>
                    <div>Опубликовать вакансию</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 font-medium hover:bg-green-100 transition-colors text-left"
                  >
                    <div className="text-2xl mb-2">📨</div>
                    <div>Просмотреть заявки</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 font-medium hover:bg-purple-100 transition-colors text-left"
                  >
                    <div className="text-2xl mb-2">🏢</div>
                    <div>Редактировать профиль</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Jobs */}
          {activeTab === 'jobs' && (
            <div className="space-y-6">
              <button
                onClick={() => { setShowJobForm(true); setFormError(''); setFormSuccess(''); }}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Post New Job
              </button>

              {jobsLoading && <p className="text-gray-500 text-center py-8">Загрузка вакансий...</p>}
              {jobsError && <p className="text-red-600 text-center py-4">{jobsError}</p>}
              {!jobsLoading && !jobsError && myJobs.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">У вас пока нет вакансий</p>
                  <p className="text-sm mt-1">Нажмите «+ Post New Job» чтобы опубликовать первую вакансию</p>
                </div>
              )}

              <div className="space-y-4">
                {myJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {job.status === 'active' ? 'Активна' : 'Закрыта'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          {job.location && <span>📍 {job.location}</span>}
                          <span>💼 {job.job_type}</span>
                          {(job.salary_min > 0 || job.salary_max > 0) && (
                            <span>
                              💰 {job.salary_min > 0 ? `${job.salary_min.toLocaleString()}` : ''}
                              {job.salary_min > 0 && job.salary_max > 0 ? ' – ' : ''}
                              {job.salary_max > 0 ? `${job.salary_max.toLocaleString()} ₸` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2">{job.description}</p>
                        {job.skills && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {job.skills.split(',').map((s) => s.trim()).filter(Boolean).map((skill) => (
                              <span key={skill} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">{skill}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-3">Опубликовано: {new Date(job.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => { setSelectedVacancyId(job.id); setActiveTab('applications'); }}
                          className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium"
                        >
                          Посмотреть заявки
                        </button>
                        {job.status === 'active' && (
                          <button
                            onClick={() => handleCloseJob(job.id)}
                            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium"
                          >
                            Закрыть
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applications */}
          {activeTab === 'applications' && (
            <div className="space-y-6">
              {jobsLoading ? (
                <p className="text-gray-500">Загрузка вакансий...</p>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Выберите вакансию</label>
                  <select
                    value={selectedVacancyId}
                    onChange={(e) => setSelectedVacancyId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-md"
                  >
                    <option value="">-- Выберите вакансию --</option>
                    {myJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} ({job.status === 'active' ? 'активна' : 'закрыта'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!selectedVacancyId && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">Выберите вакансию, чтобы увидеть заявки</p>
                </div>
              )}

              {selectedVacancyId && appsLoading && <p className="text-gray-500 text-center py-8">Загрузка заявок...</p>}
              {selectedVacancyId && appsError && <p className="text-red-600 text-center py-4">{appsError}</p>}
              {selectedVacancyId && !appsLoading && !appsError && applications.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">Заявок пока нет</p>
                </div>
              )}

              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {app.student ? `${app.student.first_name} ${app.student.last_name}`.trim() || 'Студент' : 'Студент'}
                        </h3>
                        {app.student?.skills && (
                          <p className="text-xs text-gray-500 mt-1">Навыки: {app.student.skills}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">Подана: {new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {app.match_score > 0 && (
                          <MatchIndex percentage={app.match_score} size="sm" showLabel={false} />
                        )}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadgeClass(app.status)}`}>
                          {statusLabel(app.status)}
                        </span>
                      </div>
                    </div>

                    {app.cover_letter && (
                      <p className="text-sm text-gray-600 mb-4 bg-white rounded p-3 border border-gray-200">
                        {app.cover_letter}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {app.student_id && (
                        <button
                          onClick={() => navigate(`/candidate/${app.student_id}`, {
                            state: {
                              applicationId: app.id,
                              matchScore: app.match_score,
                              status: app.status,
                              vacancyId: app.vacancy_id,
                            },
                          })}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
                        >
                          Профиль →
                        </button>
                      )}
                      <button onClick={() => handleUpdateStatus(app.id, 'interview')} disabled={statusUpdating === app.id || app.status === 'interview'}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        На собеседование
                      </button>
                      <button onClick={() => handleUpdateStatus(app.id, 'offered')} disabled={statusUpdating === app.id || app.status === 'offered'}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        Принять
                      </button>
                      <button onClick={() => handleUpdateStatus(app.id, 'rejected')} disabled={statusUpdating === app.id || app.status === 'rejected'}
                        className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Profile */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Профиль компании</h2>
                <p className="text-gray-500 text-sm">
                  {profileExists ? 'Обновите информацию о вашей компании' : 'Заполните профиль компании — это повысит доверие студентов к вашим вакансиям'}
                </p>
              </div>

              {profileLoading && <p className="text-gray-500 py-8 text-center">Загрузка...</p>}

              {!profileLoading && (
                <>
                  {profileError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{profileError}</div>
                  )}
                  {profileSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">{profileSuccess}</div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Название компании *</label>
                      <input
                        type="text"
                        name="company_name"
                        value={profile.company_name}
                        onChange={handleProfileChange}
                        placeholder="ТОО «Моя Компания»"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Описание компании</label>
                      <textarea
                        name="company_description"
                        value={profile.company_description}
                        onChange={handleProfileChange}
                        placeholder="Расскажите о компании, чем вы занимаетесь, какова ваша миссия..."
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Отрасль</label>
                        <select
                          name="industry"
                          value={profile.industry}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Выберите отрасль</option>
                          {INDUSTRIES.map((ind) => (
                            <option key={ind} value={ind}>{ind}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Размер компании</label>
                        <select
                          name="company_size"
                          value={profile.company_size}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Выберите размер</option>
                          {COMPANY_SIZES.map((s) => (
                            <option key={s} value={s}>{s} сотрудников</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Город / Местоположение</label>
                        <input
                          type="text"
                          name="location"
                          value={profile.location}
                          onChange={handleProfileChange}
                          placeholder="Алматы, Казахстан"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Веб-сайт</label>
                        <input
                          type="url"
                          name="website"
                          value={profile.website}
                          onChange={handleProfileChange}
                          placeholder="https://company.kz"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Контактный Email</label>
                        <input
                          type="email"
                          name="contact_email"
                          value={profile.contact_email}
                          onChange={handleProfileChange}
                          placeholder="hr@company.kz"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Контактный телефон</label>
                        <input
                          type="tel"
                          name="contact_phone"
                          value={profile.contact_phone}
                          onChange={handleProfileChange}
                          placeholder="+7 (777) 000-00-00"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profileSaving ? 'Сохранение...' : profileExists ? 'Обновить профиль' : 'Создать профиль'}
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Job Posting Form Modal */}
      {showJobForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Post New Job</h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">{formSuccess}</div>
            )}

            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleFormChange}
                  placeholder="e.g., Senior Developer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Job Description *</label>
                <textarea name="description" value={formData.description} onChange={handleFormChange}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input type="text" name="location" value={formData.location} onChange={handleFormChange}
                  placeholder="e.g., Astana, Remote"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Job Type *</label>
                <select name="job_type" value={formData.job_type} onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Min Salary ($)</label>
                  <input type="number" name="salary_min" value={formData.salary_min} onChange={handleFormChange}
                    placeholder="3000" min={0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Max Salary ($)</label>
                  <input type="number" name="salary_max" value={formData.salary_max} onChange={handleFormChange}
                    placeholder="5000" min={0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Required Skills</label>
                <input type="text" name="skills" value={formData.skills} onChange={handleFormChange}
                  placeholder="e.g., React, Node.js, TypeScript"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Разделяйте навыки запятой</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSubmitJob} disabled={submitting}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? 'Публикация...' : 'Post Job'}
              </button>
              <button onClick={() => { setShowJobForm(false); setFormData(emptyForm); setFormError(''); setFormSuccess(''); }}
                disabled={submitting}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerDashboardPage;
