import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { interviewService, type Interview } from '../services/interviewService';
import Icon from '../components/Icon';

function formatDate(iso: string, t: (k: string, opts?: any) => string, locale: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    + ' ' + t('interviews.at') + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function InterviewsScreen() {
  const { t, i18n } = useTranslation();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const STATUS_CONFIG = {
    scheduled:  { label: t('interviews.status.scheduled'), color: '#2563EB', bg: '#EFF6FF' },
    completed:  { label: t('interviews.status.completed'), color: '#059669', bg: '#D1FAE5' },
    cancelled:  { label: t('interviews.status.cancelled'), color: '#EF4444', bg: '#FEE2E2' },
  };

  const load = useCallback(async () => {
    try {
      const data = await interviewService.getStudentInterviews();
      setInterviews(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  const upcoming = interviews.filter(i => i.status === 'scheduled' && new Date(i.scheduled_at) >= new Date());
  const past     = interviews.filter(i => i.status !== 'scheduled' || new Date(i.scheduled_at) < new Date());

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
    >
      <Text style={styles.header}>{t('interviews.header')}</Text>

      {interviews.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Icon name="calendar" size={52} color="#D1D5DB" /></View>
          <Text style={styles.emptyTitle}>{t('interviews.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('interviews.empty.text')}</Text>
        </View>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('interviews.upcoming')}</Text>
              {upcoming.map(i => <InterviewCard key={i.id} interview={i} statusConfig={STATUS_CONFIG} t={t} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('interviews.past')}</Text>
              {past.map(i => <InterviewCard key={i.id} interview={i} statusConfig={STATUS_CONFIG} t={t} />)}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function InterviewCard({ interview: i, statusConfig, t }: {
  interview: Interview;
  statusConfig: Record<string, { label: string; color: string; bg: string }>;
  t: (k: string, opts?: any) => string;
}) {
  const cfg = statusConfig[i.status] ?? statusConfig.scheduled;
  const companyName  = i.vacancy?.company_name ?? '';
  const vacancyTitle = i.vacancy?.title ?? '';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.company}>{companyName}</Text>
          <Text style={styles.vacancy}>{vacancyTitle}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.metaIcon}><Icon name="calendar" size={14} color="#6B7280" /></View>
        <Text style={styles.metaText}>{formatDate(i.scheduled_at, t, i18n.language === 'kz' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU')}</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.metaIcon}><Icon name="hourglass" size={14} color="#6B7280" /></View>
        <Text style={styles.metaText}>{t('interviews.duration', { count: i.duration_minutes })}</Text>
      </View>
      {i.location ? (
        <View style={styles.row}>
          <View style={styles.metaIcon}><Icon name="pin" size={14} color="#6B7280" /></View>
          <Text style={styles.metaText}>{i.location}</Text>
        </View>
      ) : null}
      {i.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesText}>{i.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loader:       { marginTop: 60 },
  container:    { flex: 1, backgroundColor: '#F8FAFC' },
  content:      { padding: 16, paddingBottom: 40 },
  header:       { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyIcon:    { marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyText:    { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  company:      { fontSize: 15, fontWeight: '700', color: '#111827' },
  vacancy:      { fontSize: 13, color: '#6B7280', marginTop: 2 },
  badge:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeText:    { fontSize: 11, fontWeight: '700' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaIcon:     { width: 20, alignItems: 'center' },
  metaText:     { fontSize: 13, color: '#374151' },
  notesBox:     { marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10 },
  notesText:    { fontSize: 12, color: '#6B7280', lineHeight: 18 },
});
