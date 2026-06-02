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
    if (!Device.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

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
      return tokenData.data;
    } catch {
      const native = await Notifications.getDevicePushTokenAsync();
      return native.data as string;
    }
  },

  async syncTokenWithServer(expoPushToken: string): Promise<void> {
    try {
      await apiFetch('/api/notifications/push-token', {
        method: 'POST',
        body: JSON.stringify({ push_token: expoPushToken, platform: Platform.OS }),
      });
    } catch {
      // Non-critical — app works without push token sync
    }
  },

  // Call once after login to register + sync token
  async setup(): Promise<void> {
    const token = await pushService.registerForPushNotifications();
    if (token) {
      await pushService.syncTokenWithServer(token);
    }
  },

  // Wire up listeners. Call in App root, pass navigationRef to handle taps.
  // Returns a cleanup function to call on unmount.
  addListeners(
    navigationRef?: RefObject<NavigationContainerRef<any> | null>,
  ): () => void {
    const navigate = (data: Record<string, string>) => {
      const screen = data?.screen ?? SCREEN_MAP[data?.type] ?? 'Notifications';
      if (navigationRef?.current?.isReady()) {
        navigationRef.current.navigate(screen as never);
      }
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
        const data = response.notification.request.content.data as Record<string, string>;
        navigate(data);
      },
    );

    // Killed app: if user tapped notification that cold-launched the app,
    // the response is already consumed before the listener above fires
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string>;
      // Small delay to let NavigationContainer mount first
      setTimeout(() => navigate(data), 500);
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  },
};
