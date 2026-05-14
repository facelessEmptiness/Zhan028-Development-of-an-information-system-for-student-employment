import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert, Modal, TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { interviewService, type Interview } from '../services/interviewService';
import { applicationService, type Application } from '../services/applicationService';

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDate(iso: string, at: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
    + ` ${at} ` + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function EmployerInterviewsScreen() {
  const { t } = useTranslation();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [apps,       setApps]       = useState<Application[]>([]);

  const [form, setForm] = useState({
    application_id: '',
    date: '',
    time: '',
    duration: '60',
    location: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await interviewService.getEmployerInterviews();
      setInterviews(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = async () => {
    try {
      const data = await applicationService.getVacancyApplications('');
      setApps(data.filter(a => a.status === 'interview'));
    } catch {
      setApps([]);
    }
    setForm({ application_id: '', date: '', time: '', duration: '60', location: '', notes: '' });
    setShowForm(true);
  };

  const handleSchedule = async () => {
    if (!form.application_id) { Alert.alert(t('common.error'), t('employer.interviews.modal.error.app')); return; }
    if (!form.date || !form.time) { Alert.alert(t('common.error'), t('employer.interviews.modal.error.datetime')); return; }
    setSaving(true);
    try {
      const scheduled_at = `${form.date}T${form.time}:00`;
      await interviewService.schedule({
        application_id: form.application_id,
        scheduled_at,
        duration_minutes: parseInt(form.duration) || 60,
        location: form.location,
        notes: form.notes,
      });
      setShowForm(false);
      load();
      Alert.alert(t('common.success'), t('employer.interviews.success'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('employer.interviews.scheduleError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (id: string) => {
    Alert.alert(t('employer.interviews.cancelConfirm.title'), t('employer.interviews.cancelConfirm.text'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('employer.interviews.cancel'), style: 'destructive', onPress: async () => {
        try {
          await interviewService.cancel(id);
          setInterviews(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i));
        } catch {
          Alert.alert(t('common.error'), t('employer.interviews.cancelError'));
        }
      }},
    ]);
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#7C3AED" />;

  const upcoming = interviews.filter(i => i.status === 'scheduled');
  const past     = interviews.filter(i => i.status !== 'scheduled');

  const statusConfig = {
    scheduled: { label: t('interviews.status.scheduled'), color: '#2563EB', bg: '#EFF6FF' },
    completed: { label: t('interviews.status.completed'), color: '#059669', bg: '#D1FAE5' },
    cancelled: { label: t('interviews.status.cancelled'), color: '#EF4444', bg: '#FEE2E2' },
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
      >
        <View style={styles.topRow}>
          <Text style={styles.header}>{t('employer.interviews.header')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openForm}>
            <Text style={styles.addBtnText}>+ {t('employer.interviews.schedule')}</Text>
          </TouchableOpacity>
        </View>

        {interviews.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>{t('employer.interviews.empty.title')}</Text>
            <Text style={styles.emptyText}>{t('employer.interviews.empty.text')}</Text>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('employer.interviews.upcoming')}</Text>
                {upcoming.map(i => (
                  <InterviewCard
                    key={i.id}
                    interview={i}
                    statusConfig={statusConfig}
                    atLabel={t('interviews.at')}
                    durationLabel={t('employer.interviews.duration', { count: i.duration_minutes })}
                    candidateFallback={t('role.student')}
                    cancelLabel={t('employer.interviews.cancel')}
                    onCancel={() => handleCancel(i.id)}
                  />
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{t('employer.interviews.past')}</Text>
                {past.map(i => (
                  <InterviewCard
                    key={i.id}
                    interview={i}
                    statusConfig={statusConfig}
                    atLabel={t('interviews.at')}
                    durationLabel={t('employer.interviews.duration', { count: i.duration_minutes })}
                    candidateFallback={t('role.student')}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('employer.interviews.modal.title')}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>{t('employer.interviews.modal.appLabel')}</Text>
          {apps.length === 0 ? (
            <Text style={styles.noApps}>{t('employer.interviews.modal.noApps')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {apps.map(a => {
                const name = a.student
                  ? `${a.student.first_name} ${a.student.last_name}`
                  : `${t('employer.candidate.student')} #${a.student_id.slice(0, 6)}`;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.appChip, form.application_id === a.id && styles.appChipActive]}
                    onPress={() => setForm(f => ({ ...f, application_id: a.id }))}
                  >
                    <Text style={[styles.appChipText, form.application_id === a.id && styles.appChipTextActive]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.fieldLabel}>{t('employer.interviews.modal.dateLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.date}
            onChangeText={v => setForm(f => ({ ...f, date: v }))}
            placeholder="2025-06-15"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>{t('employer.interviews.modal.timeLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.time}
            onChangeText={v => setForm(f => ({ ...f, time: v }))}
            placeholder="10:00"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>{t('employer.interviews.modal.durationLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.duration}
            onChangeText={v => setForm(f => ({ ...f, duration: v }))}
            keyboardType="numeric"
            placeholder="60"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>{t('employer.interviews.modal.locationLabel')}</Text>
          <TextInput
            style={styles.input}
            value={form.location}
            onChangeText={v => setForm(f => ({ ...f, location: v }))}
            placeholder="Офис / Zoom / Google Meet"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.fieldLabel}>{t('employer.interviews.modal.notesLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form.notes}
            onChangeText={v => setForm(f => ({ ...f, notes: v }))}
            placeholder="Подготовьте портфолио..."
            placeholderTextColor="#9CA3AF"
            multiline
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSchedule} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('employer.interviews.schedule')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </>
  );
}

type StatusConfig = Record<string, { label: string; color: string; bg: string }>;

function InterviewCard({ interview: i, statusConfig, atLabel, durationLabel, candidateFallback, cancelLabel, onCancel }: {
  interview: Interview;
  statusConfig: StatusConfig;
  atLabel: string;
  durationLabel: string;
  candidateFallback: string;
  cancelLabel?: string;
  onCancel?: () => void;
}) {
  const cfg = statusConfig[i.status] ?? statusConfig.scheduled;
  const studentName = i.student ? `${i.student.first_name} ${i.student.last_name}` : candidateFallback;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.candidateName}>{studentName}</Text>
          <Text style={styles.vacancyTitle}>{i.vacancy?.title ?? ''}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <View style={styles.metaRow}><Text style={styles.metaIcon}>📅</Text><Text style={styles.metaText}>{formatDate(i.scheduled_at, atLabel)}</Text></View>
      <View style={styles.metaRow}><Text style={styles.metaIcon}>⏱</Text><Text style={styles.metaText}>{durationLabel}</Text></View>
      {i.location ? <View style={styles.metaRow}><Text style={styles.metaIcon}>📍</Text><Text style={styles.metaText}>{i.location}</Text></View> : null}
      {onCancel && i.status === 'scheduled' && cancelLabel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader:          { marginTop: 60 },
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  content:         { padding: 16, paddingBottom: 40 },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  header:          { fontSize: 22, fontWeight: '800', color: '#111827' },
  addBtn:          { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty:           { alignItems: 'center', paddingTop: 80 },
  emptyIcon:       { fontSize: 52, marginBottom: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  emptyText:       { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  candidateName:   { fontSize: 15, fontWeight: '700', color: '#111827' },
  vacancyTitle:    { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge:           { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:       { fontSize: 11, fontWeight: '700' },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  metaIcon:        { fontSize: 13, width: 20 },
  metaText:        { fontSize: 13, color: '#374151' },
  cancelBtn:       { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  cancelBtnText:   { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  modal:           { flex: 1, backgroundColor: '#F8FAFC' },
  modalContent:    { padding: 20, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: '#111827' },
  closeBtnText:    { fontSize: 20, color: '#6B7280' },
  fieldLabel:      { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input:           { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 14 },
  inputMulti:      { height: 80, textAlignVertical: 'top' },
  noApps:          { fontSize: 13, color: '#EF4444', marginBottom: 14 },
  appChip:         { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginRight: 8 },
  appChipActive:   { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  appChipText:     { fontSize: 12, color: '#374151', fontWeight: '600' },
  appChipTextActive:{ color: '#fff' },
  saveBtn:         { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
