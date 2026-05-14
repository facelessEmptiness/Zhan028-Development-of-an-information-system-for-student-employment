import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { formatDate } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import {
  documentService,
  type Document,
  type DocumentType,
} from '../services/documentService';

const DOC_ICONS: Record<DocumentType, string> = {
  cv:          '📄',
  diploma:     '🎓',
  certificate: '📜',
};

const DOC_TYPES: DocumentType[] = ['cv', 'diploma', 'certificate'];

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const [docs,       setDocs]       = useState<Document[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading,  setUploading]  = useState<DocumentType | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await documentService.getMyDocuments();
      setDocs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (docType: DocumentType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
               'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = (() => { try { return decodeURIComponent(file.name); } catch { return file.name; } })();
      setUploading(docType);
      await documentService.uploadDocument(
        file.uri,
        fileName,
        file.mimeType ?? 'application/octet-stream',
        docType,
      );
      Alert.alert(t('common.success'), t('docs.uploadSuccess', { type: t(`docs.types.${docType}`) }));
      await load();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('docs.uploadError'));
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = (doc: Document) => {
    const decodedName = (() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })();
    Alert.alert(t('docs.delete.title'), t('docs.delete.confirm', { type: t(`docs.types.${doc.type}`), name: decodedName }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('docs.delete.btn'), style: 'destructive', onPress: async () => {
        try {
          await documentService.deleteDocument(doc.id);
          setDocs(prev => prev.filter(d => d.id !== doc.id));
        } catch {
          Alert.alert(t('common.error'), t('docs.deleteError'));
        }
      }},
    ]);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
    >
      <Text style={styles.header}>{t('docs.header')}</Text>
      <Text style={styles.subheader}>{t('docs.subheader')}</Text>

      {DOC_TYPES.map(type => {
        const typeDocs = docs.filter(d => d.type === type);
        const isUploading = uploading === type;
        const STATUS_CONFIG = {
          pending:  { label: t('docs.status.pending'),  color: '#F59E0B', bg: '#FEF3C7' },
          verified: { label: t('docs.status.verified'), color: '#059669', bg: '#D1FAE5' },
          rejected: { label: t('docs.status.rejected'), color: '#EF4444', bg: '#FEE2E2' },
        };

        return (
          <View key={type} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{DOC_ICONS[type]}</Text>
              <Text style={styles.sectionTitle}>{t(`docs.types.${type}`)}</Text>
              <TouchableOpacity
                style={[styles.uploadBtn, isUploading && styles.uploadBtnDisabled]}
                onPress={() => handleUpload(type)}
                disabled={isUploading}
              >
                {isUploading
                  ? <ActivityIndicator size="small" color="#2563EB" />
                  : <Text style={styles.uploadBtnText}>{t('docs.uploadBtn')}</Text>
                }
              </TouchableOpacity>
            </View>

            {typeDocs.length === 0 ? (
              <View style={styles.emptyDoc}>
                <Text style={styles.emptyDocText}>{t('docs.emptyDoc')}</Text>
              </View>
            ) : (
              typeDocs.map(doc => {
                const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending;
                const showStatus = doc.type === 'diploma';
                const decodedName = (() => { try { return decodeURIComponent(doc.file_name); } catch { return doc.file_name; } })();
                return (
                  <View key={doc.id} style={styles.docCard}>
                    <View style={styles.docRow}>
                      <View style={styles.docInfo}>
                        <Text style={styles.docName} numberOfLines={1}>{decodedName}</Text>
                        <Text style={styles.docMeta}>
                          {formatSize(doc.file_size)} · {formatDate(doc.created_at)}
                        </Text>
                        {showStatus && doc.rejection_reason ? (
                          <Text style={styles.rejectReason}>{t('docs.rejectReason', { reason: doc.rejection_reason })}</Text>
                        ) : null}
                      </View>
                      {showStatus ? (
                        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.statusText, { color: '#059669' }]}>{t('docs.uploaded')}</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(doc)}>
                      <Text style={styles.deleteBtnText}>{t('docs.deleteBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        );
      })}

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>{t('docs.tipTitle')}</Text>
        <Text style={styles.tipText}>{t('docs.tipText')}</Text>
        <Text style={styles.tipText}>{t('docs.tipNote')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loader:        { marginTop: 60 },
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  content:       { padding: 16, paddingBottom: 40 },
  header:        { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subheader:     { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  section:       { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIcon:   { fontSize: 20, marginRight: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  uploadBtn:     { borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  uploadBtnDisabled: { borderColor: '#93C5FD' },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  emptyDoc:      { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  emptyDocText:  { fontSize: 13, color: '#9CA3AF' },
  docCard:       { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 8 },
  docRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  docInfo:       { flex: 1 },
  docName:       { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 2 },
  docMeta:       { fontSize: 11, color: '#9CA3AF' },
  rejectReason:  { fontSize: 11, color: '#EF4444', marginTop: 4 },
  statusBadge:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusText:    { fontSize: 11, fontWeight: '700' },
  deleteBtn:     { marginTop: 8, alignSelf: 'flex-start' },
  deleteBtnText: { fontSize: 12, color: '#EF4444' },
  tipCard:       { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16 },
  tipTitle:      { fontSize: 14, fontWeight: '700', color: '#1D4ED8', marginBottom: 8 },
  tipText:       { fontSize: 12, color: '#3B82F6', lineHeight: 20, marginBottom: 6 },
});
