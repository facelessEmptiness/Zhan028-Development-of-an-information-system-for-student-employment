import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { employerVacancyService } from '../services/employerVacancyService';
import type { EmployerStackParamList } from '../navigation/MainNavigator';

type RouteType = RouteProp<EmployerStackParamList, 'VacancyForm'>;

const JOB_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract'] as const;

export default function EmployerVacancyFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const existing = route.params?.vacancy;

  const [form, setForm] = useState({
    title:       existing?.title       ?? '',
    description: existing?.description ?? '',
    location:    existing?.location    ?? '',
    salary_min:  existing?.salary_min  ? String(existing.salary_min) : '',
    salary_max:  existing?.salary_max  ? String(existing.salary_max) : '',
    job_type:    existing?.job_type    ?? 'Full-time',
    skills:      existing?.skills      ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert(t('common.error'), t('employer.vacancy.error'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim(),
        location:    form.location.trim(),
        salary_min:  form.salary_min ? parseInt(form.salary_min) : 0,
        salary_max:  form.salary_max ? parseInt(form.salary_max) : 0,
        job_type:    form.job_type,
        skills:      form.skills.trim(),
      };
      if (existing) {
        await employerVacancyService.update(existing.id, payload);
      } else {
        await employerVacancyService.create(payload);
      }
      Alert.alert(t('common.success'), existing ? t('employer.vacancy.saveSuccess') : t('employer.vacancy.createSuccess'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('employer.vacancy.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.vacancy.mainInfoTitle')}</Text>
          <Field label={t('employer.vacancy.nameLabel')}     value={form.title}       onChangeText={set('title')}       placeholder="Frontend разработчик" />
          <Field label={t('employer.vacancy.locationLabel')} value={form.location}    onChangeText={set('location')}    placeholder="Алматы / Удалённо" />
          <Field label={t('employer.vacancy.skillsLabel')}   value={form.skills}      onChangeText={set('skills')}      placeholder="React, TypeScript, Git" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.vacancy.jobTypeTitle')}</Text>
          <View style={styles.typeRow}>
            {JOB_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, form.job_type === t && styles.typeChipActive]}
                onPress={() => set('job_type')(t)}
              >
                <Text style={[styles.typeChipText, form.job_type === t && styles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.vacancy.salaryTitle')}</Text>
          <View style={styles.salaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('employer.vacancy.salaryFrom')}</Text>
              <TextInput
                style={styles.input}
                value={form.salary_min}
                onChangeText={set('salary_min')}
                placeholder="100 000"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Text style={styles.salaryDash}>—</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('employer.vacancy.salaryTo')}</Text>
              <TextInput
                style={styles.input}
                value={form.salary_max}
                onChangeText={set('salary_max')}
                placeholder="200 000"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.vacancy.descriptionTitle')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form.description}
            onChangeText={set('description')}
            placeholder={t('employer.vacancy.descriptionPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{existing ? t('employer.vacancy.saveBtn') : t('employer.vacancy.createBtn')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F8FAFC' },
  content:           { padding: 16, paddingBottom: 40 },
  section:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle:      { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  field:             { marginBottom: 12 },
  label:             { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  input:             { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  inputMulti:        { height: 120, textAlignVertical: 'top' },
  typeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  typeChipActive:    { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  typeChipText:      { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  typeChipTextActive:{ color: '#fff' },
  salaryRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  salaryDash:        { fontSize: 18, color: '#9CA3AF', paddingBottom: 10 },
  saveBtn:           { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
});
