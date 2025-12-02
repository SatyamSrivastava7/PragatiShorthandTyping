import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
}

export interface Assignment {
  id: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  createdAt: number;
}

export interface TestResult {
  id: string;
  assignmentId: string;
  userId: string;
  username: string;
  typedContent: string;
  accuracy: number;
  wpm: number;
  dateTaken: number;
  mismatches: number;
  totalChars: number;
}

interface AppState {
  currentUser: User | null;
  assignments: Assignment[];
  results: TestResult[];
  
  // Actions
  login: (username: string, role: Role) => void;
  logout: () => void;
  addAssignment: (assignment: Omit<Assignment, 'id' | 'createdAt'>) => void;
  deleteAssignment: (id: string) => void;
  addResult: (result: Omit<TestResult, 'id'>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      assignments: [
        {
          id: 'demo-1',
          title: 'Typing Basics',
          content: 'The quick brown fox jumps over the lazy dog. This is a classic pangram that contains every letter of the English alphabet. It is often used to demonstrate typefaces and test typewriters.',
          date: new Date().toISOString().split('T')[0],
          durationMinutes: 2,
          createdAt: Date.now(),
        }
      ],
      results: [],

      login: (username, role) => set({ 
        currentUser: { id: username, username, role } 
      }),
      
      logout: () => set({ currentUser: null }),

      addAssignment: (assignment) => set((state) => ({
        assignments: [
          ...state.assignments,
          { ...assignment, id: Math.random().toString(36).slice(2), createdAt: Date.now() }
        ]
      })),

      deleteAssignment: (id) => set((state) => ({
        assignments: state.assignments.filter((a) => a.id !== id)
      })),

      addResult: (result) => set((state) => ({
        results: [
          ...state.results,
          { ...result, id: Math.random().toString(36).slice(2) }
        ]
      })),
    }),
    {
      name: 'typing-test-storage',
    }
  )
);
