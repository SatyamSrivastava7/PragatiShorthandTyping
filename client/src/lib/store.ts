import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
}

export type AssignmentType = 'typing' | 'shorthand';

export interface Assignment {
  id: string;
  title: string;
  content: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  type: AssignmentType;
  isEnabled: boolean;
  createdAt: number;
}

export interface TestResult {
  id: string;
  assignmentId: string;
  userId: string;
  username: string;
  typedContent: string;
  dateTaken: number;
  totalChars: number;
  
  // Typing Test Fields
  accuracy?: number;
  wpm?: number;
  mismatches?: number;
  backspaces?: number;
  grossSpeed?: number;
  netSpeed?: number;
  
  // Shorthand Test Fields
  result?: 'Pass' | 'Fail';
  type: AssignmentType;
}

interface AppState {
  currentUser: User | null;
  assignments: Assignment[];
  results: TestResult[];
  
  // Actions
  login: (username: string, role: Role) => void;
  logout: () => void;
  addAssignment: (assignment: Omit<Assignment, 'id' | 'createdAt' | 'isEnabled'>) => void;
  deleteAssignment: (id: string) => void;
  toggleAssignmentEnabled: (id: string) => void;
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
          content: 'The quick brown fox jumps over the lazy dog. This is a classic pangram that contains every letter of the English alphabet.',
          date: new Date().toISOString().split('T')[0],
          durationMinutes: 2,
          type: 'typing',
          isEnabled: true,
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
          { 
            ...assignment, 
            id: Math.random().toString(36).slice(2), 
            createdAt: Date.now(),
            isEnabled: false // Default disabled
          }
        ]
      })),

      deleteAssignment: (id) => set((state) => ({
        assignments: state.assignments.filter((a) => a.id !== id)
      })),

      toggleAssignmentEnabled: (id) => set((state) => {
        // Find the assignment to be toggled
        const target = state.assignments.find(a => a.id === id);
        if (!target) return state;

        // If we are enabling it, disable all others
        if (!target.isEnabled) {
          return {
            assignments: state.assignments.map(a => ({
              ...a,
              isEnabled: a.id === id
            }))
          };
        }

        // If disabling, just disable it
        return {
          assignments: state.assignments.map(a => 
            a.id === id ? { ...a, isEnabled: false } : a
          )
        };
      }),

      addResult: (result) => set((state) => ({
        results: [
          { ...result, id: Math.random().toString(36).slice(2) },
          ...state.results // Latest at top
        ]
      })),
    }),
    {
      name: 'typing-test-storage',
    }
  )
);
