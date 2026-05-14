import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { employmentService, type EmploymentRecord } from '../services/employmentService';
import { formatDate } from '../utils/dateUtils';

const GRANT_DAYS = 1095;

export default function EmploymentScreen() {
  const { t } = useTranslation();
  const [records,    setRecords]    = useState<EmploymentRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await employmentService.getMyRecords();
      setRecords(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  return (
    <FlatList
      data={records}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
      ListHeaderComponent={
        <Text style={styles.header}>{t('employment.header')}</Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>{t('employment.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('employment.empty.text')}</Text>
        </View>
      }
      renderItem={({ item }) => <RecordCard record={item} t={t} />}
    />
  );
}

function RecordCard({ record: r, t }: { record: EmploymentRecord; t: (k: string, opts?: any) => string }) {
  const STATUS_CFG: Record<string, { label: string; color: string }> = {
    active:           { label: t('employment.status.active'),     color: '#10B981' },
    completed:        { label: t('employment.status.completed'),  color: '#2563EB' },
    terminated_early: { label: t('employment.status.terminated'), color: '#EF4444' },
  };

  const cfg = STATUS_CFG[r.status] ?? { label: r.status, color: '#6B7280' };
  const startDate = formatDate(r.started_at, 'ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  const progress  = Math.min(r.progress ?? 0, 100);
  const barColor  = r.grant_fulfilled ? '#10B981' : '#2563EB';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle}>{r.job_title}</Text>
          <Text style={styles.company}>{r.company_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <Text style={styles.dateText}>{t('employment.startDate', { date: startDate })}</Text>

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>{t('employment.progressLabel')}</Text>
          <Text style={[styles.progressPct, { color: barColor }]}>{progress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: barColor }]} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label={t('employment.daysWorked')} value={String(r.days_worked ?? 0)} />
        <Stat label={t('employment.months')}     value={String(r.months_worked ?? 0)} />
        <Stat label={t('employment.remainingDays')} value={r.grant_fulfilled ? '0' : String(r.remaining_days ?? GRANT_DAYS)} />
      </View>

      {r.grant_fulfilled && (
        <View style={styles.fulfilledBanner}>
          <Text style={styles.fulfilledText}>{t('employment.fulfilled')}</Text>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader:          { marginTop: 60 },
  list:            { padding: 16, paddingBottom: 40 },
  header:          { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  jobTitle:        { fontSize: 16, fontWeight: '700', color: '#111827' },
  company:         { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:      { fontSize: 11, fontWeight: '700' },
  dateText:        { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  progressSection: { marginBottom: 14 },
  progressLabelRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel:   { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  progressPct:     { fontSize: 12, fontWeight: '700' },
  progressTrack:   { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: 8, borderRadius: 4 },
  statsRow:        { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  stat:            { alignItems: 'center' },
  statValue:       { fontSize: 18, fontWeight: '800', color: '#111827' },
  statLabel:       { fontSize: 10, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  fulfilledBanner: { backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  fulfilledText:   { color: '#047857', fontWeight: '700', textAlign: 'center', fontSize: 13 },
  empty:           { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyText:       { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});
