import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { employerProfileService, type ProfileInput } from '../services/employerProfileService';

const INDUSTRIES = ['Технологии', 'Финансы', 'Образование', 'Здравоохранение', 'Производство', 'Торговля', 'Консалтинг', 'Медиа', 'Строительство', 'Другое'];
const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

const emptyForm: ProfileInput = {
  company_name: '', company_description: '', industry: '', company_size: '',
  website: '', location: '', contact_email: '', contact_phone: '', bin: '', bin_status: '',
};

export default function EmployerCompanyProfileScreen() {
  const { t } = useTranslation();
  const [form,    setForm]    = useState<ProfileInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [exists,  setExists]  = useState(false);

  useEffect(() => {
    employerProfileService.getProfile()
      .then(p => {
        setExists(true);
        setForm({
          company_name:        p.company_name        ?? '',
          company_description: p.company_description ?? '',
          industry:            p.industry            ?? '',
          company_size:        p.company_size        ?? '',
          website:             p.website             ?? '',
          location:            p.location            ?? '',
          contact_email:       p.contact_email       ?? '',
          contact_phone:       p.contact_phone       ?? '',
          bin:                 p.bin                 ?? '',
          bin_status:          p.bin_status          ?? '',
        });
      })
      .catch(() => setExists(false))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ProfileInput) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      Alert.alert(t('common.error'), t('employer.company.error.name'));
      return;
    }
    setSaving(true);
    try {
      await employerProfileService.saveProfile(form, exists);
      setExists(true);
      Alert.alert(t('common.success'), t('employer.company.saved'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('employer.company.error.save'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#7C3AED" />;

  const binVerified = form.bin_status === 'verified';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {binVerified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>{t('employer.company.binVerified')}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.company.mainInfo')}</Text>
          <Field label={t('employer.company.nameLabel')} value={form.company_name} onChangeText={set('company_name')} placeholder="ТОО «Моя компания»" />
          <Field label={t('employer.company.binLabel')} value={form.bin} onChangeText={set('bin')} placeholder="12 цифр" keyboardType="numeric" maxLength={12} />
          <Field label={t('employer.company.industryLabel')} value={form.industry} onChangeText={set('industry')} placeholder="Технологии" />
          <View style={styles.field}>
            <Text style={styles.label}>{t('employer.company.sizeLabel')}</Text>
            <View style={styles.chipRow}>
              {SIZES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, form.company_size === s && styles.chipActive]}
                  onPress={() => set('company_size')(s)}
                >
                  <Text style={[styles.chipText, form.company_size === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.company.contacts')}</Text>
          <Field label="Email"                      value={form.contact_email}  onChangeText={set('contact_email')}  placeholder="hr@company.kz" keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('profileEdit.phone')}     value={form.contact_phone}  onChangeText={set('contact_phone')}  placeholder="+7 700 000 0000" keyboardType="phone-pad" />
          <Field label="Website" value={form.website} onChangeText={set('website')} placeholder="https://company.kz" autoCapitalize="none" />
          <Field label={t('profileEdit.city')}      value={form.location}       onChangeText={set('location')}       placeholder="Алматы" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('employer.company.about')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={form.company_description}
            onChangeText={set('company_description')}
            placeholder={t('employer.company.about')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{exists ? t('employer.company.saveBtn') : t('employer.company.createBtn')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, maxLength, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
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
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader:         { marginTop: 60 },
  container:      { flex: 1, backgroundColor: '#F8FAFC' },
  content:        { padding: 16, paddingBottom: 40 },
  verifiedBadge:  { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center' },
  verifiedText:   { color: '#047857', fontWeight: '700', fontSize: 13 },
  section:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  field:          { marginBottom: 12 },
  label:          { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  input:          { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  inputMulti:     { height: 110, textAlignVertical: 'top' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  chipActive:     { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText:       { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  saveBtn:        { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
});
