import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { EmployerStackParamList } from '../navigation/MainNavigator';
import { documentService, type Document } from '../services/documentService';
import { apiFetch } from '../services/api';

type RouteType = RouteProp<EmployerStackParamList, 'CandidateDetail'>;

interface StudentProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  iin?: string;
  phone?: string;
  location_city?: string;
  specialization?: string;
  graduation_year?: number;
  gpa?: number;
  bio?: string;
  skills?: string | string[];
  github_url?: string;
  diploma_verified?: boolean;
}

export default function CandidateDetailScreen() {
  const { t } = useTranslation();
  const route      = useRoute<RouteType>();
  const navigation = useNavigation();
  const { studentId, applicationId } = route.params;

  const [profile,    setProfile]    = useState<StudentProfile | null>(null);
  const [documents,  setDocuments]  = useState<Document[]>([]);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const requests: Promise<any>[] = [
        apiFetch(`/api/students/${studentId}`),
        documentService.getStudentDocuments(studentId),
      ];
      if (applicationId) {
        requests.push(apiFetch(`/api/applications/${applicationId}`));
      }
      const [profileRes, docs, appRes] = await Promise.all(requests);
      if (profileRes.ok) setProfile(await profileRes.json());
      setDocuments(docs);
      if (appRes?.ok) {
        const appData = await appRes.json();
        setMatchScore(appData.match_score ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [studentId, applicationId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#7C3AED" />;

  const docStatusConfig = {
    pending:  { label: t('docs.status.pending'),  color: '#F59E0B', bg: '#FEF3C7' },
    verified: { label: t('docs.status.verified'), color: '#059669', bg: '#D1FAE5' },
    rejected: { label: t('docs.status.rejected'), color: '#EF4444', bg: '#FEE2E2' },
  };

  const name = profile ? `${profile.first_name} ${profile.last_name}` : t('role.student');
  const rawSkills = profile?.skills as unknown;
  const skills = Array.isArray(rawSkills)
    ? (rawSkills as string[]).map(s => s.trim()).filter(Boolean)
    : typeof rawSkills === 'string'
      ? rawSkills.split(',').map(s => s.trim()).filter(Boolean)
      : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          {profile?.specialization ? <Text style={styles.spec}>{profile.specialization}</Text> : null}
          {profile?.diploma_verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ {t('employer.candidate.docUploaded')}</Text>
            </View>
          )}
        </View>
        {matchScore > 0 && (
          <View style={styles.matchContainer}>
            <View style={[styles.matchRing, {
              borderColor: matchScore >= 70 ? '#10B981' : matchScore >= 40 ? '#F59E0B' : '#EF4444',
            }]}>
              <Text style={[styles.matchScore, {
                color: matchScore >= 70 ? '#10B981' : matchScore >= 40 ? '#F59E0B' : '#EF4444',
              }]}>{matchScore}%</Text>
            </View>
            <Text style={styles.matchLabel}>{t('employer.candidate.match')}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('employer.candidate.info')}</Text>
        {profile?.location_city   ? <InfoRow icon="pin"            label={t('employer.candidate.city')}           value={profile.location_city} /> : null}
        {profile?.phone           ? <InfoRow icon="phone"          label={t('employer.candidate.phone')}          value={profile.phone} /> : null}
        {profile?.graduation_year ? <InfoRow icon="graduation-cap" label={t('employer.candidate.graduationYear')} value={String(profile.graduation_year)} /> : null}
        {profile?.gpa             ? <InfoRow icon="chart-bar"      label={t('employer.candidate.gpa')}            value={String(profile.gpa)} /> : null}
        {profile?.github_url      ? <InfoRow icon="code"           label={t('employer.candidate.github')}         value={profile.github_url} /> : null}
      </View>

      {/* Bio */}
      {profile?.bio ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('employer.candidate.bio')}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* Skills */}
      {skills.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('employer.candidate.skills')}</Text>
          <View style={styles.skillsWrap}>
            {skills.map(s => (
              <View key={s} style={styles.skillChip}>
                <Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('employer.candidate.documents')}</Text>
          {documents.map(doc => {
            const cfg = docStatusConfig[doc.status] ?? docStatusConfig.pending;
            const decodedName = (() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })();
            return (
              <View key={doc.id} style={styles.docRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docType}>{t(`docs.types.${doc.type}`)}</Text>
                  <Text style={styles.docName} numberOfLines={1}>{decodedName}</Text>
                </View>
                {doc.type === 'diploma' ? (
                  <View style={[styles.docBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.docBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                ) : (
                  <View style={[styles.docBadge, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={[styles.docBadgeText, { color: '#059669' }]}>{t('employer.candidate.docUploaded')}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Chat button */}
      {applicationId && (
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => (navigation as any).navigate('EmployerChat', {
            applicationId,
            title: name,
          })}
        >
          <Text style={styles.chatBtnText}>{t('employer.candidate.chat')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}><Icon name={icon} size={14} color="#6B7280" /></View>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader:        { marginTop: 60 },
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  content:       { padding: 16, paddingBottom: 40 },
  profileCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  avatar:        { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 22, fontWeight: '800', color: '#7C3AED' },
  name:          { fontSize: 18, fontWeight: '800', color: '#111827' },
  spec:          { fontSize: 13, color: '#6B7280', marginTop: 2 },
  verifiedBadge: { marginTop: 6, backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  verifiedText:  { fontSize: 11, color: '#059669', fontWeight: '700' },
  card:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  bio:           { fontSize: 13, color: '#374151', lineHeight: 20 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoIcon:      { width: 20, alignItems: 'center' as const },
  infoLabel:     { fontSize: 13, color: '#6B7280', width: 90 },
  infoValue:     { fontSize: 13, color: '#111827', flex: 1, fontWeight: '500' },
  skillsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip:     { backgroundColor: '#EDE9FE', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  skillText:     { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  docRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  docType:       { fontSize: 12, fontWeight: '700', color: '#374151' },
  docName:       { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  docBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  docBadgeText:  { fontSize: 11, fontWeight: '700' },
  chatBtn:        { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  chatBtnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  matchContainer: { alignItems: 'center', gap: 4 },
  matchRing:      { width: 52, height: 52, borderRadius: 26, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  matchScore:     { fontSize: 13, fontWeight: '800' },
  matchLabel:     { fontSize: 9, color: '#6B7280', fontWeight: '600' },
});
