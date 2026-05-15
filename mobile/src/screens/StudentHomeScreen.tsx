import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { studentService, type StudentProfile } from '../services/studentService';
import { applicationService, type Application } from '../services/applicationService';
import { employmentService, type EmploymentRecord } from '../services/employmentService';
import { jobService, type Vacancy } from '../services/jobService';
import { formatDate } from '../utils/dateUtils';
import type { HomeStackParamList } from '../navigation/MainNavigator';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

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

export default function StudentHomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [profile,     setProfile]     = useState<StudentProfile | null>(null);
  const [apps,        setApps]        = useState<Application[]>([]);
  const [recommended, setRecommended] = useState<Vacancy[]>([]);
  const [grant,       setGrant]       = useState<EmploymentRecord | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, a, emp] = await Promise.allSettled([
        studentService.getProfile(),
        applicationService.getMyApplications(),
        employmentService.getMyRecords(),
      ]);
      const prof = p.status === 'fulfilled' ? p.value : null;
      setProfile(prof);
      setApps(a.status === 'fulfilled' ? a.value : []);
      const records = emp.status === 'fulfilled' ? emp.value : [];
      setGrant(records.find(r => r.status === 'active') ?? records[0] ?? null);

      const skillQuery = prof?.skills?.split(',')[0]?.trim() ?? '';
      const { vacancies } = await jobService.getAll({ search: skillQuery, page: 1, page_size: 6 });
      setRecommended(vacancies);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  const completion = calcCompletion(profile);
  const firstName  = profile?.first_name ?? user?.email?.split('@')[0] ?? t('role.student');
  const activeApps = apps.filter(a => !['rejected', 'offered'].includes(a.status)).length;

  const STATUS_LABELS: Record<string, string> = {
    applied: t('status.applied'), review: t('status.review'),
    shortlisted: t('status.shortlisted'), interview: t('status.interview'),
    offered: t('status.offered'), rejected: t('status.rejected'),
  };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>{t('home.greeting')}</Text>
        <Text style={styles.heroName}>{firstName}! 👋</Text>
        <Text style={styles.heroSub}>{t('home.careerSubtitle')}</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard icon="clipboard-list" label={t('home.activeApplications')} value={activeApps} color="#2563EB" onPress={() => navigation.getParent()?.navigate('Applications')} />
        <StatCard icon="briefcase" label={t('home.recommended')} value={recommended.length} color="#7C3AED" onPress={() => navigation.getParent()?.navigate('Jobs')} />
      </View>

      <View style={styles.card}>
        <View style={styles.completionHeader}>
          <Text style={styles.cardTitle}>{t('home.profileCompletion')}</Text>
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
        {completion < 100 && (
          <Text style={styles.completionHint}>
            {completion < 50 ? t('home.fillProfileLow') : t('home.fillProfileHigh')}
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
      <View style={styles.actionsGrid}>
        <QuickAction icon="search"         label={t('home.findVacancies')} color="#EFF6FF" textColor="#2563EB" onPress={() => navigation.getParent()?.navigate('Jobs')} />
        <QuickAction icon="clipboard-list" label={t('home.myApplications')} color="#F5F3FF" textColor="#7C3AED" onPress={() => navigation.getParent()?.navigate('Applications')} />
        <QuickAction icon="user"           label={t('home.myProfile')} color="#ECFDF5" textColor="#059669" onPress={() => navigation.getParent()?.navigate('Profile')} />
        <QuickAction icon="document"       label={t('home.documents')} color="#FFF7ED" textColor="#C2410C" onPress={() => navigation.getParent()?.navigate('Profile', { initialTab: 'documents' })} />
      </View>

      {grant && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.grantObligation')}</Text>
          <Text style={styles.grantJob}>{grant.job_title}</Text>
          <Text style={styles.grantCompany}>{grant.company_name}</Text>
          <View style={styles.grantProgressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${grant.progress}%` as any, backgroundColor: '#10B981' }]} />
            </View>
            <Text style={styles.grantPct}>{grant.progress}%</Text>
          </View>
          <View style={styles.grantStats}>
            <View style={styles.grantStat}>
              <Text style={styles.grantStatVal}>{grant.days_worked}</Text>
              <Text style={styles.grantStatLbl}>{t('home.daysWorked')}</Text>
            </View>
            <View style={styles.grantStat}>
              <Text style={styles.grantStatVal}>{grant.remaining_days}</Text>
              <Text style={styles.grantStatLbl}>{t('home.daysLeft')}</Text>
            </View>
            <View style={styles.grantStat}>
              <Icon
                name={grant.grant_fulfilled ? 'check-circle' : 'in-progress'}
                size={24}
                color={grant.grant_fulfilled ? '#10B981' : '#F59E0B'}
              />
              <Text style={styles.grantStatLbl}>{grant.grant_fulfilled ? t('home.grantFulfilled') : t('home.grantActive')}</Text>
            </View>
          </View>
        </View>
      )}

      {apps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('home.recentApplications')}</Text>
          {apps.slice(0, 3).map(app => {
            const color = STATUS_COLORS[app.status] ?? '#6B7280';
            const label = STATUS_LABELS[app.status] ?? app.status;
            const date  = formatDate(app.created_at, 'ru-RU', { day: '2-digit', month: 'short' });
            return (
              <View key={app.id} style={styles.appCard}>
                <View style={styles.appLeft}>
                  <Text style={styles.appDate}>{date}</Text>
                  {app.match_score > 0 && <MatchRing score={app.match_score} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appCoverLetter} numberOfLines={2}>
                    {app.cover_letter || t('home.applicationSent')}
                  </Text>
                </View>
                <View style={[styles.appBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.appBadgeText, { color }]}>{label}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      {recommended.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('home.recommendedVacancies')}</Text>
          {recommended.map(v => (
            <TouchableOpacity key={v.id} style={styles.vacCard} onPress={() => navigation.navigate('JobDetail', { vacancy: v })} activeOpacity={0.8}>
              <View style={styles.vacHeader}>
                <Text style={styles.vacTitle} numberOfLines={1}>{v.title}</Text>
                {v.salary_min > 0 && <Text style={styles.vacSalary}>₸{v.salary_min.toLocaleString()}</Text>}
              </View>
              {v.company_name && <Text style={styles.vacCompany}>{v.company_name}</Text>}
              <View style={styles.vacMeta}>
                {v.location ? (
                  <View style={styles.vacMetaItem}>
                    <Icon name="pin" size={11} color="#9CA3AF" />
                    <Text style={styles.vacMetaText}>{v.location}</Text>
                  </View>
                ) : null}
                <View style={styles.vacMetaItem}>
                  <Icon name="briefcase" size={11} color="#9CA3AF" />
                  <Text style={styles.vacMetaText}>{v.job_type}</Text>
                </View>
              </View>
              {v.skills ? (
                <View style={styles.vacSkills}>
                  {v.skills.split(',').slice(0, 3).map(s => (
                    <View key={s} style={styles.skillChip}><Text style={styles.skillText}>{s.trim()}</Text></View>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color, onPress }: { icon: IconName; label: string; value: number; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderTopColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.statIcon}><Icon name={icon} size={22} color={color} /></View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, color, textColor, onPress }: { icon: IconName; label: string; color: string; textColor: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickActionIcon}><Icon name={icon} size={26} color={textColor} /></View>
      <Text style={[styles.quickActionLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MatchRing({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <View style={[styles.ring, { borderColor: color }]}>
      <Text style={[styles.ringText, { color }]}>{score}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader:           { marginTop: 60 },
  bg:               { flex: 1, backgroundColor: '#F8FAFC' },
  content:          { padding: 16, paddingBottom: 40 },
  hero:             { backgroundColor: '#2563EB', borderRadius: 20, padding: 20, marginBottom: 16 },
  heroGreeting:     { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  heroName:         { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSub:          { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  statsGrid:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statIcon:         { marginBottom: 6 },
  statValue:        { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  statLabel:        { fontSize: 11, color: '#6B7280' },
  card:             { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle:        { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  completionPct:    { fontSize: 20, fontWeight: '800' },
  progressTrack:    { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden', flex: 1 },
  progressFill:     { height: 8, borderRadius: 4 },
  completionHint:   { fontSize: 12, color: '#6B7280', marginTop: 8 },
  sectionTitle:     { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 },
  actionsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  quickAction:      { flex: 1, minWidth: '45%', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  quickActionIcon:  {},
  quickActionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  grantJob:         { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  grantCompany:     { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  grantProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  grantPct:         { fontSize: 13, fontWeight: '700', color: '#10B981', width: 40 },
  grantStats:       { flexDirection: 'row', gap: 0 },
  grantStat:        { flex: 1, alignItems: 'center' },
  grantStatVal:     { fontSize: 18, fontWeight: '800', color: '#111827' },
  grantStatLbl:     { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  appCard:          { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  appLeft:          { alignItems: 'center', gap: 6, width: 52 },
  appDate:          { fontSize: 10, color: '#9CA3AF', textAlign: 'center' },
  appCoverLetter:   { fontSize: 13, color: '#374151', lineHeight: 18 },
  appBadge:         { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  appBadgeText:     { fontSize: 10, fontWeight: '700' },
  ring:             { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  ringText:         { fontSize: 9, fontWeight: '800' },
  vacCard:          { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  vacHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  vacTitle:         { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  vacSalary:        { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  vacCompany:       { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  vacMeta:          { flexDirection: 'row', gap: 12, marginBottom: 8 },
  vacMetaItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vacMetaText:      { fontSize: 11, color: '#9CA3AF' },
  vacSkills:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip:        { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  skillText:        { fontSize: 11, color: '#2563EB', fontWeight: '500' },
});
