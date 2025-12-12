import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { format } from 'date-fns';

// Types
export type Role = 'admin' | 'student';

export interface User {
  id: string;
  name: string;
  mobile: string;
  batch?: string;
  studentId?: string; // Unique for students
  email?: string;
  role: Role;
  password?: string; // Simple mock password
}

export interface Content {
  id: string;
  title: string; // e.g., "Batch A - Morning"
  type: 'typing' | 'shorthand';
  text: string; // The actual content
  duration: number; // in minutes (2, 5, 10, 15, 30)
  dateFor: string; // ISO date string (YYYY-MM-DD)
  isEnabled: boolean;
  createdAt: string;
}

export interface Result {
  id: string;
  studentId: string;
  studentName: string;
  contentId: string;
  contentTitle: string;
  contentType: 'typing' | 'shorthand';
  typedText: string;
  metrics: {
    words: number;
    time: number; // allocated time in minutes
    mistakes: number;
    backspaces: number;
    grossSpeed?: number;
    netSpeed?: number;
    result?: 'Pass' | 'Fail'; // For shorthand
  };
  submittedAt: string;
}

// Initial Data
const INITIAL_ADMIN: User = {
  id: 'admin-1',
  name: 'Administrator',
  mobile: '1234567890',
  role: 'admin',
  password: 'admin',
};

// Storage Keys
const STORAGE_KEYS = {
  USERS: 'pragati_users',
  CONTENT: 'pragati_content',
  RESULTS: 'pragati_results',
  CURRENT_USER: 'pragati_current_user',
};

// Helper to get from storage
const getStorage = <T>(key: string, defaultVal: T): T => {
  if (typeof window === 'undefined') return defaultVal;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultVal;
};

interface StoreContextType {
  users: User[];
  content: Content[];
  results: Result[];
  currentUser: User | null;
  login: (identifier: string, mobile: string) => boolean;
  logout: () => void;
  registerStudent: (data: Omit<User, 'id' | 'role'>) => User;
  addContent: (data: Omit<Content, 'id' | 'createdAt' | 'isEnabled'>) => void;
  toggleContent: (id: string) => void;
  submitResult: (data: Omit<Result, 'id' | 'submittedAt'>) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => getStorage(STORAGE_KEYS.USERS, [INITIAL_ADMIN]));
  const [content, setContent] = useState<Content[]>(() => getStorage(STORAGE_KEYS.CONTENT, []));
  const [results, setResults] = useState<Result[]>(() => getStorage(STORAGE_KEYS.RESULTS, []));
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStorage(STORAGE_KEYS.CURRENT_USER, null));

  // Sync to local storage
  useEffect(() => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.CONTENT, JSON.stringify(content)), [content]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results)), [results]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  // Actions
  const login = (identifier: string, mobile: string) => {
    const user = users.find(u => 
      (u.role === 'admin' && u.name === identifier && u.mobile === mobile) ||
      (u.role === 'student' && u.studentId === identifier && u.mobile === mobile)
    );

    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const logout = () => setCurrentUser(null);

  const registerStudent = (data: Omit<User, 'id' | 'role'>) => {
    if (users.some(u => u.mobile === data.mobile)) {
      throw new Error('Mobile number already registered');
    }
    if (users.some(u => u.studentId === data.studentId)) {
      throw new Error('Student ID already taken');
    }

    const newUser: User = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      role: 'student',
    };
    setUsers([...users, newUser]);
    return newUser;
  };

  const addContent = (data: Omit<Content, 'id' | 'createdAt' | 'isEnabled'>) => {
    const newContent: Content = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      isEnabled: false,
      createdAt: new Date().toISOString(),
    };
    setContent([newContent, ...content]);
  };

  const toggleContent = (id: string) => {
    setContent(prev => {
      const target = prev.find(p => p.id === id);
      if (!target) return prev;

      // If we are disabling, just disable it.
      if (target.isEnabled) {
         return prev.map(c => c.id === id ? { ...c, isEnabled: false } : c);
      }

      // If we are enabling, we need to disable other tests OF THE SAME TYPE
      return prev.map(c => {
        if (c.id === id) {
          return { ...c, isEnabled: true };
        }
        // If same type as target, disable it
        if (c.type === target.type) {
          return { ...c, isEnabled: false };
        }
        // Otherwise leave it alone
        return c;
      });
    });
  };

  const submitResult = (data: Omit<Result, 'id' | 'submittedAt'>) => {
    const newResult: Result = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      submittedAt: new Date().toISOString(),
    };
    setResults([newResult, ...results]);
  };

  const value = {
    users,
    content,
    results,
    currentUser,
    login,
    logout,
    registerStudent,
    addContent,
    toggleContent,
    submitResult,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useMockStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useMockStore must be used within a StoreProvider');
  }
  return context;
}
