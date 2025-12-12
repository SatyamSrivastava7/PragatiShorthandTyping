import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { format } from 'date-fns';

// Types
export type Role = 'admin' | 'student';

export interface PdfResource {
  id: string;
  name: string;
  url: string; // Mock URL
  pageCount: number;
  price: number;
  folderId?: string;
  isBought?: boolean; // Mock property to track purchased status
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
  studentId?: string; // Unique for students
  email?: string;
  role: Role;
  password?: string; // Simple mock password
  
  // New fields
  city?: string;
  state?: string;
  isPaymentCompleted?: boolean;
  paymentAmount?: number;
  validUntil?: string; // ISO date
  purchasedPdfs?: string[]; // IDs of PDFs
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
  mediaUrl?: string; // For Audio (shorthand) or PDF
  language?: 'english' | 'hindi'; // Default english
}

export interface Result {
  id: string;
  studentId: string;
  studentName: string;
  contentId: string;
  contentTitle: string;
  contentType: 'typing' | 'shorthand';
  typedText: string;
  originalText?: string; // Snapshot
  language?: 'english' | 'hindi';
  metrics: {
    words: number;
    time: number; // allocated time in minutes
    mistakes: number;
    backspaces: number;
    grossSpeed?: number | string; // Can be string formatted
    netSpeed?: number | string;
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
  PDF_FOLDERS: 'pragati_pdf_folders',
  PDF_RESOURCES: 'pragati_pdf_resources',
  SETTINGS: 'pragati_settings' // For registration fee amount
};

// Helper to get from storage
function getStorage<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultVal;
}

interface StoreContextType {
  users: User[];
  content: Content[];
  results: Result[];
  pdfFolders: PdfFolder[];
  pdfResources: PdfResource[];
  dictations: {id: string, title: string, mediaUrl: string, language?: 'english' | 'hindi', isEnabled?: boolean, createdAt: string}[];
  currentUser: User | null;
  registrationFee: number;
  qrCodeUrl: string;
  galleryImages: string[];
  
