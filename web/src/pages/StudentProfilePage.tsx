import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { studentService, type BackendStudentProfile } from '../services/studentService';

const MIN_STUDENT_AGE = 16;

/** Проверяет казахстанский ИИН (12 цифр, контрольная сумма, возраст ≥ 16) */
function validateIIN(iin: string, t: (key: string) => string): string | null {
  if (iin.length !== 12 || !/^\d{12}$/.test(iin)) {
    return t('profile.iinError.format');
  }
  const d = iin.split('').map(Number);

  // Контрольная сумма
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let sum = w1.reduce((acc, w, i) => acc + d[i] * w, 0);
  let check = sum % 11;
  if (check === 10) {
    const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
    sum = w2.reduce((acc, w, i) => acc + d[i] * w, 0);
    check = sum % 11;
  }
  if (check === 10 || check !== d[11]) {
    return t('profile.iinError.checksum');
  }

  // Возраст: ГГММДД + 7-я цифра (век: 3-4 → 1900-е, 5-6 → 2000-е)
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
  const notYetHadBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (notYetHadBirthday) age--;

  if (age < MIN_STUDENT_AGE) {
    return t('profile.iinError.tooYoung');
  }

  return null;
}
import { applicationService, type Application } from '../services/applicationService';
import { getUniversities, type University } from '../services/universityService';
import { documentService, type Document, type DocumentType, getTypeLabel } from '../services/documentService';
import MatchIndex from '../components/MatchIndex';

type TabType = 'profile' | 'applications' | 'documents';

interface FormData {
  first_name: string;
  last_name: string;
  iin: string;
  phone: string;
  location_city: string;
  specialization: string;
  graduation_year: string;
  gpa: string;
  bio: string;
  skills: string; // comma-separated string for the input
  university_id: string;
  github_url: string;
}

const emptyForm: FormData = {
  first_name: '',
  last_name: '',
  iin: '',
  phone: '',
  location_city: '',
  specialization: '',
  graduation_year: '',
  gpa: '',
  bio: '',
  skills: '',
  university_id: '',
  github_url: '',
};

const STATUS_COLORS: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700',
  interview: 'bg-purple-100 text-purple-700',
  shortlisted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  offered: 'bg-yellow-100 text-yellow-700',
};

