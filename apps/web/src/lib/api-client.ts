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
    solutions: <T = unknown>(id: string) => client<T>(`/problems/${id}/solutions`),
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
  },
  products: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>('/products', { params }),
    get: <T = unknown>(id: string) => client<T>(`/products/${id}`),
  },
  contentPacks: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>('/content-packs', { params }),
    get: <T = unknown>(id: string) => client<T>(`/content-packs/${id}`),
  },
  community: {
    groups: {
      list: <T = unknown>(params?: Record<string, string>) => client<T>("/community/groups", { params }),
      get: <T = unknown>(id: string) => client<T>(`/community/groups/${id}`),
      create: <T = unknown>(body: unknown) =>
        client<T>("/community/groups", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      join: <T = unknown>(id: string) =>
        client<T>(`/community/groups/${id}/join`, {
          method: "POST",
          body: JSON.stringify({}),
        }),
    },
    feed: {
      list: <T = unknown>(params?: Record<string, string>) => client<T>("/community/feed", { params }),
      createPost: <T = unknown>(body: unknown) =>
        client<T>("/community/posts", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      getPost: <T = unknown>(id: string) => client<T>(`/community/posts/${id}`),
      comment: <T = unknown>(id: string, body: unknown) =>
        client<T>(`/community/posts/${id}/comments`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
    points: {
      me: <T = unknown>() => client<T>("/community/me/points"),
      rewards: <T = unknown>() => client<T>("/community/rewards"),
      redeem: <T = unknown>(id: string) =>
        client<T>(`/community/rewards/${id}/redeem`, {
          method: "POST",
          body: JSON.stringify({}),
        }),
    },
  },
  camps: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>("/camps", { params }),
    get: <T = unknown>(id: string) => client<T>(`/camps/${id}`),
    enrollment: <T = unknown>(id: string) => client<T>(`/camps/${id}/enrollment`),
    tasks: <T = unknown>(id: string, params?: Record<string, string>) =>
      client<T>(`/camps/${id}/tasks`, { params }),
    checkin: <T = unknown>(id: string, body: unknown) =>
      client<T>(`/camps/${id}/checkins`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    rankings: <T = unknown>(id: string, params?: Record<string, string>) =>
      client<T>(`/camps/${id}/rankings`, { params }),
    graduationReport: <T = unknown>(id: string, params?: Record<string, string>) =>
      client<T>(`/camps/${id}/graduation-report`, { params }),
  },
  campClasses: {
    get: <T = unknown>(id: string) => client<T>(`/camp-classes/${id}`),
  },
  contests: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>("/contests", { params }),
    get: <T = unknown>(id: string) => client<T>(`/contests/${id}`),
    registration: <T = unknown>(id: string) => client<T>(`/contests/${id}/registration`),
    register: <T = unknown>(id: string) =>
      client<T>(`/contests/${id}/registration`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    rankings: <T = unknown>(id: string, params?: Record<string, string>) =>
      client<T>(`/contests/${id}/rankings`, { params }),
    analysis: <T = unknown>(id: string) => client<T>(`/contests/${id}/analysis`),
    report: <T = unknown>(id: string) => client<T>(`/contests/${id}/report`),
  },
  me: {
    assets: <T = unknown>() => client<T>('/me/assets'),
    orders: <T = unknown>(params?: Record<string, string>) => client<T>('/me/orders', { params }),
  },
  membership: {
    me: <T = unknown>() => client<T>('/membership/me'),
    benefits: <T = unknown>() => client<T>('/membership/benefits'),
  },
  access: {
    check: <T = unknown>(params: { resourceType: string; resourceId: string }) =>
      client<T>('/access/check', {
        params,
      }),
  },
  contentAccess: {
    check: <T = unknown>(params: { resourceType: string; resourceId: string }) =>
      client<T>('/access/check', {
        params,
      }),
  },
  videos: {
    get: <T = unknown>(id: string) => client<T>(`/videos/${id}`),
  },
  solutions: {
    get: <T = unknown>(id: string) => client<T>(`/solutions/${id}`),
  },
  trainingPaths: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>('/training-paths', { params }),
    get: <T = unknown>(id: string) => client<T>(`/training-paths/${id}`),
    progress: <T = unknown>(id: string) => client<T>(`/training-paths/${id}/progress`),
    syncProgress: <T = unknown>(id: string) =>
      client<T>(`/training-paths/${id}/progress/sync`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },
  learningReports: {
    get: <T = unknown>(scope: string) => client<T>(`/learning-reports/${scope}`),
  },
  reports: {
    learning: {
      overview: <T = unknown>() => client<T>("/reports/learning/overview"),
      weekly: <T = unknown>() => client<T>("/reports/learning/weekly"),
      trends: <T = unknown>() => client<T>("/reports/learning/trends"),
      personalized: <T = unknown>() => client<T>("/reports/learning/personalized"),
    },
  },
  ai: {
    recommendations: <T = unknown>(params?: Record<string, string>) =>
      client<T>("/ai/recommendations", { params }),
    plan: <T = unknown>(body: unknown) =>
      client<T>("/ai/plan", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    tutor: <T = unknown>(body: unknown) =>
      client<T>("/ai/tutor", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  parent: {
    children: <T = unknown>() => client<T>("/parent/children"),
    overview: <T = unknown>(params?: Record<string, string>) =>
      client<T>("/parent/reports/overview", { params }),
    bind: <T = unknown>(body: unknown) =>
      client<T>("/parent/bindings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    unbind: <T = unknown>(id: string) =>
      client<T>(`/parent/bindings/${id}`, {
        method: "DELETE",
      }),
  },
  orders: {
    list: <T = unknown>(params?: Record<string, string>) => client<T>('/orders', { params }),
    get: <T = unknown>(id: string) => client<T>(`/orders/${id}`),
    create: <T = unknown>(body: unknown) =>
      client<T>('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    pay: <T = unknown>(id: string, body?: unknown) =>
      client<T>(`/orders/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
    requestRefund: <T = unknown>(id: string, body?: unknown) =>
      client<T>(`/orders/${id}/refund-request`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
  },
  payments: {
    get: <T = unknown>(paymentNo: string) => client<T>(`/payments/${paymentNo}`),
    create: <T = unknown>(body: unknown) =>
      client<T>('/payments/create', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    callback: <T = unknown>(body: unknown) =>
      client<T>('/payments/callback', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  admin: {
    analytics: {
      learning: {
        overview: <T = unknown>() => client<T>("/admin/analytics/learning/overview"),
        trends: <T = unknown>() => client<T>("/admin/analytics/learning/trends"),
      },
    },
    storeProducts: {
      list: <T = unknown>(params?: Record<string, string>) =>
        client<T>('/admin/store-products', { params }),
      get: <T = unknown>(id: string) => client<T>(`/admin/store-products/${id}`),
      create: <T = unknown>(body: unknown) =>
        client<T>('/admin/store-products', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      update: <T = unknown>(id: string, body: unknown) =>
        client<T>(`/admin/store-products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
    },
  },
};
