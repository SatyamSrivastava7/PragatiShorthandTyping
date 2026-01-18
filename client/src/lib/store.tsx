// Legacy types file - kept for backwards compatibility
// The app now uses React Query with PostgreSQL database for state management
// No localStorage is used - all data is fetched from the API

export type Role = 'admin' | 'student';

export interface PdfResource {
  id: string;
  name: string;
  url: string;
  pageCount: number;
  price: number;
  folderId?: string;
  isBought?: boolean;
}

export interface PdfFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  mobile: string;
  batch?: string;
  studentId?: string;
  email?: string;
  role: Role;
  password?: string;
  city?: string;
  state?: string;
  isPaymentCompleted?: boolean;
  paymentAmount?: number;
  validUntil?: string;
  purchasedPdfs?: string[];
}

export interface Content {
  id: string;
  title: string;
  type: 'typing' | 'shorthand';
  text: string;
  duration: number;
  dateFor: string;
  isEnabled: boolean;
  createdAt: string;
  audio80wpm?: string;
  audio100wpm?: string;
  language?: 'english' | 'hindi';
}

export interface Result {
  id: number;
  studentId: number;
  studentDisplayId?: string | null;
  studentName: string;
  contentId: number;
  contentTitle: string;
  contentType: string;
  typedText: string;
  originalText?: string | null;
  language?: string | null;
  words: number;
  time: number;
  mistakes: string;
  backspaces: number;
  grossSpeed?: string | null;
  netSpeed?: string | null;
  result?: string | null;
  submittedAt: string;
}

export interface SelectedCandidate {
  id: string;
  name: string;
  designation: string;
  year: string;
  imageUrl: string;
}

// Note: This file is kept for type exports only.
// The actual state management is handled by React Query hooks in ./hooks/
// Data persistence is handled by PostgreSQL database via the API