const DOC_STATUS_CLASSES: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const StudentProfilePage = () => {
  const { t } = useTranslation();

  const STATUS_LABELS: Record<string, string> = {
    applied: t('profile.status.applied'),
    interview: t('profile.status.interview'),
    shortlisted: t('profile.status.shortlisted'),
    rejected: t('profile.status.rejected'),
    offered: t('profile.status.offered'),
  };

  const DOC_STATUS_CONFIG = {
    pending:  { label: t('profile.docStatus.pending'),   cls: DOC_STATUS_CLASSES.pending },
    verified: { label: t('profile.docStatus.verified'),  cls: DOC_STATUS_CLASSES.verified },
    rejected: { label: t('profile.docStatus.rejected'),  cls: DOC_STATUS_CLASSES.rejected },
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

  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load universities for dropdown
  useEffect(() => {
    getUniversities().then(setUniversities);
  }, []);

  // Load profile on mount
  useEffect(() => {
    const load = async () => {
      setProfileLoading(true);
      try {
        const p = await studentService.getProfile();
        setProfile(p);
        setProfileExists(true);
        setFormData({
          first_name: p.first_name,
          last_name: p.last_name,
          iin: p.iin,
          phone: p.phone || '',
          location_city: p.location_city || '',
          specialization: p.specialization || '',
          graduation_year: p.graduation_year ? String(p.graduation_year) : '',
          gpa: p.gpa ? String(p.gpa) : '',
          bio: p.bio || '',
          skills: p.skills || '',
          university_id: p.university_id || '',
          github_url: p.github_url || '',
        });
      } catch {
        setProfileExists(false);
        setIsCreating(true);
      } finally {
        setProfileLoading(false);
      }
    };
    load();
  }, []);

  // Load applications when tab changes
  useEffect(() => {
    if (activeTab === 'applications') {
      setAppsLoading(true);
      applicationService.getMyApplications()
        .then(setApplications)
        .catch(() => setApplications([]))
        .finally(() => setAppsLoading(false));
    }
  }, [activeTab]);

  // Load documents when tab changes
  useEffect(() => {
    if (activeTab === 'documents') {
      setDocsLoading(true);
      documentService.listMy()
        .then(setDocuments)
        .catch(() => toast.error(t('profile.documents.loadError')))
        .finally(() => setDocsLoading(false));
    }
  }, [activeTab]);

  const handleUploadClick = (type: DocumentType) => {
    setUploadingType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;
    e.target.value = '';
    try {
      const doc = await documentService.upload(file, uploadingType);
      setDocuments(prev => [doc, ...prev]);
      toast.success(t('profile.documents.uploadSuccess', { type: getTypeLabel(uploadingType) }));
    } catch (err) {
      toast.error(t('profile.documents.uploadError'));
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await documentService.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success(t('profile.documents.deleteSuccess'));
    } catch {
      toast.error(t('profile.documents.deleteError'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const universityName = (id: string) =>
    universities.find(u => u.id === id)?.name ?? id;

  const getSkillsArray = () =>
    formData.skills.split(',').map(s => s.trim()).filter(Boolean);

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    const current = getSkillsArray();
    if (!current.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...current, newSkill.trim()].join(', '),
      }));
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: getSkillsArray().filter(s => s !== skill).join(', '),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        iin: formData.iin,
        phone: formData.phone,
        location_city: formData.location_city,
        specialization: formData.specialization,
        graduation_year: formData.graduation_year ? parseInt(formData.graduation_year) : undefined,
        gpa: formData.gpa ? parseFloat(formData.gpa) : undefined,
        bio: formData.bio,
        skills: formData.skills,
        university_id: formData.university_id || undefined,
        github_url: formData.github_url || undefined,
      };

      let updated: BackendStudentProfile;
      if (!profileExists) {
        if (!formData.first_name || !formData.last_name || !formData.iin) {
          toast.error(t('profile.form.requiredFields'));
          return;
        }
        const iinError = validateIIN(formData.iin, t);
        if (iinError) {
          toast.error(iinError);
          return;
        }
        updated = await studentService.createProfile(payload as Parameters<typeof studentService.createProfile>[0]);
        setProfileExists(true);
        setIsCreating(false);
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
        setProfileExists(true);
        setIsCreating(false);
        setEditMode(true);
        toast.error(t('profile.toast.saveError') + t('profile.toast.tryUpdate'));
      } else {
        toast.error(t('profile.toast.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">{t('profile.loading')}</p>
      </div>
    );
  }

  const skillsArray = getSkillsArray();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('profile.title')}</h1>
        <p className="text-xl text-gray-600">{t('profile.subtitle')}</p>
      </section>

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['profile', 'applications', 'documents'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'profile' ? t('profile.tabs.profile') : tab === 'applications' ? t('profile.tabs.applications') : t('profile.tabs.documents')}
            </button>
          ))}
        </div>

        <div className="p-8">
          {/* ===== PROFILE TAB ===== */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl">
              {/* View mode header */}
              {profileExists && !editMode && !isCreating && (
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {profile?.first_name} {profile?.last_name}
                    </h2>
                    {profile?.specialization && (
                      <p className="text-gray-600 mt-1">🎓 {profile.specialization}</p>
                    )}
                    {profile?.university_id && (
                      <p className="text-gray-600">🏫 {universityName(profile.university_id)}</p>
                    )}
                    {profile?.location_city && (
                      <p className="text-gray-600">📍 {profile.location_city}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                  >
                    {t('profile.edit')}
                  </button>
                </div>
              )}

              {/* View mode details */}
              {profileExists && !editMode && !isCreating && (
                <div className="space-y-4">
                  {profile?.bio && (
                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-2">{t('profile.view.about')}</h3>
                      <p className="text-gray-700 text-sm">{profile.bio}</p>
                    </div>
                  )}

                  {/* Diploma verification status */}
                  <div className={`rounded-lg p-4 border flex items-center gap-3 ${profile?.diploma_verified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
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

                  {profile?.github_url && (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors w-fit"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                      GitHub Profile
                    </a>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {profile?.phone && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">{t('profile.view.phone')}</p>
                        <p className="font-medium text-gray-900">{profile.phone}</p>
                      </div>
                    )}
                    {profile?.iin && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">{t('profile.view.iin')}</p>
                        <p className="font-medium text-gray-900">{profile.iin}</p>
                      </div>
                    )}
                    {profile?.graduation_year ? (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">{t('profile.view.graduationYear')}</p>
                        <p className="font-medium text-gray-900">{profile.graduation_year}</p>
                      </div>
                    ) : null}
                    {profile?.gpa ? (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">{t('profile.view.gpa')}</p>
                        <p className="font-medium text-gray-900 text-lg">{profile.gpa.toFixed(2)}</p>
                      </div>
                    ) : null}
                  </div>

                  {skillsArray.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-3">{t('profile.view.skills')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {skillsArray.map(skill => (
                          <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Create/Edit form */}
              {(editMode || isCreating) && (
                <div className="space-y-5">
                  {isCreating && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-800 text-sm font-medium">{t('profile.fillProfile')}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.firstName')}</label>
                      <input
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.lastName')}</label>
                      <input
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.iin')}</label>
                    <input
                      name="iin"
                      value={formData.iin}
                      onChange={handleChange}
                      maxLength={12}
                      disabled={profileExists}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.phone')}</label>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+7 777 123 4567"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.city')}</label>
                      <input
                        name="location_city"
                        value={formData.location_city}
                        onChange={handleChange}
                        placeholder={t('profile.form.cityPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      <span className="inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                        GitHub
                        <span className="text-xs font-normal text-gray-400">{t('profile.form.githubHint')}</span>
                      </span>
                    </label>
                    <input
                      name="github_url"
                      value={formData.github_url}
                      onChange={handleChange}
                      placeholder="https://github.com/username"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.specialization')}</label>
                    <input
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleChange}
                      placeholder={t('profile.form.specializationPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.university')}</label>
                    <select
                      name="university_id"
                      value={formData.university_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">{t('profile.form.universityNotSet')}</option>
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.city})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.graduationYear')}</label>
                      <input
                        name="graduation_year"
                        type="number"
                        value={formData.graduation_year}
                        onChange={handleChange}
                        placeholder="2025"
                        min={2020}
                        max={2030}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.gpa')}</label>
                      <input
                        name="gpa"
                        type="number"
                        value={formData.gpa}
                        onChange={handleChange}
                        placeholder="3.5"
                        min={0}
                        max={4}
                        step={0.01}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('profile.form.bio')}</label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={3}
                      placeholder={t('profile.form.bioPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Skills */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('profile.form.skills')}</label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={newSkill}
                        onChange={e => setNewSkill(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                        placeholder={t('profile.form.addSkillPlaceholder')}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleAddSkill}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getSkillsArray().map(skill => (
                        <div key={skill} className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {skill}
                          <button onClick={() => handleRemoveSkill(skill)} className="ml-1 hover:text-blue-900 font-bold">×</button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{t('profile.form.skillsHint')}</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? t('common.saving') : profileExists ? t('common.save') : t('profile.form.createBtn')}
                    </button>
                    {profileExists && (
                      <button
                        onClick={() => setEditMode(false)}
                        disabled={saving}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== DOCUMENTS TAB ===== */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{t('profile.documents.title')}</h2>
                <p className="text-sm text-gray-500">{t('profile.documents.uploadHint')}</p>
              </div>

              {/* Upload buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['cv', 'diploma', 'certificate'] as DocumentType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => handleUploadClick(type)}
                    disabled={uploadingType !== null}
                    className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-3xl">
                      {type === 'cv' ? '📄' : '📜'}
                    </span>
                    <span className="font-medium text-gray-700">
                      {uploadingType === type ? t('profile.documents.uploading') : t('profile.documents.upload', { type: getTypeLabel(type) })}
                    </span>
                  </button>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Documents list */}
              {docsLoading && <p className="text-gray-500 text-center py-8">{t('common.loading')}</p>}
              {!docsLoading && documents.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">{t('profile.documents.noDocuments')}</p>
                  <p className="text-sm mt-1">{t('profile.documents.noDocumentsHint')}</p>
                </div>
              )}
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {doc.type === 'cv' ? '📄' : doc.type === 'diploma' ? '🎓' : '📜'}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{doc.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {getTypeLabel(doc.type)} · {(doc.file_size / 1024).toFixed(0)} KB · {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                      </p>
                      {doc.comment && (
                        <p className="text-xs text-gray-600 mt-1 italic">Комментарий: {doc.comment}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={doc.status} />
                    <button
                      onClick={() => documentService.download(doc.id, doc.file_name).catch(() => toast.error(t('profile.documents.downloadError')))}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      {t('common.download')}
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== APPLICATIONS TAB ===== */}
          {activeTab === 'applications' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('profile.applications.title')}</h2>
              {appsLoading && <p className="text-gray-500 py-8 text-center">{t('common.loading')}</p>}
              {!appsLoading && applications.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">{t('profile.applications.empty')}</p>
                  <p className="text-sm mt-1">{t('profile.applications.emptyHint')}</p>
                </div>
              )}
              {applications.map(app => (
                <div key={app.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {app.cover_letter && (
                        <p className="text-sm text-gray-600 mt-1 italic">«{app.cover_letter.slice(0, 100)}{app.cover_letter.length > 100 ? '...' : ''}»</p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(app.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    {app.match_score > 0 && (
                      <div className="ml-4">
                        <MatchIndex percentage={app.match_score} size="sm" showLabel={false} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePage;
