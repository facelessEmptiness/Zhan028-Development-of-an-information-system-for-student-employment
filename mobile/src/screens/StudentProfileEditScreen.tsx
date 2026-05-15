import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { studentService, type StudentProfile } from '../services/studentService';
import { applicationService, type Application } from '../services/applicationService';
import { documentService, type Document } from '../services/documentService';
import { jobService } from '../services/jobService';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import LanguageSelector from '../components/LanguageSelector';
import { formatDate } from '../utils/dateUtils';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';

const DOC_TYPE_ICONS: Record<'cv' | 'diploma' | 'certificate', IconName> = {
  cv:          'document',
  diploma:     'graduation-cap',
  certificate: 'certificate',
};

const MIN_STUDENT_AGE = 16;

function validateIIN(iin: string, t: (k: string) => string): string | null {
  if (iin.length !== 12 || !/^\d{12}$/.test(iin)) return t('profileEdit.iinError.format');
  const d = iin.split('').map(Number);
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let sum = w1.reduce((acc, w, i) => acc + d[i] * w, 0);
  let check = sum % 11;
  if (check === 10) {
    const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
    sum = w2.reduce((acc, w, i) => acc + d[i] * w, 0);
    check = sum % 11;
  }
  if (check === 10 || check !== d[11]) return t('profileEdit.iinError.checksum');
  const yy = d[0] * 10 + d[1];
  const mm = d[2] * 10 + d[3];
  const dd = d[4] * 10 + d[5];
  const century = d[6];
  let fullYear: number;
  if (century === 1 || century === 2) fullYear = 1800 + yy;
  else if (century === 3 || century === 4) fullYear = 1900 + yy;
  else if (century === 5 || century === 6) fullYear = 2000 + yy;
  else return t('profileEdit.iinError.format');
  const birthDate = new Date(fullYear, mm - 1, dd);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const notYetBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (notYetBirthday) age--;
  if (age < MIN_STUDENT_AGE) return t('profileEdit.iinError.tooYoung');
  return null;
}

const PROFILE_FIELDS: (keyof StudentProfile)[] = [
  'first_name', 'last_name', 'iin', 'phone',
  'location_city', 'specialization', 'graduation_year', 'gpa', 'bio', 'skills',
];

