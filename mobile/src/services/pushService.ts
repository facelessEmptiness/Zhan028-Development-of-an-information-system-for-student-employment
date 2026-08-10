import { RefObject } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import { apiFetch } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Map notification type → screen name in the navigator
const SCREEN_MAP: Record<string, string> = {
  application_submitted: 'Applications',
  application_status:    'Applications',
  interview_scheduled:   'Interviews',
  chat_message:          'Chat',
  document_verified:     'Documents',
  document_rejected:     'Documents',
};

export const pushService = {
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('[Push] Not a physical device — push tokens unavailable');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn(`[Push] Notification permission not granted (status=${finalStatus})`);
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'e9303542-cecc-4648-bf7d-d8d51641f643',
      });
      console.log(`[Push] Got Expo token: ${tokenData.data}`);
      return tokenData.data;
    } catch (e) {
      // Don't fall back to getDevicePushTokenAsync(): that returns a raw FCM
      // token, which the backend would push to the Expo API in Expo-token
      // format and silently fail. A failure here almost always means FCM
      // credentials aren't configured for this build (see google-services.json
      // + EAS FCM V1 key).
      console.error('[Push] getExpoPushTokenAsync failed — FCM not configured?', e);
      return null;
    }
  },

  async syncTokenWithServer(expoPushToken: string): Promise<void> {
    try {
      await apiFetch('/api/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ push_token: expoPushToken, platform: Platform.OS }),
      });
      console.log('[Push] Token synced with server');
    } catch (e) {
      // Non-critical — app works without push token sync
      console.error('[Push] Failed to sync token with server', e);
    }
  },

  // Call once after login to register + sync token
  async setup(): Promise<void> {
    const token = await pushService.registerForPushNotifications();
    if (token) {
      await pushService.syncTokenWithServer(token);
    } else {
      console.warn('[Push] setup(): no token obtained — nothing synced');
    }
  },

  // Wire up listeners. Call in App root, pass navigationRef to handle taps.
  // Returns a cleanup function to call on unmount.
  addListeners(
    navigationRef?: RefObject<NavigationContainerRef<any> | null>,
  ): () => void {
    const navigate = (data: Record<string, string>, title?: string) => {
      if (!navigationRef?.current?.isReady()) return;
      const nav = navigationRef.current;
      const screen = data?.screen ?? SCREEN_MAP[data?.type] ?? 'Notifications';

      if (screen === 'Chat') {
        // related_id is "<applicationId>:<vacancyId>" — Chat needs applicationId + title.
        // Navigating to Chat without params crashes the screen, so guard it.
        const applicationId = (data?.related_id ?? '').split(':')[0];
        if (!applicationId) {
          nav.navigate('Notifications' as never);
          return;
        }
        nav.navigate('Chat' as never, {
          applicationId,
          title: title ?? 'Чат',
          standalone: true,
        } as never);
        return;
      }

      // Other types: the in-app Notifications screen is always present at the root
      // and needs no params, so it's the safe landing spot from a push tap.
      nav.navigate('Notifications' as never);
    };

    // Foreground: notification received while app is open
    const foregroundSub = Notifications.addNotificationReceivedListener(
      notification => {
        const { title, body } = notification.request.content;
        console.log(`[Push] Foreground: ${title} — ${body}`);
      },
    );

    // Tap: app was backgrounded and user tapped notification
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      response => {
        const { data, title } = response.notification.request.content;
        navigate(data as Record<string, string>, title ?? undefined);
      },
    );

    // Killed app: if user tapped notification that cold-launched the app,
    // the response is already consumed before the listener above fires
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const { data, title } = response.notification.request.content;
      // Small delay to let NavigationContainer mount first
      setTimeout(() => navigate(data as Record<string, string>, title ?? undefined), 500);
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  },
};
