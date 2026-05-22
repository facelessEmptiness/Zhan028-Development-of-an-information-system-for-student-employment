import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Alert, Modal, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../services/api';
import { documentService, type Document } from '../services/documentService';
import Icon from '../components/Icon';

interface Student {
  user_id: string;
  first_name: string;
  last_name: string;
  iin?: string;
  phone?: string;
  location_city?: string;
  specialization?: string;
  graduation_year?: number;
  gpa?: number;
  skills?: string;
  diploma_verified?: boolean;
  email?: string;
}

export default function UniversityStudentsScreen() {
  const { t } = useTranslation();
  const [students,    setStudents]    = useState<Student[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState<Student | null>(null);
  const [docs,        setDocs]        = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const docStatusConfig = {
    pending:  { label: t('docs.status.pending'),  color: '#F59E0B', bg: '#FEF3C7' },
    verified: { label: t('docs.status.verified'), color: '#059669', bg: '#D1FAE5' },
    rejected: { label: t('docs.status.rejected'), color: '#EF4444', bg: '#FEE2E2' },
  };

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/students');
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : (data.students ?? []));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openStudent = async (student: Student) => {
    setSelected(student);
    setDocs([]);
    setDocsLoading(true);
    try {
      const data = await documentService.getStudentDocuments(student.user_id);
      setDocs(data);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleVerify = async (docId: string) => {
    try {
      await documentService.verifyDocument(docId);
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'verified' as const } : d));
      Alert.alert(t('common.success'), t('university.students.successVerify'));
    } catch {
      Alert.alert(t('common.error'), t('university.students.errorVerify'));
    }
  };

  const handleReject = (docId: string) => {
    Alert.prompt(
      t('university.students.rejectPromptTitle'),
      t('university.students.rejectPromptMsg'),
      async (reason) => {
        if (!reason?.trim()) return;
        try {
          await documentService.rejectDocument(docId, reason.trim());
          setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'rejected' as const, rejection_reason: reason } : d));
          Alert.alert(t('common.success'), t('university.students.successReject'));
        } catch {
          Alert.alert(t('common.error'), t('university.students.errorReject'));
        }
      },
      'plain-text',
    );
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !q
      || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
      || (s.specialization ?? '').toLowerCase().includes(q)
      || (s.email ?? '').toLowerCase().includes(q);
  });

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#059669" />;

  return (
    <>
      <View style={styles.container}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={t('university.students.search')}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.user_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#059669" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="graduation-cap" size={48} color="#D1D5DB" /></View>
              <Text style={styles.emptyText}>{t('university.students.noStudents')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openStudent(item)} activeOpacity={0.7}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.first_name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                  {item.specialization ? <Text style={styles.spec}>{item.specialization}</Text> : null}
                  {item.graduation_year ? <Text style={styles.year}>{t('university.students.graduation')} {item.graduation_year}</Text> : null}
                </View>
                {item.diploma_verified && (
                  <Icon name="check-circle" size={18} color="#059669" />
                )}
              </View>
              {item.gpa ? (
                <Text style={styles.gpa}>{t('university.students.gpa')}: {item.gpa}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      </View>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selected ? `${selected.first_name} ${selected.last_name}` : ''}
            </Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {selected && (
            <>
              {selected.specialization ? <InfoRow label={t('profileEdit.specialization')} value={selected.specialization} /> : null}
              {selected.graduation_year ? <InfoRow label={t('profileEdit.graduationYear')} value={String(selected.graduation_year)} /> : null}
              {selected.gpa ? <InfoRow label={t('university.students.gpa')} value={String(selected.gpa)} /> : null}
              {selected.location_city ? <InfoRow label={t('profileEdit.city')} value={selected.location_city} /> : null}
              {selected.phone ? <InfoRow label={t('profileEdit.phone')} value={selected.phone} /> : null}
              {selected.skills ? (
                <View style={styles.skillsSection}>
                  <Text style={styles.skillsLabel}>{t('profileEdit.skills')}:</Text>
                  <View style={styles.skillsWrap}>
                    {String(selected.skills ?? '').split(',').map(s => s.trim()).filter(Boolean).map(s => (
                      <View key={s} style={styles.skillChip}>
                        <Text style={styles.skillText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <Text style={styles.docsTitle}>{t('university.students.diploma')}</Text>
              {docsLoading
                ? <ActivityIndicator color="#059669" />
                : (() => {
                    const diplomaDocs = docs.filter(d => d.type === 'diploma');
                    if (diplomaDocs.length === 0) return <Text style={styles.noDocs}>{t('university.students.noDiploma')}</Text>;
                    return diplomaDocs.map(doc => {
                      const cfg = docStatusConfig[doc.status] ?? docStatusConfig.pending;
                      const decodedName = (() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })();
                      return (
                        <View key={doc.id} style={styles.docCard}>
                          <View style={styles.docRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.docName} numberOfLines={1}>{decodedName}</Text>
                              {doc.rejection_reason
                                ? <Text style={styles.rejectReason}>{t('university.students.rejectReason', { reason: doc.rejection_reason })}</Text>
                                : null}
                            </View>
                            <View style={[styles.docBadge, { backgroundColor: cfg.bg }]}>
                              <Text style={[styles.docBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                            </View>
                          </View>
                          {doc.status === 'pending' && (
                            <View style={styles.docActions}>
                              <TouchableOpacity
                                style={styles.verifyBtn}
                                onPress={() => handleVerify(doc.id)}
                              >
                                <Text style={styles.verifyBtnText}>{t('university.students.verify')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.rejectBtn}
                                onPress={() => handleReject(doc.id)}
                              >
                                <Text style={styles.rejectBtnText}>{t('university.students.reject')}</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    });
                  })()
              }
            </>
          )}
        </ScrollView>
      </Modal>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader:        { marginTop: 60 },
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  searchBox:     { padding: 12, paddingBottom: 4 },
  search:        { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  list:          { padding: 12, paddingBottom: 40 },
  empty:         { alignItems: 'center', paddingTop: 60 },
  emptyIcon:     { marginBottom: 10 },
  emptyText:     { fontSize: 15, color: '#9CA3AF' },
  card:          { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 18, fontWeight: '800', color: '#059669' },
  name:          { fontSize: 15, fontWeight: '700', color: '#111827' },
  spec:          { fontSize: 12, color: '#6B7280', marginTop: 2 },
  year:          { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  gpa:           { fontSize: 11, color: '#6B7280', marginTop: 6 },
  modal:         { flex: 1, backgroundColor: '#F8FAFC' },
  modalContent:  { padding: 20, paddingBottom: 40 },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1 },
  closeBtn:      { fontSize: 20, color: '#6B7280' },
  infoRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel:     { fontSize: 13, color: '#6B7280', width: 120 },
  infoValue:     { fontSize: 13, color: '#111827', fontWeight: '500', flex: 1 },
  skillsSection: { marginTop: 14 },
  skillsLabel:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  skillsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip:     { backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  skillText:     { fontSize: 12, color: '#059669', fontWeight: '600' },
  docsTitle:     { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 20, marginBottom: 12 },
  noDocs:        { fontSize: 13, color: '#9CA3AF' },
  docCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  docRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docName:       { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rejectReason:  { fontSize: 11, color: '#EF4444', marginTop: 3 },
  docBadge:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  docBadgeText:  { fontSize: 11, fontWeight: '700' },
  docActions:    { flexDirection: 'row', gap: 8, marginTop: 10 },
  verifyBtn:     { flex: 1, backgroundColor: '#D1FAE5', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  verifyBtnText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  rejectBtn:     { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  rejectBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
});
