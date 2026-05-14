import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import MainNavigator        from './src/navigation/MainNavigator';
import LoginScreen          from './src/screens/LoginScreen';
import RegisterScreen       from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import VerifyEmailScreen    from './src/screens/VerifyEmailScreen';
import { initI18n } from './src/i18n';

type AuthScreen = 'login' | 'register' | 'forgot' | { verify: string };

function AppContent() {
  const { user, loading } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!user) {
    if (authScreen === 'register') {
      return (
        <RegisterScreen
          onGoLogin={() => setAuthScreen('login')}
          onVerify={email => setAuthScreen({ verify: email })}
        />
      );
    }
    if (authScreen === 'forgot') {
      return <ForgotPasswordScreen onGoLogin={() => setAuthScreen('login')} />;
    }
    if (typeof authScreen === 'object' && 'verify' in authScreen) {
      return (
        <VerifyEmailScreen
          email={authScreen.verify}
          onSuccess={() => setAuthScreen('login')}
          onGoLogin={() => setAuthScreen('login')}
        />
      );
    }
    return (
      <LoginScreen
        onGoRegister={() => setAuthScreen('register')}
        onGoForgot={() => setAuthScreen('forgot')}
      />
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <MainNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
