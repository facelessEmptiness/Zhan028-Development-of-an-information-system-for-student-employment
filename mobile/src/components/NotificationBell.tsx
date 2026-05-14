import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '../services/notificationService';

export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const [count, setCount] = useState(0);

  useEffect(() => {
    notificationService.getUnreadCount()
      .then(setCount)
      .catch(() => {});

    const interval = setInterval(() => {
      notificationService.getUnreadCount().then(setCount).catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => navigation.navigate('Notifications')}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>🔔</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  icon:      { fontSize: 22 },
  badge:     { position: 'absolute', top: 4, right: 2, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
});
