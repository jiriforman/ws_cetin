import { supabase } from '@/integrations/supabase/client';

const ADMIN_SESSION_KEY = 'narcos_admin_session';

export const getAdminSession = (): string | null => {
  try {
    return localStorage.getItem(ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
};

export const setAdminSession = (session: string | null) => {
  try {
    if (session) localStorage.setItem(ADMIN_SESSION_KEY, session);
    else localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // storage unavailable (private mode) - session lasts for this page only
  }
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: Record<string, unknown>) {
    super(message);
  }
}

const invoke = async <T>(fn: string, body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Non-2xx: pull the server's error message out of the response
    const response: Response | undefined = (error as { context?: Response }).context;
    let message = error.message;
    let body: Record<string, unknown> | undefined;
    try {
      body = await response?.json();
      message = (body?.error as string) ?? message;
    } catch {
      // not JSON
    }
    throw new ApiError(response?.status ?? 0, message, body);
  }
  return data as T;
};

export const adminLogin = async (password: string) => {
  const { session } = await invoke<{ session: string }>('admin-api', { action: 'login', password });
  setAdminSession(session);
  return session;
};

export const adminApi = async <T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}) => {
  try {
    return await invoke<T>('admin-api', { action, session: getAdminSession(), ...payload });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) setAdminSession(null);
    throw err;
  }
};

export const teamApi = <T = Record<string, unknown>>(action: string, token: string, payload: Record<string, unknown> = {}) =>
  invoke<T>('team-api', { action, token, ...payload });

/** Team codes (tokens) shown on the Cartel Rankings; empty when switched off with HIDE_TEAM_CODES. */
export const publicTeamCodes = () =>
  invoke<{ codes: { id: string; token: string }[]; hidden?: boolean; api_version?: string }>('team-codes', {});

/** Negotiation Room (supplier chat) for teams; the team token is the credential. */
export const negotiationApi = <T = Record<string, unknown>>(action: string, token: string, payload: Record<string, unknown> = {}) =>
  invoke<T>('negotiation-api', { action, token, ...payload });

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/** Validates a file and uploads it to a bucket through a signed URL issued by an edge function. */
export const uploadFile = async (
  bucket: string,
  file: File,
  allowedExtensions: string[],
  maxBytes: number,
  getUploadUrl: (ext: string) => Promise<{ path: string; token: string; publicUrl: string }>,
) => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!allowedExtensions.includes(ext)) throw new Error(`Please upload one of: ${allowedExtensions.join(', ').toUpperCase()}`);
  if (file.size > maxBytes) throw new Error(`Please upload a file smaller than ${Math.round(maxBytes / 1024 / 1024)}MB`);

  const { path, token, publicUrl } = await getUploadUrl(ext);
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
  if (error) throw error;
  return publicUrl;
};

/** Validates an image and uploads it through a signed URL issued by an edge function. */
export const uploadImage = (
  file: File,
  getUploadUrl: (ext: string) => Promise<{ path: string; token: string; publicUrl: string }>,
) => uploadFile('team-logos', file, IMAGE_EXTENSIONS, 2 * 1024 * 1024, getUploadUrl);
