import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'api_cache:';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getCached(url: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + url);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: string; ts: number };
    if (Date.now() - ts > TTL_MS) {
      AsyncStorage.removeItem(PREFIX + url).catch(() => {});
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function setCached(url: string, data: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + url, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch {}
}
