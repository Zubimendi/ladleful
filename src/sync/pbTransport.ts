import { getPocketBase } from '@/api/pb';
import type { PullResult, PushResult, SyncTransport } from './engine';

export function createPocketBaseTransport(): SyncTransport | null {
  const pb = getPocketBase();
  if (!pb) return null;

  return {
    pushCreate: async (collection, ownerId, record): Promise<PushResult> => {
      try {
        await pb.collection(collection).create({ ...record, owner: ownerId });
        return { status: 'ok' };
      } catch (e: unknown) {
        return mapPbError(e);
      }
    },
    pushUpdate: async (collection, id, record): Promise<PushResult> => {
      try {
        const { owner: _owner, ...withoutOwner } = record;
        await pb.collection(collection).update(id, withoutOwner);
        return { status: 'ok' };
      } catch (e: unknown) {
        return mapPbError(e);
      }
    },
    pullPage: async (collection, cursor, perPage): Promise<PullResult> => {
      try {
        const res = await pb.collection(collection).getList(1, perPage, {
          filter: `updated >= "${cursor}"`,
          sort: 'updated,id',
        });
        return { status: 'ok', items: res.items as unknown as Array<Record<string, unknown>> };
      } catch (e: unknown) {
        const status = (e as { status?: number })?.status ?? 0;
        if (status === 401) return { status: 'auth', message: 'Sign in again.' };
        return { status: 'retryable', message: 'Pull failed.' };
      }
    },
  };
}

function mapPbError(e: unknown): PushResult {
  const errObj = e as { status?: number; response?: { record?: Record<string, unknown>; message?: string } };
  const status = errObj?.status ?? 0;
  if (status === 401) return { status: 'auth', message: 'Sign in again.' };
  if (status === 404) return { status: 'not_found' };
  if (status === 409) {
    return { status: 'conflict', serverRecord: errObj.response?.record ?? {} };
  }
  if (status === 400 || status === 403 || status === 422) {
    return { status: 'permanent', code: status, message: errObj.response?.message ?? 'validation_error' };
  }
  return { status: 'retryable', code: status, message: 'network_or_server' };
}
