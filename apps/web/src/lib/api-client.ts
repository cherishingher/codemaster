// Simple fetch wrapper to handle credentials and base URL
const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export async function client<T = unknown>(
  endpoint: string,
  { params, ...customConfig }: FetchOptions = {}
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(customConfig.headers || {}),
  };

  const config: RequestInit = {
    method: 'GET',
    headers,
    credentials: 'include', // Important for HttpOnly cookies
    ...customConfig,
  };

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, config);
  const data: unknown = await response.json().catch(() => ({}));

  if (response.ok) {
    return data as T;
  }

  throw new ApiError(response.status, getErrorMessage(data, response.statusText), data);
}

// Type-safe endpoints
export const api = {
  auth: {
    me: <T = unknown>() => client<T>('/auth/me'),
    login: (body: { identifier?: string; email?: string; phone?: string; password: string }) =>
      client('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body: { identifier: string; password: string; name?: string; code: string }) =>
      client('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    requestCode: (body: { identifier: string; purpose?: string }) =>
      client('/auth/request-code', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (body: { identifier: string; password: string; code: string }) =>
      client('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
    logout: <T = unknown>() => client<T>('/auth/logout', { method: 'POST' }),
  },
  problems: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>('/problems', { params }),
    get: <T = unknown>(id: string) => client<T>(`/problems/${id}`),
    submit: <T = unknown>(id: string, code: string, language: string) =>
      client<T>(`/problems/${id}/submit`, {
        method: 'POST', 
        body: JSON.stringify({ code, language }) 
      }),
    run: <T = unknown>(id: string, code: string, language: string, input: string) =>
      client<T>(`/problems/${id}/run`, {
        method: 'POST',
        body: JSON.stringify({ code, language, input })
      }),
  },
  submissions: {
    list: <T = unknown>(params?: Record<string, string>) =>
      client<T>('/submissions', { params }),
    get: <T = unknown>(id: string) => client<T>(`/submissions/${id}`),
  },
  progress: {
    list: <T = unknown>() => client<T>('/progress'),
  }
};
