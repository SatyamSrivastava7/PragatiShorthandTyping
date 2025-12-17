import type { User, Content, Result, PdfFolder, PdfResource } from '@shared/schema';

const API_URL = '';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const authApi = {
  login: (mobile: string, password: string) =>
    fetchApi<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password }),
    }),

  logout: () =>
    fetchApi<void>('/api/auth/logout', {
      method: 'POST',
    }),

  register: (data: {
    name: string;
    mobile: string;
    password: string;
    batch?: string;
    email?: string;
    city?: string;
    state?: string;
  }) =>
    fetchApi<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resetPassword: (data: {
    studentId: string;
    mobile: string;
    city: string;
    newPassword: string;
  }) =>
    fetchApi<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSession: () =>
    fetchApi<{ user: User | null }>('/api/auth/session'),
};

export const usersApi = {
  getAll: () =>
    fetchApi<User[]>('/api/users'),

  getById: (id: number) =>
    fetchApi<User>(`/api/users/${id}`),

  update: (id: number, data: Partial<User>) =>
    fetchApi<User>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/users/${id}`, {
      method: 'DELETE',
    }),
};

export const contentApi = {
  getAll: () =>
    fetchApi<Content[]>('/api/content'),

  getEnabled: () =>
    fetchApi<Content[]>('/api/content/enabled'),

  getById: (id: number) =>
    fetchApi<Content>(`/api/content/${id}`),

  create: (data: {
    title: string;
    type: 'typing' | 'shorthand';
    text: string;
    duration: number;
    dateFor: string;
    language?: 'english' | 'hindi';
    mediaUrl?: string;
  }) =>
    fetchApi<Content>('/api/content', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggle: (id: number) =>
    fetchApi<Content>(`/api/content/${id}/toggle`, {
      method: 'PATCH',
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/content/${id}`, {
      method: 'DELETE',
    }),
};

export const resultsApi = {
  getAll: () =>
    fetchApi<Result[]>('/api/results'),

  getByStudent: (studentId: number) =>
    fetchApi<Result[]>(`/api/results/student/${studentId}`),

  create: (data: {
    contentId: number;
    typedText: string;
    words: number;
    time: number;
    mistakes: string;
    backspaces: number;
    grossSpeed?: string;
    netSpeed?: string;
    result?: 'Pass' | 'Fail';
  }) =>
    fetchApi<Result>('/api/results', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/results/${id}`, {
      method: 'DELETE',
    }),
};

export const pdfApi = {
  getFolders: () =>
    fetchApi<PdfFolder[]>('/api/pdf/folders'),

  createFolder: (name: string) =>
    fetchApi<PdfFolder>('/api/pdf/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteFolder: (id: number) =>
    fetchApi<void>(`/api/pdf/folders/${id}`, {
      method: 'DELETE',
    }),

  getResources: () =>
    fetchApi<PdfResource[]>('/api/pdf/resources'),

  createResource: (data: {
    name: string;
    url: string;
    pageCount: number;
    price: number;
    folderId: number;
  }) =>
    fetchApi<PdfResource>('/api/pdf/resources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteResource: (id: number) =>
    fetchApi<void>(`/api/pdf/resources/${id}`, {
      method: 'DELETE',
    }),

  purchasePdf: (pdfId: number) =>
    fetchApi<{ message: string }>(`/api/pdf/purchase/${pdfId}`, {
      method: 'POST',
    }),

  consumePdf: (pdfId: number) =>
    fetchApi<{ message: string }>(`/api/pdf/consume/${pdfId}`, {
      method: 'POST',
    }),
};

export const galleryApi = {
  getImages: () =>
    fetchApi<{ url: string }[]>('/api/gallery'),

  addImage: (url: string) =>
    fetchApi<{ url: string }>('/api/gallery', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  deleteImage: (url: string) =>
    fetchApi<void>('/api/gallery', {
      method: 'DELETE',
      body: JSON.stringify({ url }),
    }),
};

export const selectedCandidatesApi = {
  getAll: () =>
    fetchApi<{ id: number; name: string; designation: string; year: string; imageUrl: string }[]>('/api/selected-candidates'),

  create: (data: { name: string; designation: string; year: string; imageUrl: string }) =>
    fetchApi<{ id: number; name: string; designation: string; year: string; imageUrl: string }>('/api/selected-candidates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/selected-candidates/${id}`, {
      method: 'DELETE',
    }),
};

export const settingsApi = {
  get: () =>
    fetchApi<{
      registrationFee: number;
      qrCodeUrl: string;
      instituteName: string;
    }>('/api/settings'),

  update: (data: Partial<{
    registrationFee: number;
    qrCodeUrl: string;
    instituteName: string;
  }>) =>
    fetchApi<{
      registrationFee: number;
      qrCodeUrl: string;
      instituteName: string;
    }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export interface Dictation {
  id: number;
  title: string;
  mediaUrl: string;
  language: string;
  isEnabled: boolean;
  createdAt: Date;
}

export const dictationsApi = {
  getAll: () =>
    fetchApi<Dictation[]>('/api/dictations'),

  create: (data: {
    title: string;
    mediaUrl: string;
    language?: 'english' | 'hindi';
  }) =>
    fetchApi<Dictation>('/api/dictations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggle: (id: number) =>
    fetchApi<Dictation>(`/api/dictations/${id}/toggle`, {
      method: 'POST',
    }),

  delete: (id: number) =>
    fetchApi<void>(`/api/dictations/${id}`, {
      method: 'DELETE',
    }),
};