function calcCompletion(p: StudentProfile | null): number {
  if (!p) return 0;
  const filled = PROFILE_FIELDS.filter(f => Boolean((p as any)[f])).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

const STATUS_COLORS: Record<string, string> = {
  applied: '#3B82F6', review: '#8B5CF6', shortlisted: '#F59E0B',
  interview: '#6366F1', offered: '#10B981', rejected: '#EF4444',
};

const DOC_TYPE_COLORS = { cv: '#3B82F6', diploma: '#059669', certificate: '#F59E0B' };

type FormData = {
  first_name: string; last_name: string; iin: string; phone: string;
  location_city: string; specialization: string; graduation_year: string;
  gpa: string; bio: string; skills: string; github_url: string;
};

const emptyForm: FormData = {
  first_name: '', last_name: '', iin: '', phone: '',
  location_city: '', specialization: '', graduation_year: '',
  gpa: '', bio: '', skills: '', github_url: '',
};

type TabType = 'profile' | 'applications' | 'documents';

export default function StudentProfileEditScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const route      = useRoute<any>();
  const navigation = useNavigation<any>();

  const [tab,      setTab]      = useState<TabType>('profile');
  const [form,     setForm]     = useState<FormData>(emptyForm);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [exists,   setExists]   = useState(false);
  const [profile,  setProfile]  = useState<StudentProfile | null>(null);

  // Applications tab
  const [apps,        setApps]        = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // Documents tab
  const [docs,        setDocs]        = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading,   setUploading]   = useState(false);

  useEffect(() => {
    studentService.getProfile()
      .then(p => {
        setProfile(p);
        setExists(true);
        setForm({
          first_name:      p.first_name      ?? '',
          last_name:       p.last_name       ?? '',
          iin:             p.iin             ?? '',
          phone:           p.phone           ?? '',
          location_city:   p.location_city   ?? '',
          specialization:  p.specialization  ?? '',
          graduation_year: p.graduation_year ? String(p.graduation_year) : '',
          gpa:             p.gpa             ? String(p.gpa)             : '',
          bio:             p.bio             ?? '',
          skills:          p.skills          ?? '',
          github_url:      p.github_url      ?? '',
        });
      })
      .catch(() => setExists(false))
      .finally(() => setLoading(false));
  }, []);

  const loadApps = useCallback(async () => {
    setAppsLoading(true);
    try { setApps(await applicationService.getMyApplications()); }
    catch { setApps([]); }
    finally { setAppsLoading(false); }
  }, []);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    try { setDocs(await documentService.getMyDocuments()); }
    catch { setDocs([]); }
    finally { setDocsLoading(false); }
  }, []);

  const handleTabChange = (next: TabType) => {
    setTab(next);
    if (next === 'applications' && apps.length === 0) loadApps();
    if (next === 'documents'    && docs.length === 0) loadDocs();
  };

  useEffect(() => {
    const initialTab = route.params?.initialTab as TabType | undefined;
    if (initialTab && (initialTab === 'profile' || initialTab === 'applications' || initialTab === 'documents')) {
      handleTabChange(initialTab);
    }
  }, [route.params?.initialTab]);

  const set = (key: keyof FormData) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      Alert.alert(t('common.error'), t('profileEdit.error.name'));
      return;
    }
    if (form.iin.trim()) {
      const iinError = validateIIN(form.iin.trim(), t);
      if (iinError) { Alert.alert(t('common.error'), iinError); return; }
    }
    setSaving(true);
    try {
      const payload = {
        first_name:      form.first_name.trim(),
        last_name:       form.last_name.trim(),
        iin:             form.iin.trim() || undefined,
        phone:           form.phone.trim() || undefined,
        location_city:   form.location_city.trim() || undefined,
        specialization:  form.specialization.trim() || undefined,
        graduation_year: form.graduation_year ? parseInt(form.graduation_year) : undefined,
        gpa:             form.gpa ? parseFloat(form.gpa) : undefined,
        bio:             form.bio.trim() || undefined,
        skills:          form.skills.trim() || undefined,
        github_url:      form.github_url.trim() || undefined,
      };
      const saved = exists
        ? await studentService.updateProfile(payload)
        : await studentService.createProfile(payload);
      setProfile(saved);
      setExists(true);
      Alert.alert(t('common.success'), t('profileEdit.saved'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profileEdit.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDoc = async (docType: 'cv' | 'diploma' | 'certificate') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const doc = await documentService.uploadDocument(
        asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', docType,
      );
      setDocs(prev => [doc, ...prev.filter(d => d.type !== docType)]);
      Alert.alert(t('common.success'), t('docs.uploadSuccess', { type: t(`docs.types.${docType}`) }));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('docs.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = (doc: Document) => {
    Alert.alert(
      t('docs.delete.title'),
      t('docs.delete.confirm', { type: t(`docs.types.${doc.type}`), name: doc.file_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('docs.delete.btn'), style: 'destructive', onPress: async () => {
          try {
            await documentService.deleteDocument(doc.id);
            setDocs(prev => prev.filter(d => d.id !== doc.id));
          } catch { Alert.alert(t('common.error'), t('docs.deleteError')); }
        }},
      ],
    );
  };

  const handleOpenVacancy = async (vacancyId: string) => {
    try {
      const vacancy = await jobService.getById(vacancyId);
      navigation.navigate('Home', {
        screen: 'JobDetail',
        params: { vacancy },
      });
    } catch {
      Alert.alert(t('common.error'), t('jobs.notFound'));
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  const completion = calcCompletion(profile);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['profile', 'applications', 'documents'] as TabType[]).map(t2 => (
          <TouchableOpacity
            key={t2}
            style={[styles.tabItem, tab === t2 && styles.tabItemActive]}
            onPress={() => handleTabChange(t2)}
          >
            <Text style={[styles.tabText, tab === t2 && styles.tabTextActive]}>
              {t(`profileEdit.tabs.${t2}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'profile' && (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Profile completion */}
          <View style={styles.completionCard}>
            <View style={styles.completionRow}>
              <Text style={styles.completionLabel}>{t('profileEdit.completion')}</Text>
              <Text style={[styles.completionPct, { color: completion >= 80 ? '#10B981' : completion >= 50 ? '#F59E0B' : '#EF4444' }]}>
                {completion}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${completion}%` as any,
                backgroundColor: completion >= 80 ? '#10B981' : completion >= 50 ? '#F59E0B' : '#EF4444',
              }]} />
            </View>
          </View>

          {profile?.diploma_verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>{t('profileEdit.diplomaVerified')}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profileEdit.personalData')}</Text>
            <Field label={t('profileEdit.firstName')}  value={form.first_name}    onChangeText={set('first_name')}    placeholder="Иван" />
            <Field label={t('profileEdit.lastName')}   value={form.last_name}     onChangeText={set('last_name')}     placeholder="Иванов" />
            <Field label={t('profileEdit.iin')}        value={form.iin}           onChangeText={set('iin')}           placeholder="12 цифр" keyboardType="numeric" maxLength={12} />
            <Field label={t('profileEdit.phone')}      value={form.phone}         onChangeText={set('phone')}         placeholder="+7 700 000 0000" keyboardType="phone-pad" />
            <Field label={t('profileEdit.city')}       value={form.location_city} onChangeText={set('location_city')} placeholder="Алматы" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profileEdit.education')}</Text>
            <Field label={t('profileEdit.specialization')}  value={form.specialization}  onChangeText={set('specialization')}  placeholder="Информационные системы" />
            <Field label={t('profileEdit.graduationYear')}  value={form.graduation_year} onChangeText={set('graduation_year')} placeholder="2025" keyboardType="numeric" maxLength={4} />
            <Field label={t('profileEdit.gpa')}             value={form.gpa}             onChangeText={set('gpa')}             placeholder="3.5" keyboardType="decimal-pad" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profileEdit.additional')}</Text>
            <Field label={t('profileEdit.skills')}    value={form.skills}     onChangeText={set('skills')}     placeholder="Python, SQL, React" />
            <Field label={t('profileEdit.github')}    value={form.github_url} onChangeText={set('github_url')} placeholder="https://github.com/..." autoCapitalize="none" />
            <Field label={t('profileEdit.bio')} value={form.bio} onChangeText={set('bio')} placeholder="Кратко о себе..." multiline />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('account.language')}</Text>
            <LanguageSelector />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{exists ? t('profileEdit.saveBtn') : t('profileEdit.createBtn')}</Text>
            }
          </TouchableOpacity>

          <View style={styles.accountSection}>
            <Text style={styles.accountEmail}>{user?.email}</Text>
            <Text style={styles.accountRole}>
              {user?.is_email_verified ? t('profileEdit.emailVerified') : t('profileEdit.emailNotVerified')}
            </Text>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => Alert.alert(t('account.logoutConfirm'), '', [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('profileEdit.logoutBtn'), style: 'destructive', onPress: logout },
              ])}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>{t('profileEdit.logoutBtn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {tab === 'applications' && (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          {appsLoading ? (
            <ActivityIndicator style={styles.loader} color="#2563EB" />
          ) : (
            <FlatList
              data={apps}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.content}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}><Icon name="clipboard-list" size={40} color="#D1D5DB" /></View>
                  <Text style={styles.emptyText}>{t('apps.empty')}</Text>
                </View>
              }
              renderItem={({ item }) => {
                const color = STATUS_COLORS[item.status] ?? '#6B7280';
                const date  = formatDate(item.created_at, 'ru-RU', { day: '2-digit', month: 'short' });
                return (
                  <TouchableOpacity style={styles.appCard} activeOpacity={0.7} onPress={() => handleOpenVacancy(item.vacancy_id)}>
                    <View style={styles.appTop}>
                      <Text style={styles.appDate}>{date}</Text>
                      <View style={[styles.appBadge, { backgroundColor: color + '20' }]}>
                        <Text style={[styles.appBadgeText, { color }]}>
                          {t(`status.${item.status}`, { defaultValue: item.status })}
                        </Text>
                      </View>
                    </View>
                    {item.vacancy_title ? (
                      <Text style={styles.appVacancyTitle} numberOfLines={1}>{item.vacancy_title}</Text>
                    ) : null}
                    {item.company_name ? (
                      <Text style={styles.appCompany} numberOfLines={1}>{item.company_name}</Text>
                    ) : null}
                    {item.match_score > 0 && (
                      <Text style={styles.appMatch}>{t('employer.apps.match')} {item.match_score}%</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {tab === 'documents' && (
        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={styles.content}>
          {docsLoading ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <>
              {(['cv', 'diploma', 'certificate'] as const).map(docType => {
                const existing = docs.find(d => d.type === docType);
                const color = DOC_TYPE_COLORS[docType];
                const statusConfig = {
                  pending:  { label: t('docs.status.pending'),  bg: '#FEF3C7', fg: '#92400E' },
                  verified: { label: t('docs.status.verified'), bg: '#D1FAE5', fg: '#065F46' },
                  rejected: { label: t('docs.status.rejected'), bg: '#FEE2E2', fg: '#991B1B' },
                };
                return (
                  <View key={docType} style={styles.docCard}>
                    <View style={styles.docCardHeader}>
                      <View style={[styles.docTypeIcon, { backgroundColor: color + '20' }]}>
                        <Icon name={DOC_TYPE_ICONS[docType]} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docTypeName, { color }]}>{t(`docs.types.${docType}`)}</Text>
                        {existing ? (
                          <Text style={styles.docFileName} numberOfLines={1}>
                            {(() => { try { return decodeURIComponent(existing.file_name); } catch { return existing.file_name; } })()}
                          </Text>
                        ) : (
                          <Text style={styles.docEmpty}>{t('docs.emptyDoc')}</Text>
                        )}
                      </View>
                      {existing && docType === 'diploma' && (
                        <View style={[styles.docStatus, { backgroundColor: (statusConfig[existing.status] ?? statusConfig.pending).bg }]}>
                          <Text style={[styles.docStatusText, { color: (statusConfig[existing.status] ?? statusConfig.pending).fg }]}>
                            {(statusConfig[existing.status] ?? statusConfig.pending).label}
                          </Text>
                        </View>
                      )}
                    </View>
                    {existing?.rejection_reason && (
                      <Text style={styles.rejectReason}>{t('docs.rejectReason', { reason: existing.rejection_reason })}</Text>
                    )}
                    <View style={styles.docActions}>
                      <TouchableOpacity
                        style={[styles.uploadBtn, { borderColor: color }]}
                        onPress={() => handleUploadDoc(docType)}
                        disabled={uploading}
                      >
                        <Text style={[styles.uploadBtnText, { color }]}>
                          {uploading ? '...' : existing ? t('docs.uploadBtn').replace('+', '↺') : t('docs.uploadBtn')}
                        </Text>
                      </TouchableOpacity>
                      {existing && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteDoc(existing)}>
                          <Text style={styles.deleteBtnText}>{t('docs.deleteBtn')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, maxLength, multiline, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; maxLength?: number;
  multiline?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader:          { marginTop: 60 },
  tabBar:          { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabItem:         { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemActive:   { borderBottomWidth: 2, borderBottomColor: '#2563EB' },
  tabText:         { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  tabTextActive:   { color: '#2563EB' },
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  content:         { padding: 16, paddingBottom: 40 },
  completionCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  completionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  completionLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  completionPct:   { fontSize: 18, fontWeight: '800' },
  progressTrack:   { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: 8, borderRadius: 4 },
  verifiedBadge:   { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center' },
  verifiedText:    { color: '#047857', fontWeight: '700', fontSize: 13 },
  section:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  field:           { marginBottom: 12 },
  label:           { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  input:           { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  inputMulti:      { height: 90, textAlignVertical: 'top' },
  saveBtn:         { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  accountSection:  { marginTop: 24, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  accountEmail:    { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  accountRole:     { fontSize: 12, color: '#6B7280', marginBottom: 16 },
  logoutBtn:       { backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText:      { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  // Applications tab
  empty:           { alignItems: 'center', paddingTop: 60 },
  emptyIcon:       { marginBottom: 10 },
  emptyText:       { fontSize: 15, color: '#9CA3AF' },
  appCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  appTop:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  appDate:         { fontSize: 12, color: '#9CA3AF' },
  appBadge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  appBadgeText:    { fontSize: 11, fontWeight: '700' },
  appLetter:        { fontSize: 13, color: '#374151', lineHeight: 18 },
  appVacancyTitle:  { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 6 },
  appCompany:       { fontSize: 12, color: '#6B7280', marginTop: 2 },
  appMatch:         { fontSize: 11, color: '#6B7280', marginTop: 6 },
  // Documents tab
  docCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  docCardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  docTypeIcon:     { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docTypeName:     { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  docFileName:     { fontSize: 11, color: '#6B7280' },
  docEmpty:        { fontSize: 11, color: '#9CA3AF' },
  docStatus:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  docStatusText:   { fontSize: 11, fontWeight: '700' },
  rejectReason:    { fontSize: 11, color: '#EF4444', marginBottom: 8 },
  docActions:      { flexDirection: 'row', gap: 8 },
  uploadBtn:       { flex: 2, borderWidth: 1.5, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  uploadBtnText:   { fontSize: 13, fontWeight: '700' },
  deleteBtn:       { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  deleteBtnText:   { fontSize: 13, fontWeight: '700', color: '#EF4444' },
});
