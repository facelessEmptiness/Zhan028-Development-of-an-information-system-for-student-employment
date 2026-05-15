import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import Icon from '../components/Icon';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { type StudentStackParamList } from '../navigation/MainNavigator';
import { applicationService } from '../services/applicationService';

type Props = NativeStackScreenProps<StudentStackParamList, 'JobDetail'>;

export default function JobDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { vacancy } = route.params;
  const [modalVisible, setModalVisible] = useState(false);
  const [coverLetter,  setCoverLetter]  = useState('');
  const [applying,     setApplying]     = useState(false);

  const handleApply = async () => {
    if (!coverLetter.trim()) {
      Alert.alert(t('common.error'), t('jobDetail.modal.error'));
      return;
    }
    setApplying(true);
    try {
      await applicationService.apply(vacancy.id, coverLetter, 0);
      setModalVisible(false);
      Alert.alert(t('common.success'), t('jobDetail.modal.success'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? t('common.error'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{vacancy.title}</Text>
          {vacancy.company_name ? <Text style={styles.company}>{vacancy.company_name}</Text> : null}
          <View style={styles.metaRow}>
            {vacancy.location ? (
              <View style={styles.metaItem}>
                <Icon name="pin" size={13} color="#6B7280" />
                <Text style={styles.metaText}>{vacancy.location}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Icon name="briefcase" size={13} color="#6B7280" />
              <Text style={styles.metaText}>{vacancy.job_type}</Text>
            </View>
          </View>
          {vacancy.salary_min > 0 && (
            <View style={styles.salaryBox}>
              <Text style={styles.salaryText}>
                ₸ {vacancy.salary_min.toLocaleString()} – {vacancy.salary_max.toLocaleString()} {t('jobDetail.monthSalary')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('jobDetail.description')}</Text>
          <Text style={styles.description}>{vacancy.description}</Text>
        </View>

        {vacancy.skills ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('jobDetail.skills')}</Text>
            <View style={styles.skills}>
              {vacancy.skills.split(',').map((s: string) => (
                <View key={s} style={styles.skill}>
                  <Text style={styles.skillText}>{s.trim()}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
          <Text style={styles.applyBtnText}>{t('jobDetail.applyBtn')}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('jobDetail.modal.title')}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Icon name="x" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>{t('jobDetail.modal.sub', { title: vacancy.title })}</Text>
          <TextInput
            style={styles.textarea}
            placeholder={t('jobDetail.modal.placeholder')}
            placeholderTextColor="#9CA3AF"
            value={coverLetter}
            onChangeText={txt => setCoverLetter(txt.slice(0, 2000))}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={[styles.charCount, coverLetter.length >= 1900 && styles.charCountWarn]}>
            {coverLetter.length} / 2000
          </Text>
          <TouchableOpacity
            style={[styles.submitBtn, applying && styles.submitBtnDisabled]}
            onPress={handleApply}
            disabled={applying}
            activeOpacity={0.85}
          >
            {applying
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>{t('jobDetail.modal.submitBtn')}</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  content:         { padding: 20 },
  header:          { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  title:           { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  company:         { fontSize: 15, color: '#6B7280', marginBottom: 10 },
  metaRow:         { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:        { fontSize: 13, color: '#6B7280' },
  salaryBox:       { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  salaryText:      { color: '#1D4ED8', fontWeight: '700', fontSize: 15 },
  section:         { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  description:     { fontSize: 14, color: '#374151', lineHeight: 22 },
  skills:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill:           { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  skillText:       { fontSize: 13, color: '#1D4ED8', fontWeight: '500' },
  footer:          { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  applyBtn:        { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyBtnText:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  modal:           { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle:      { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalClose:      { padding: 4 },
  modalSub:        { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  textarea:        { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  charCount:       { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: -10, marginBottom: 12 },
  charCountWarn:   { color: '#EF4444' },
  submitBtn:       { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
});
