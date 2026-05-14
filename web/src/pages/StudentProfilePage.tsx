import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { ChatModal } from '../components';
import { useAuth } from '../context';

const MIN_STUDENT_AGE = 16;

function validateIIN(iin: string, t: (key: string) => string): string | null {
  if (iin.length !== 12 || !/^\d{12}$/.test(iin)) return t('profile.iinError.format');
  const d = iin.split('').map(Number);
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let sum = w1.reduce((acc, w, i) => acc + d[i] * w, 0);
  let check = sum % 11;
  if (check === 10) {
    const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
    sum = w2.reduce((acc, w, i) => acc + d[i] * w, 0);
    check = sum % 11;
  }
  if (check === 10 || check !== d[11]) return t('profile.iinError.checksum');
  const yy = d[0] * 10 + d[1];
  const mm = d[2] * 10 + d[3];
  const dd = d[4] * 10 + d[5];
  const century = d[6];
  let fullYear: number;
  if (century === 1 || century === 2) fullYear = 1800 + yy;
  else if (century === 3 || century === 4) fullYear = 1900 + yy;
  else if (century === 5 || century === 6) fullYear = 2000 + yy;
  else return t('profile.iinError.format');
  const birthDate = new Date(fullYear, mm - 1, dd);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const notYetHadBirthday = today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (notYetHadBirthday) age--;
  if (age < MIN_STUDENT_AGE) return t('profile.iinError.tooYoung');
  return null;
}

import { applicationService, type Application } from '../services/applicationService';
import { EDUCATIONAL_PROGRAMS, PROGRAM_I18N_KEY } from '../constants/programs';
import { apiFetch } from '../utils/apiClient';
import { getUniversities, type University } from '../services/universityService';
import { documentService, type Document, type DocumentType, getTypeKey } from '../services/documentService';
import MatchIndex from '../components/MatchIndex';

type TabType = 'profile' | 'applications' | 'documents';

interface FormData {
  first_name: string; last_name: string; iin: string; phone: string;
  location_city: string; specialization: string; graduation_year: string;
  gpa: string; bio: string; skills: string; university_id: string; github_url: string;
}

const emptyForm: FormData = {
  first_name: '', last_name: '', iin: '', phone: '', location_city: '',
  specialization: '', graduation_year: '', gpa: '', bio: '', skills: '', university_id: '', github_url: '',
};

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700', interview: 'bg-purple-100 text-purple-700',
  shortlisted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', offered: 'bg-yellow-100 text-yellow-700',
};

const DOC_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', verified: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

