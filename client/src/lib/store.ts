import { useState, useEffect } from 'react';
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

// Store Hook
export function useMockStore() {
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
    // Identifier can be Student ID or Name for admin? Prompt says "Login page for admin and user"
    // For admin, maybe use a specific hardcoded login or just check role.
    // Prompt says: "Student profile should be one time registration... allow users to create a student id also, using that student id, student should be able to login"
    
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
    // Auto login after register? Or redirect to login. Let's return user.
    return newUser;
  };

  const addContent = (data: Omit<Content, 'id' | 'createdAt' | 'isEnabled'>) => {
    const newContent: Content = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      isEnabled: false,
      createdAt: new Date().toISOString(),
    };
    // Admin needs to upload 500+ items? We just push to array.
    // New requirement: "Only one content can be enabled at a time" (per type? or globally? Prompt says "only one content can be enabled at a time")
    // If we enable one, we might need to disable others. Let's handle that in toggle.
    setContent([newContent, ...content]);
  };

  const toggleContent = (id: string) => {
    setContent(prev => prev.map(c => {
      if (c.id === id) {
        // If we are enabling this one, we must disable ALL others to satisfy "only one content can be enabled at a time"
        // Wait, implies GLOBAL enable? Or "User should be able to see only content of today... Enable button for Admin to enable previously uploaded content... only one content can be enabled at a time"
        // It likely means one active test at a time for the users to take.
        const willEnable = !c.isEnabled;
        if (willEnable) {
          // Disable all others first, then return this one enabled
           // BUT we can't map inside map easily like that without multiple passes or side effects.
           // Actually, let's do it in the setContent call properly.
           return { ...c, isEnabled: true };
        }
        return { ...c, isEnabled: false };
      }
      // If we enabled the target, disable everyone else.
      // If we disabled the target, everyone else stays as is (disabled).
      const target = prev.find(p => p.id === id);
      if (target && !target.isEnabled) { // We are about to enable target
         return { ...c, isEnabled: false };
      }
      return c;
    }));
  };

  const submitResult = (data: Omit<Result, 'id' | 'submittedAt'>) => {
    const newResult: Result = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      submittedAt: new Date().toISOString(),
    };
    setResults([newResult, ...results]);
  };

  return {
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
}
