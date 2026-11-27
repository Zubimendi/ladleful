import { err, ok, type AppError, type Result } from '@/lib/result';
import { clearAuthSession, getPocketBase, saveAuthSession } from './pb';

export interface AuthUser {
  id: string;
  email: string;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<Result<AuthUser, AppError>> {
  const pb = getPocketBase();
  if (!pb) {
    return err({ kind: 'network', message: 'Sync server URL is not configured.' });
  }
  try {
    const auth = await pb.collection('users').authWithPassword(email.trim(), password);
    const user: AuthUser = { id: auth.record.id, email: String(auth.record.email ?? email) };
    await saveAuthSession(auth.token, user);
    return ok(user);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 400 || status === 401) {
      return err({ kind: 'auth', message: 'Invalid email or password.' });
    }
    return err({ kind: 'network', message: 'Could not reach the sync server.' });
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<Result<AuthUser, AppError>> {
  const pb = getPocketBase();
  if (!pb) {
    return err({ kind: 'network', message: 'Sync server URL is not configured.' });
  }
  try {
    await pb.collection('users').create({
      email: email.trim(),
      password,
      passwordConfirm: password,
    });
    return signInWithEmail(email, password);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 400) {
      return err({ kind: 'validation', message: 'Check email format or password (min 8 chars).' });
    }
    return err({ kind: 'network', message: 'Could not create account.' });
  }
}

export async function signOut(): Promise<void> {
  await clearAuthSession();
}
