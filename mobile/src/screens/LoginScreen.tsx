import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ onGoRegister, onGoForgot }: {
  onGoRegister?: () => void;
  onGoForgot?: () => void;
}) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('login.error.empty'));
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert(t('login.error.title'), e.message ?? t('login.error.checkData'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.logoBox}>
          <Image
            source={require('../../assets/CareerBond.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoSub}>{t('login.appSub')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('login.title')}</Text>

          <Text style={styles.label}>{t('login.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>{t('login.passwordLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('login.submitBtn')}</Text>
            }
          </TouchableOpacity>

          {onGoForgot && (
            <TouchableOpacity onPress={onGoForgot} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {onGoRegister && (
          <TouchableOpacity onPress={onGoRegister} style={styles.registerBtn}>
            <Text style={styles.registerText}>
              {t('login.noAccount')} <Text style={styles.registerBold}>{t('login.registerLink')}</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: '#F8FAFC' },
  container:  { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBox:    { alignItems: 'center', marginBottom: 36 },
  logoImage:  { width: 200, height: 100, marginBottom: 8 },
  logoSub:    { fontSize: 14, color: '#6B7280', marginTop: 2 },
  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle:  { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  btn:        { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotBtn:    { alignItems: 'center', marginTop: 12 },
  forgotText:   { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  registerBtn:  { alignItems: 'center', marginTop: 20 },
  registerText: { fontSize: 13, color: '#9CA3AF' },
  registerBold: { fontWeight: '700', color: '#2563EB' },
});
