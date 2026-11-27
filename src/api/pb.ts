import * as SecureStore from 'expo-secure-store';
import PocketBase from 'pocketbase';

const TOKEN_KEY = 'ladleful_pb_token';
const USER_KEY = 'ladleful_pb_user';

export function getApiUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
}

export function isSyncConfigured(): boolean {
  return getApiUrl().length > 0;
}

let _pb: PocketBase | null = null;

export function getPocketBase(): PocketBase | null {
  const url = getApiUrl();
  if (!url) return null;
  if (!_pb || _pb.baseURL !== url) {
    _pb = new PocketBase(url);
  }
  return _pb;
}

export async function saveAuthSession(token: string, user: { id: string; email: string }): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadAuthSession(): Promise<{ token: string; user: { id: string; email: string } } | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const rawUser = await SecureStore.getItemAsync(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as { id: string; email: string };
    const pb = getPocketBase();
    if (pb) {
      pb.authStore.save(token, {
        ...user,
        collectionId: '_pb_users_auth_',
        collectionName: 'users',
      });
    }
    return { token, user };
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  _pb?.authStore.clear();
}
