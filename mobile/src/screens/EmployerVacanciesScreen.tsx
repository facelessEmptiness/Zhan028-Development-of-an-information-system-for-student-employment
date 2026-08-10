import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, ScrollView,
} from 'react-native';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { employerVacancyService } from '../services/employerVacancyService';
import { applicationService, Application, STATUS_COLORS } from '../services/applicationService';
import type { Vacancy } from '../services/jobService';
import { formatDate, langToLocale } from '../utils/dateUtils';
import type { EmployerStackParamList } from '../navigation/MainNavigator';

const FUNNEL_STAGE_KEYS = ['applied', 'review', 'interview', 'offered'] as const;
const FUNNEL_COLORS = ['#3B82F6', '#8B5CF6', '#6366F1', '#10B981'];

const VACANCY_STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  closed: '#EF4444',
  draft:  '#9CA3AF',
};

type Tab = 'overview' | 'vacancies';

export default function EmployerVacanciesScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<EmployerStackParamList>>();
  const [tab,        setTab]        = useState<Tab>('overview');
  const [vacancies,  setVacancies]  = useState<Vacancy[]>([]);
  const [allApps,    setAllApps]    = useState<Application[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const vacs = await employerVacancyService.getMyVacancies();
      setVacancies(vacs);
      const results = await Promise.allSettled(
        vacs.map(v => applicationService.getVacancyApplications(v.id))
      );
      const apps: Application[] = [];
      results.forEach(r => { if (r.status === 'fulfilled') apps.push(...r.value); });
      setAllApps(apps);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClose = (id: string) => {
    Alert.alert(t('employer.closeVacancy.title'), t('employer.closeVacancy.text'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('employer.closeVacancy.btn'), style: 'destructive', onPress: async () => {
        await employerVacancyService.close(id).catch(() => {});
        setVacancies(prev => prev.map(v => v.id === id ? { ...v, status: 'closed' } : v));
      }},
    ]);
  };

  // Overview derived data
  const vacTitleMap: Record<string, string> = vacancies.reduce(
    (acc, v) => ({ ...acc, [v.id]: v.title }), {}
  );

  const funnelCounts = FUNNEL_STAGE_KEYS.map((key, i) => ({
    key,
    label: t(`status.${key}`),
    color: FUNNEL_COLORS[i],
    count: allApps.filter(a => a.status === key).length,
  }));
  const maxCount = Math.max(...funnelCounts.map(s => s.count), 1);

  const recentApps = [...allApps]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const topVacancies = vacancies
    .map(v => ({ v, count: allApps.filter(a => a.vacancy_id === v.id).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#7C3AED" />;

  return (
    <View style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'overview' && styles.tabBtnActive]}
          onPress={() => setTab('overview')}
        >
          <Text style={[styles.tabText, tab === 'overview' && styles.tabTextActive]}>{t('employer.overview')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'vacancies' && styles.tabBtnActive]}
          onPress={() => setTab('vacancies')}
        >
          <Text style={[styles.tabText, tab === 'vacancies' && styles.tabTextActive]}>
            {t('employer.vacanciesTab', { count: vacancies.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'overview' ? (
        <ScrollView
          contentContainerStyle={styles.overviewContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />
          }
        >
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{vacancies.length}</Text>
              <Text style={styles.statLabel}>{t('employer.statsVacancies')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{allApps.length}</Text>
              <Text style={styles.statLabel}>{t('employer.statsApps')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{allApps.filter(a => a.status === 'offered').length}</Text>
              <Text style={styles.statLabel}>{t('employer.statsOffers')}</Text>
            </View>
          </View>

          {/* Hiring funnel */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('employer.hiringFunnel')}</Text>
            {funnelCounts.map(s => (
              <View key={s.key} style={styles.funnelRow}>
                <Text style={styles.funnelLabel}>{s.label}</Text>
                <View style={styles.funnelBarBg}>
                  <View
                    style={[
                      styles.funnelBar,
                      {
                        width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 4 : 0)}%`,
                        backgroundColor: s.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.funnelCount}>{s.count}</Text>
              </View>
            ))}
          </View>

          {/* Recent applications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('employer.recentApps')}</Text>
            {recentApps.length === 0 ? (
              <Text style={styles.emptySmall}>{t('employer.noApplications')}</Text>
            ) : recentApps.map(a => {
              const name = a.student
                ? `${a.student.first_name} ${a.student.last_name}`
                : t('role.student');
              const initial = (a.student?.first_name?.[0] ?? '?').toUpperCase();
              const statusColor = STATUS_COLORS[a.status] ?? '#6B7280';
              const statusLabel = t(`status.${a.status}`, { defaultValue: a.status });
              const date = formatDate(a.created_at, langToLocale(i18n.language), { day: 'numeric', month: 'short' });
              return (
                <View key={a.id} style={styles.recentCard}>
                  <View style={styles.recentAvatar}>
                    <Text style={styles.recentAvatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentName}>{name}</Text>
                    <Text style={styles.recentVac} numberOfLines={1}>{vacTitleMap[a.vacancy_id] ?? ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.recentDate}>{date}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Top vacancies */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('employer.topVacancies')}</Text>
            {topVacancies.length === 0 ? (
              <Text style={styles.emptySmall}>{t('employer.noData')}</Text>
            ) : topVacancies.map(({ v, count }) => (
              <TouchableOpacity
                key={v.id}
                style={styles.topVacCard}
                onPress={() => navigation.navigate('VacancyApplications', { vacancyId: v.id, vacancyTitle: v.title })}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.topVacTitle}>{v.title}</Text>
                  <Text style={styles.topVacMeta}>{v.location}  •  {v.job_type}</Text>
                </View>
                <View style={styles.topVacBadge}>
                  <Text style={styles.topVacCount}>{count}</Text>
                  <Text style={styles.topVacCountLabel}>{t('employer.applications')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={vacancies}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="briefcase" size={48} color="#D1D5DB" /></View>
              <Text style={styles.emptyText}>{t('employer.noVacancies')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const vacStatusColor = VACANCY_STATUS_COLORS[item.status ?? 'active'] ?? '#9CA3AF';
            const vacStatusLabel = t(`employer.status.${item.status ?? 'active'}`, { defaultValue: item.status ?? 'active' });
            const salary = item.salary_min || item.salary_max
              ? `${item.salary_min ? item.salary_min.toLocaleString() : '?'} – ${item.salary_max ? item.salary_max.toLocaleString() : '?'} ₸`
              : t('employer.salaryNotSet');

            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.meta}>{item.location}  •  {item.job_type}</Text>
                    <Text style={styles.salary}>{salary}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: vacStatusColor + '20' }]}>
                    <Text style={[styles.badgeText, { color: vacStatusColor }]}>{vacStatusLabel}</Text>
                  </View>
                </View>

                {item.skills ? (
                  <View style={styles.skillsRow}>
                    {String(item.skills ?? '').split(',').filter(Boolean).slice(0, 3).map(s => (
                      <View key={s} style={styles.skillChip}>
                        <Text style={styles.skillText}>{s.trim()}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('VacancyApplications', { vacancyId: item.id, vacancyTitle: item.title })}
                  >
                    <Text style={styles.actionBtnText}>{t('employer.vacancy.appsBtn')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => navigation.navigate('VacancyForm', { vacancy: item })}
                  >
                    <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  {item.status === 'active' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.closeBtn]}
                      onPress={() => handleClose(item.id)}
                    >
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>{t('employer.vacancy.closeBtn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('VacancyForm', { vacancy: undefined })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loader:           { marginTop: 60 },
  container:        { flex: 1, backgroundColor: '#F8FAFC' },

  tabs:             { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBtn:           { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive:     { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  tabText:          { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive:    { color: '#7C3AED' },

  overviewContent:  { padding: 16, paddingBottom: 100 },
  statsRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statNum:          { fontSize: 26, fontWeight: '800', color: '#7C3AED' },
  statLabel:        { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  section:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle:     { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },

  funnelRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  funnelLabel:      { width: 118, fontSize: 12, color: '#374151' },
  funnelBarBg:      { flex: 1, height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden', marginRight: 8 },
  funnelBar:        { height: 10, borderRadius: 5 },
  funnelCount:      { width: 28, fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'right' },

  recentCard:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  recentAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  recentAvatarText: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  recentName:       { fontSize: 13, fontWeight: '600', color: '#111827' },
  recentVac:        { fontSize: 11, color: '#6B7280', marginTop: 1 },
  statusPill:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-end' },
  statusPillText:   { fontSize: 10, fontWeight: '700' },
  recentDate:       { fontSize: 10, color: '#9CA3AF', marginTop: 3, textAlign: 'right' },

  emptySmall:       { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },

  topVacCard:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  topVacTitle:      { fontSize: 13, fontWeight: '600', color: '#111827' },
  topVacMeta:       { fontSize: 11, color: '#6B7280', marginTop: 2 },
  topVacBadge:      { alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginLeft: 10 },
  topVacCount:      { fontSize: 20, fontWeight: '800', color: '#7C3AED' },
  topVacCountLabel: { fontSize: 10, color: '#7C3AED' },

  list:             { padding: 16, paddingBottom: 100 },
  card:             { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTop:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  title:            { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  meta:             { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  salary:           { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  badge:            { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8, flexShrink: 0 },
  badgeText:        { fontSize: 11, fontWeight: '700' },
  skillsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  skillChip:        { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  skillText:        { fontSize: 11, color: '#2563EB' },
  actions:          { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn:        { flex: 1, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  editBtn:          { backgroundColor: '#F5F3FF' },
  closeBtn:         { backgroundColor: '#FEF2F2' },
  actionBtnText:    { fontSize: 12, fontWeight: '700', color: '#fff' },
  empty:            { alignItems: 'center', paddingTop: 80 },
  emptyIcon:        { marginBottom: 12 },
  emptyText:        { fontSize: 16, color: '#9CA3AF' },

  fab:              { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  fabText:          { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});
