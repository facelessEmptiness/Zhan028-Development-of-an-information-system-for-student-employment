import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ru from './locales/ru.json';
import kz from './locales/kz.json';
import en from './locales/en.json';

export const LANGUAGE_KEY = '@app_language';
export type AppLanguage = 'ru' | 'kz' | 'en';
export const LANGUAGES: AppLanguage[] = ['ru', 'kz', 'en'];

const resources = {
  ru: { translation: ru },
  kz: { translation: kz },
  en: { translation: en },
};

export async function initI18n(): Promise<void> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  const lng: AppLanguage = (saved as AppLanguage) ?? 'ru';

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
  });
}

export async function changeLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export default i18n;