  login: (identifier: string, mobile: string) => boolean;
  logout: () => void;
  registerStudent: (data: Omit<User, 'id' | 'role' | 'isPaymentCompleted'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  resetPassword: (studentId: string, mobile: string, city: string, newPassword: string) => boolean;
  
  addContent: (data: Omit<Content, 'id' | 'createdAt' | 'isEnabled'>) => void;
  toggleContent: (id: string) => void;
  deleteContent: (id: string) => void;
  
  submitResult: (data: Omit<Result, 'id' | 'submittedAt'>) => void;
  
  addPdfFolder: (name: string) => void;
  addPdfResource: (data: Omit<PdfResource, 'id'>) => void;
  deletePdfResource: (id: string) => void;
  buyPdf: (pdfId: string) => void;
  consumePdfPurchase: (pdfId: string) => void;
  
  setRegistrationFee: (amount: number) => void;
  setQrCodeUrl: (url: string) => void;
  addGalleryImage: (url: string) => void;
  removeGalleryImage: (url: string) => void;

  // New Dictation Actions
  addDictation: (title: string, mediaUrl: string, language: 'english' | 'hindi') => void;
  toggleDictation: (id: string) => void;
  deleteDictation: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => getStorage(STORAGE_KEYS.USERS, [INITIAL_ADMIN]));
  const [content, setContent] = useState<Content[]>(() => getStorage(STORAGE_KEYS.CONTENT, []));
  const [results, setResults] = useState<Result[]>(() => getStorage(STORAGE_KEYS.RESULTS, []));
  const [pdfFolders, setPdfFolders] = useState<PdfFolder[]>(() => getStorage(STORAGE_KEYS.PDF_FOLDERS, []));
  const [pdfResources, setPdfResources] = useState<PdfResource[]>(() => getStorage(STORAGE_KEYS.PDF_RESOURCES, []));
  const [dictations, setDictations] = useState<{id: string, title: string, mediaUrl: string, language?: 'english' | 'hindi', isEnabled?: boolean, createdAt: string}[]>(() => getStorage('pragati_dictations', []));
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStorage(STORAGE_KEYS.CURRENT_USER, null));
  const [registrationFee, setRegistrationFeeState] = useState<number>(() => getStorage(STORAGE_KEYS.SETTINGS + '_FEE', 500)); 
  const [qrCodeUrl, setQrCodeUrlState] = useState<string>(() => getStorage(STORAGE_KEYS.SETTINGS + '_QR', ''));
  const [galleryImages, setGalleryImages] = useState<string[]>(() => getStorage(STORAGE_KEYS.SETTINGS + '_GALLERY', []));

  // Sync to local storage
  useEffect(() => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.CONTENT, JSON.stringify(content)), [content]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results)), [results]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.PDF_FOLDERS, JSON.stringify(pdfFolders)), [pdfFolders]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.PDF_RESOURCES, JSON.stringify(pdfResources)), [pdfResources]);
  useEffect(() => localStorage.setItem('pragati_dictations', JSON.stringify(dictations)), [dictations]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SETTINGS + '_FEE', JSON.stringify(registrationFee)), [registrationFee]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SETTINGS + '_QR', JSON.stringify(qrCodeUrl)), [qrCodeUrl]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SETTINGS + '_GALLERY', JSON.stringify(galleryImages)), [galleryImages]);
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

  const registerStudent = (data: Omit<User, 'id' | 'role' | 'isPaymentCompleted'>) => {
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
      isPaymentCompleted: false, // Default false, needs payment
      purchasedPdfs: [],
    };
    setUsers([...users, newUser]);
    return newUser;
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    // Also update current user if it's them
    if (currentUser?.id === id) {
      setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };
  
  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const resetPassword = (studentId: string, mobile: string, city: string, newPassword: string) => {
    const userIndex = users.findIndex(u => 
      u.role === 'student' && 
      u.studentId === studentId && 
      u.mobile === mobile && 
      u.city?.toLowerCase() === city.toLowerCase()
    );

    if (userIndex === -1) return false;

    const updatedUsers = [...users];
    updatedUsers[userIndex] = { ...updatedUsers[userIndex], password: newPassword }; // In a real app, hash this
    setUsers(updatedUsers);
    return true;
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

      // If we are enabling, we need to disable other tests OF THE SAME TYPE AND LANGUAGE
      return prev.map(c => {
        if (c.id === id) {
          return { ...c, isEnabled: true };
        }
        // If same type AND same language as target, disable it
        if (c.type === target.type && c.language === target.language) {
          return { ...c, isEnabled: false };
        }
        // Otherwise leave it alone
        return c;
      });
    });
  };

  const deleteContent = (id: string) => {
    setContent(prev => prev.filter(c => c.id !== id));
  };

  const submitResult = (data: Omit<Result, 'id' | 'submittedAt'>) => {
    const newResult: Result = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      submittedAt: new Date().toISOString(),
    };
    setResults([newResult, ...results]);
  };

  const addPdfFolder = (name: string) => {
    const newFolder: PdfFolder = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      createdAt: new Date().toISOString()
    };
    setPdfFolders([...pdfFolders, newFolder]);
  };

  const addPdfResource = (data: Omit<PdfResource, 'id'>) => {
    const newRes: PdfResource = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
    };
    setPdfResources([...pdfResources, newRes]);
  };

  const deletePdfResource = (id: string) => {
    setPdfResources(prev => prev.filter(p => p.id !== id));
  };

  const buyPdf = (pdfId: string) => {
    if (!currentUser) return;
    const updatedPurchased = [...(currentUser.purchasedPdfs || []), pdfId];
    updateUser(currentUser.id, { purchasedPdfs: updatedPurchased });
  };

  const consumePdfPurchase = (pdfId: string) => {
    if (!currentUser) return;
    const updatedPurchased = (currentUser.purchasedPdfs || []).filter(id => id !== pdfId);
    updateUser(currentUser.id, { purchasedPdfs: updatedPurchased });
  };

  const setRegistrationFee = (amount: number) => {
    setRegistrationFeeState(amount);
  };
  
  const setQrCodeUrl = (url: string) => {
    setQrCodeUrlState(url);
  };

  const addGalleryImage = (url: string) => {
    setGalleryImages(prev => [...prev, url]);
  };

  const removeGalleryImage = (url: string) => {
    setGalleryImages(prev => prev.filter(img => img !== url));
  };
  
  const addDictation = (title: string, mediaUrl: string, language: 'english' | 'hindi') => {
    setDictations(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      title,
      mediaUrl,
      language,
      isEnabled: false,
      createdAt: new Date().toISOString()
    }, ...prev]);
  };

  const toggleDictation = (id: string) => {
    setDictations(prev => {
      const target = prev.find(d => d.id === id);
      if (!target) return prev;

      // Toggle logic
      if (!target.isEnabled) {
         // Enable this one, disable others of same language
         return prev.map(d => {
            if (d.id === id) return { ...d, isEnabled: true };
            if (d.language === target.language) return { ...d, isEnabled: false };
            return d;
         });
      } else {
         return prev.map(d => d.id === id ? { ...d, isEnabled: false } : d);
      }
    });
  };

  const deleteDictation = (id: string) => {
    setDictations(prev => prev.filter(d => d.id !== id));
  };

  const value = {
    users,
    content,
    results,
    pdfFolders,
    pdfResources,
    dictations,
    currentUser,
    registrationFee,
    qrCodeUrl,
    galleryImages,
    login,
    logout,
    registerStudent,
    updateUser,
    deleteUser,
    resetPassword,
    addContent,
    toggleContent,
    deleteContent,
    submitResult,
    addPdfFolder,
    addPdfResource,
    deletePdfResource,
    buyPdf,
    consumePdfPurchase,
    setRegistrationFee,
    setQrCodeUrl,
    addGalleryImage,
    removeGalleryImage,
    addDictation,
    toggleDictation,
    deleteDictation
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