const StudentProfilePage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const openedFromUrl = useRef(false);

  const STATUS_LABELS: Record<string, string> = {
    applied: t('profile.status.applied'), interview: t('profile.status.interview'),
    shortlisted: t('profile.status.shortlisted'), rejected: t('profile.status.rejected'), offered: t('profile.status.offered'),
  };

  const DOC_STATUS_CONFIG = {
    pending:  { label: t('profile.docStatus.pending'),  cls: DOC_STATUS_CLASSES.pending },
    verified: { label: t('profile.docStatus.verified'), cls: DOC_STATUS_CLASSES.verified },
    rejected: { label: t('profile.docStatus.rejected'), cls: DOC_STATUS_CLASSES.rejected },
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = DOC_STATUS_CONFIG[status as keyof typeof DOC_STATUS_CONFIG] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
    return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
  };

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [profile, setProfile] = useState<BackendStudentProfile | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [vacancyMap, setVacancyMap] = useState<Record<string, { title: string; company_name: string }>>({});
  const [chatAppId, setChatAppId] = useState<string | null>(null);
  const [chatCompanyName, setChatCompanyName] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openChatForApp = async (app: Application) => {
    setChatAppId(app.id);
    if (vacancyMap[app.vacancy_id]) {
      setChatCompanyName(vacancyMap[app.vacancy_id].company_name || t('chat.employer'));
      return;
    }
    try {
      const res = await apiFetch(`/api/vacancies/${app.vacancy_id}`);
      if (res.ok) { const v = await res.json(); setChatCompanyName(v.company_name || t('chat.employer')); }
      else setChatCompanyName(t('chat.employer'));
    } catch { setChatCompanyName(t('chat.employer')); }
  };

  useEffect(() => { getUniversities().then(setUniversities); }, []);

  useEffect(() => {
    const load = async () => {
      setProfileLoading(true);
      try {
        const p = await studentService.getProfile();
        setProfile(p);
        setProfileExists(true);
        setFormData({
          first_name: p.first_name, last_name: p.last_name, iin: p.iin,
          phone: p.phone || '', location_city: p.location_city || '',
          specialization: p.specialization || '', graduation_year: p.graduation_year ? String(p.graduation_year) : '',
          gpa: p.gpa ? String(p.gpa) : '', bio: p.bio || '', skills: p.skills || '',
          university_id: p.university_id || '', github_url: p.github_url || '',
        });
      } catch {
        setProfileExists(false);
        setIsCreating(true);
        setFormData({
          ...emptyForm,
          first_name: localStorage.getItem('reg_first_name') ?? '',
          last_name: localStorage.getItem('reg_last_name') ?? '',
          university_id: localStorage.getItem('reg_university_id') ?? user?.university_id ?? '',
        });
      } finally {
        setProfileLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => { if (searchParams.get('openChat')) setActiveTab('applications'); }, []);

  useEffect(() => {
    if (openedFromUrl.current) return;
    const openChatId = searchParams.get('openChat');
    if (!openChatId || applications.length === 0) return;
    const app = applications.find(a => a.id === openChatId);
    if (app) { openedFromUrl.current = true; openChatForApp(app); }
  }, [applications]);

  useEffect(() => {
    if (activeTab === 'applications') {
      setAppsLoading(true);
      applicationService.getMyApplications()
        .then(apps => {
          setApplications(apps);
          const uniqueIds = [...new Set(apps.map(a => a.vacancy_id))];
          Promise.all(
            uniqueIds.map(id =>
              apiFetch(`/api/vacancies/${id}`)
                .then(r => r.ok ? r.json() : null)
                .then(v => v ? ([id, { title: v.title as string, company_name: v.company_name as string }] as const) : null)
                .catch(() => null)
            )
          ).then(results => {
            const map: Record<string, { title: string; company_name: string }> = {};
            results.forEach(r => { if (r) map[r[0]] = r[1]; });
            setVacancyMap(map);
          });
        })
        .catch(() => setApplications([]))
        .finally(() => setAppsLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'documents') {
      setDocsLoading(true);
      documentService.listMy().then(setDocuments).catch(() => toast.error(t('profile.documents.loadError'))).finally(() => setDocsLoading(false));
    }
  }, [activeTab]);

  const handleUploadClick = (type: DocumentType) => { setUploadingType(type); fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;
    e.target.value = '';
    try {
      const doc = await documentService.upload(file, uploadingType);
      setDocuments(prev => [doc, ...prev]);
      toast.success(t('profile.documents.uploadSuccess', { type: t(getTypeKey(uploadingType)) }));
    } catch { toast.error(t('profile.documents.uploadError')); }
    finally { setUploadingType(null); }
  };

  const handleDeleteDoc = async (id: string) => {
    try { await documentService.delete(id); setDocuments(prev => prev.filter(d => d.id !== id)); toast.success(t('profile.documents.deleteSuccess')); }
    catch { toast.error(t('profile.documents.deleteError')); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const universityName = (id: string) => universities.find(u => u.id === id)?.name ?? '';

  const getSkillsArray = () => formData.skills.split(',').map(s => s.trim()).filter(Boolean);

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    const current = getSkillsArray();
    if (!current.includes(newSkill.trim())) setFormData(prev => ({ ...prev, skills: [...current, newSkill.trim()].join(', ') }));
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData(prev => ({ ...prev, skills: getSkillsArray().filter(s => s !== skill).join(', ') }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        first_name: formData.first_name, last_name: formData.last_name, iin: formData.iin,
        phone: formData.phone, location_city: formData.location_city, specialization: formData.specialization,
        graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : undefined,
        gpa: formData.gpa ? parseFloat(formData.gpa) : undefined,
        bio: formData.bio, skills: formData.skills,
        university_id: formData.university_id || undefined, github_url: formData.github_url || undefined,
      };
      let updated: BackendStudentProfile;
      if (!profileExists) {
        if (!formData.first_name || !formData.last_name || !formData.iin) { toast.error(t('profile.form.requiredFields')); return; }
        const iinError = validateIIN(formData.iin, t);
        if (iinError) { toast.error(iinError); return; }
        updated = await studentService.createProfile(payload as Parameters<typeof studentService.createProfile>[0]);
        setProfileExists(true);
        setIsCreating(false);
        localStorage.removeItem('reg_first_name');
        localStorage.removeItem('reg_last_name');
        localStorage.removeItem('reg_university_id');
      } else {
        updated = await studentService.updateProfile(payload);
      }
      setProfile(updated);
      toast.success(t('profile.toast.saved'));
      setEditMode(false);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      const msg = err instanceof Error ? err.message : '';
      if (status === 409 || msg.toLowerCase().includes('exist') || msg.includes('already')) {
        setProfileExists(true); setIsCreating(false); setEditMode(true);
        toast.error(t('profile.toast.saveError') + t('profile.toast.tryUpdate'));
      } else {
        toast.error(t('profile.toast.saveError'));
      }
    } finally { setSaving(false); }
  };

  if (profileLoading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">{t('profile.loading')}</p></div>;
  }

  const skillsArray = getSkillsArray();

  const completion = (() => {
    if (!profile) return 0;
    const fields = [profile.first_name, profile.last_name, profile.phone, profile.bio, profile.skills, profile.specialization, profile.graduation_year, profile.location_city];
    const filled = fields.filter(f => f && String(f).trim() !== '' && String(f) !== '0').length;
    return Math.round((filled / fields.length) * 100);
  })();

  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : t('profile.title');
  const initials = profile ? (profile.first_name?.charAt(0) || '') + (profile.last_name?.charAt(0) || '') : '?';

  const tabs = [
    { key: 'profile' as const,      label: t('profile.tabs.profile') },
    { key: 'applications' as const, label: t('profile.tabs.applications'), badge: applications.length || undefined },
    { key: 'documents' as const,    label: t('profile.tabs.documents'),    badge: documents.length || undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Profile header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
            {initials || '?'}
          </div>

          <div className="flex-1 min-w-0 w-full">
            {/* Name row + buttons */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{displayName}</h1>
                {profile?.diploma_verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 mt-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    {t('profile.view.diplomaVerified')}
                  </span>
                )}
              </div>
              {profileExists && !isCreating && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => setEditMode(true)} className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                    {t('profile.edit')}
                  </button>
                  <button className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 whitespace-nowrap">
                    {t('profile.downloadResume', { defaultValue: 'Скачать резюме' })}
                  </button>
                </div>
              )}
            </div>

            {/* Specialization / university */}
            {(profile?.specialization || (profile?.university_id && universityName(profile.university_id))) && (
              <p className="text-sm text-gray-600 mt-1 leading-snug">
                {[
                  profile?.specialization,
                  profile?.university_id ? universityName(profile.university_id) : '',
                  profile?.graduation_year ? String(profile.graduation_year) : '',
                ].filter(Boolean).join(' · ')}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 mt-2 flex-wrap">
              {profile?.location_city && <span>📍 {profile.location_city}</span>}
              {profile?.phone && <span>📱 {profile.phone}</span>}
              {profile?.github_url && (
                <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-gray-900">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {profileExists && !isCreating && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-[11px] text-gray-600 mb-0.5">{t('profile.stats.completion')}</p>
              <p className="text-xl font-bold text-blue-600">{completion}%</p>
              <div className="w-full bg-blue-100 rounded-full h-1 mt-1">
                <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${completion}%` }} />
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-[11px] text-gray-600 mb-0.5">{t('profile.tabs.applications')}</p>
              <p className="text-xl font-bold text-purple-700">{applications.length}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-[11px] text-gray-600 mb-0.5">{t('profile.stats.offers', { defaultValue: 'Офферов' })}</p>
              <p className="text-xl font-bold text-green-700">{applications.filter(a => a.status === 'offered').length}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-[11px] text-gray-600 mb-0.5">{t('profile.stats.diploma')}</p>
              <p className="text-xl font-bold text-amber-700">{profile?.diploma_verified ? '✓' : '—'}</p>
            </div>
          </div>
        )}
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
            {activeTab === tab.key && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <>
          {/* View mode */}
          {profileExists && !editMode && !isCreating && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {profile?.bio && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-3">{t('profile.view.about')}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {skillsArray.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-3">{t('profile.view.skills')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {skillsArray.map(skill => (
                        <span key={skill} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact info */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-bold text-gray-900 mb-3">{t('profile.view.contacts', { defaultValue: 'Контакты' })}</h3>
                  <div className="space-y-2 text-sm">
                    {profile?.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('profile.view.phone')}</span>
                        <span className="text-gray-900 font-medium">{profile.phone}</span>
                      </div>
                    )}
                    {profile?.iin && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('profile.view.iin')}</span>
                        <span className="text-gray-900 font-medium">{profile.iin}</span>
                      </div>
                    )}
                    {profile?.location_city && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('profile.form.city')}</span>
                        <span className="text-gray-900 font-medium">{profile.location_city}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {/* Education */}
                {(profile?.university_id || profile?.specialization) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-bold text-gray-900 mb-3">{t('profile.view.education', { defaultValue: 'Образование' })}</h3>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">🎓</div>
                      <div>
                        {profile?.university_id && <p className="font-semibold text-gray-900">{universityName(profile.university_id)}</p>}
                        {profile?.specialization && <p className="text-sm text-gray-500">{profile.specialization}</p>}
                        {(profile?.graduation_year || profile?.gpa) && (
                          <p className="text-xs text-gray-400 mt-1">
                            {profile?.graduation_year ? `${t('profile.view.graduationYear')}: ${profile.graduation_year}` : ''}
                            {profile?.graduation_year && profile?.gpa ? ' · ' : ''}
                            {profile?.gpa ? `GPA ${profile.gpa.toFixed(2)}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Diploma status */}
                <div className={`rounded-xl border p-5 ${profile?.diploma_verified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{profile?.diploma_verified ? '🎓' : '📋'}</span>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        {profile?.diploma_verified ? t('profile.view.diplomaVerified') : t('profile.view.diplomaNotVerified')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {profile?.diploma_verified
                          ? t('profile.view.diplomaVerifiedHint', { date: profile.diploma_verified_at ? new Date(profile.diploma_verified_at).toLocaleDateString('ru-RU') : '' })
                          : t('profile.view.diplomaNotVerifiedHint')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create / Edit form */}
          {(editMode || isCreating) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-5">
              {isCreating && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm font-medium">{t('profile.fillProfile')}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.firstName')}</label>
                  <input name="first_name" value={formData.first_name} onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.lastName')}</label>
                  <input name="last_name" value={formData.last_name} onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.iin')}</label>
                <input name="iin" value={formData.iin} onChange={handleChange} maxLength={12} disabled={profileExists}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.phone')}</label>
                  <input name="phone" value={formData.phone} onChange={handleChange} placeholder="+7 777 123 4567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.city')}</label>
                  <input name="location_city" value={formData.location_city} onChange={handleChange} placeholder={t('profile.form.cityPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  GitHub <span className="text-xs font-normal text-gray-400">{t('profile.form.githubHint')}</span>
                </label>
                <input name="github_url" value={formData.github_url} onChange={handleChange} placeholder="https://github.com/username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.specialization')}</label>
                <select name="specialization" value={formData.specialization} onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">{t('profile.form.specializationPlaceholder')}</option>
                  {EDUCATIONAL_PROGRAMS.map(p => (
                    <option key={p} value={p}>{t(`programNames.${PROGRAM_I18N_KEY[p]}`, p)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.university')}</label>
                <select name="university_id" value={formData.university_id} onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">{t('profile.form.universityNotSet')}</option>
                  {universities.map(u => <option key={u.id} value={u.id}>{u.name} ({u.city})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.graduationYear')}</label>
                  <input name="graduation_year" type="number" value={formData.graduation_year} onChange={handleChange} placeholder="2025" min={2020} max={2030}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.gpa')}</label>
                  <input name="gpa" type="number" value={formData.gpa} onChange={handleChange} placeholder="3.5" min={0} max={4} step={0.01}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.form.bio')}</label>
                <textarea name="bio" value={formData.bio} onChange={handleChange} rows={3} placeholder={t('profile.form.bioPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('profile.form.skills')}</label>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                    placeholder={t('profile.form.addSkillPlaceholder')}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleAddSkill} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">+</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getSkillsArray().map(skill => (
                    <div key={skill} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                      {skill}
                      <button onClick={() => handleRemoveSkill(skill)} className="ml-1 hover:text-blue-900 font-bold">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? t('common.saving') : profileExists ? t('common.save') : t('profile.form.createBtn')}
                </button>
                {profileExists && (
                  <button onClick={() => setEditMode(false)} disabled={saving}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50">
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Applications tab ── */}
      {activeTab === 'applications' && (
        <div className="space-y-3">
          {appsLoading && <p className="text-gray-500 py-8 text-center">{t('common.loading')}</p>}
          {!appsLoading && applications.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">{t('profile.applications.empty')}</p>
              <p className="text-sm mt-1">{t('profile.applications.emptyHint')}</p>
            </div>
          )}
          {applications.map(app => (
            <div key={app.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
              {app.match_score > 0 && <MatchIndex percentage={app.match_score} size="sm" showLabel={false} />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {vacancyMap[app.vacancy_id]?.title ?? `${t('profile.applications.vacancy', { defaultValue: 'Вакансия' })} #${app.vacancy_id?.slice(0, 8)}`}
                </p>
                <p className="text-sm text-gray-500">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                {app.cover_letter && (
                  <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">«{app.cover_letter}»</p>
                )}
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABELS[app.status] || app.status}
              </span>
              <button onClick={() => openChatForApp(app)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" /></svg>
                {t('chat.open')}
              </button>
            </div>
          ))}
          {chatAppId && (
            <ChatModal applicationId={chatAppId} otherPartyName={chatCompanyName || t('chat.employer')} onClose={() => { setChatAppId(null); setChatCompanyName(''); }} />
          )}
        </div>
      )}

      {/* ── Documents tab ── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Upload buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['cv', 'diploma', 'certificate'] as DocumentType[]).map(type => (
              <button key={type} onClick={() => handleUploadClick(type)} disabled={uploadingType !== null}
                className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50">
                <span className="text-3xl">{type === 'cv' ? '📄' : type === 'diploma' ? '🎓' : '📜'}</span>
                <span className="font-medium text-gray-700 text-sm">
                  {uploadingType === type ? t('profile.documents.uploading') : t('profile.documents.upload', { type: t(getTypeKey(type)) })}
                </span>
              </button>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />

          {docsLoading && <p className="text-gray-500 text-center py-8">{t('common.loading')}</p>}
          {!docsLoading && documents.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">{t('profile.documents.noDocuments')}</p>
              <p className="text-sm mt-1">{t('profile.documents.noDocumentsHint')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map(doc => (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0 font-bold text-xs">PDF</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">{(() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })()}</p>
                    {doc.type === 'diploma'
                      ? <StatusBadge status={doc.status} />
                      : <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">✓ {t('candidate.docUploaded')}</span>
                    }
                  </div>
                  <p className="text-xs text-gray-500">{t(getTypeKey(doc.type))} · {(doc.file_size / 1024).toFixed(0)} KB · {new Date(doc.created_at).toLocaleDateString('ru-RU')}</p>
                  {doc.comment && <p className="text-xs text-gray-600 mt-1 italic">{doc.comment}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => documentService.download(doc.id, doc.file_name).catch(() => toast.error(t('profile.documents.downloadError')))}
                    className="text-blue-600 hover:text-blue-700 text-xs font-medium">
                    {t('common.download')}
                  </button>
                  <button onClick={() => handleDeleteDoc(doc.id)} className="text-red-500 hover:text-red-700 text-xs">
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfilePage;
