import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES, type AppLanguage } from '../i18n';

const FLAG: Record<AppLanguage, string> = { ru: '🇷🇺', kz: '🇰🇿', en: '🇬🇧' };

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = i18n.language as AppLanguage;

  const select = async (lang: AppLanguage) => {
    setOpen(false);
    await changeLanguage(lang);
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.flag}>{FLAG[current] ?? '🌐'}</Text>
        <Text style={styles.label}>{t(`language.${current}`)}</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('language.label')}</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.option, current === lang && styles.optionActive]}
                onPress={() => select(lang)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionFlag}>{FLAG[lang]}</Text>
                <Text style={[styles.optionText, current === lang && styles.optionTextActive]}>
                  {t(`language.${lang}`)}
                </Text>
                {current === lang && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn:            { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#F3F4F6', borderRadius: 10 },
  flag:           { fontSize: 18 },
  label:          { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 },
  arrow:          { fontSize: 18, color: '#9CA3AF' },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle:     { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  option:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optionActive:   { backgroundColor: '#EFF6FF' },
  optionFlag:     { fontSize: 24 },
  optionText:     { fontSize: 15, color: '#374151', flex: 1 },
  optionTextActive:{ fontWeight: '700', color: '#2563EB' },
  check:          { fontSize: 16, color: '#2563EB', fontWeight: '700' },
});
