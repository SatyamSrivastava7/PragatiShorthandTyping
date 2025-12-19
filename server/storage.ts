import { 
  users, 
  content, 
  results, 
  pdfFolders, 
  pdfResources, 
  dictations, 
  selectedCandidates, 
  galleryImages,
  settings,
  type User, 
  type InsertUser,
  type Content,
  type InsertContent,
  type Result,
  type InsertResult,
  type PdfFolder,
  type InsertPdfFolder,
  type PdfResource,
  type InsertPdfResource,
  type Dictation,
  type InsertDictation,
  type SelectedCandidate,
  type InsertSelectedCandidate,
  type GalleryImage,
  type InsertGalleryImage,
  type Setting,
  type InsertSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(role?: string): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  
  // Content methods
  getContent(id: number): Promise<Content | undefined>;
  getAllContent(type?: string): Promise<Content[]>;
  getEnabledContent(): Promise<Content[]>;
  getContentByDate(dateFor: string, type?: string): Promise<Content[]>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: number, updates: Partial<InsertContent>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<boolean>;
  toggleContent(id: number): Promise<Content | undefined>;
  
  // Results methods
  getResult(id: number): Promise<Result | undefined>;
  getResultsByStudent(studentId: number): Promise<Result[]>;
  getResultsByContent(contentId: number): Promise<Result[]>;
  getAllResults(): Promise<Result[]>;
  createResult(result: InsertResult): Promise<Result>;
  deleteResult(id: number): Promise<boolean>;
  
  // PDF Folder methods
  getAllPdfFolders(): Promise<PdfFolder[]>;
  getPdfFolder(id: number): Promise<PdfFolder | undefined>;
  createPdfFolder(folder: InsertPdfFolder): Promise<PdfFolder>;
  deletePdfFolder(id: number): Promise<boolean>;
  
  // PDF Resource methods
  getAllPdfResources(): Promise<PdfResource[]>;
  getPdfResource(id: number): Promise<PdfResource | undefined>;
  getPdfResourcesByFolder(folderId: number): Promise<PdfResource[]>;
  createPdfResource(resource: InsertPdfResource): Promise<PdfResource>;
  updatePdfResource(id: number, updates: Partial<InsertPdfResource>): Promise<PdfResource | undefined>;
  deletePdfResource(id: number): Promise<boolean>;
  
  // Dictation methods
  getAllDictations(): Promise<Dictation[]>;
  getDictation(id: number): Promise<Dictation | undefined>;
  createDictation(dictation: InsertDictation): Promise<Dictation>;
  updateDictation(id: number, updates: Partial<InsertDictation>): Promise<Dictation | undefined>;
  deleteDictation(id: number): Promise<boolean>;
  toggleDictation(id: number): Promise<Dictation | undefined>;
  
  // Selected Candidates methods
  getAllSelectedCandidates(): Promise<SelectedCandidate[]>;
  getSelectedCandidate(id: number): Promise<SelectedCandidate | undefined>;
  createSelectedCandidate(candidate: InsertSelectedCandidate): Promise<SelectedCandidate>;
  deleteSelectedCandidate(id: number): Promise<boolean>;
  
  // Gallery methods
  getAllGalleryImages(): Promise<GalleryImage[]>;
  getGalleryImage(id: number): Promise<GalleryImage | undefined>;
  createGalleryImage(image: InsertGalleryImage): Promise<GalleryImage>;
  deleteGalleryImage(id: number): Promise<boolean>;
  
  // Settings methods
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  upsertSetting(setting: InsertSetting): Promise<Setting>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(role?: string): Promise<User[]> {
    if (role) {
      return await db.select().from(users).where(eq(users.role, role));
    }
    return await db.select().from(users);
  }

  async deleteUser(id: number): Promise<boolean> {
    // First delete all results associated with this user
    await db.delete(results).where(eq(results.studentId, id));
    // Then delete the user
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Content methods
  async getContent(id: number): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    return item || undefined;
  }

  async getAllContent(type?: string): Promise<Content[]> {
    if (type) {
      return await db.select().from(content).where(eq(content.type, type)).orderBy(desc(content.createdAt));
    }
    return await db.select().from(content).orderBy(desc(content.createdAt));
  }

  async getAllContentList(type?: string): Promise<Omit<Content, 'text'>[]> {
    const columns = {
      id: content.id,
      title: content.title,
      type: content.type,
      duration: content.duration,
      dateFor: content.dateFor,
      isEnabled: content.isEnabled,
      autoScroll: content.autoScroll,
      mediaUrl: content.mediaUrl,
      language: content.language,
      createdAt: content.createdAt,
    };
    if (type) {
      return await db.select(columns).from(content).where(eq(content.type, type)).orderBy(desc(content.createdAt));
    }
    return await db.select(columns).from(content).orderBy(desc(content.createdAt));
  }

  async getEnabledContentList(): Promise<Omit<Content, 'text'>[]> {
    return await db.select({
      id: content.id,
      title: content.title,
      type: content.type,
      duration: content.duration,
      dateFor: content.dateFor,
      isEnabled: content.isEnabled,
      autoScroll: content.autoScroll,
      mediaUrl: content.mediaUrl,
      language: content.language,
      createdAt: content.createdAt,
    }).from(content).where(eq(content.isEnabled, true)).orderBy(desc(content.createdAt));
  }

  async getEnabledContent(): Promise<Content[]> {
    return await db.select().from(content).where(eq(content.isEnabled, true)).orderBy(desc(content.createdAt));
  }

  async getContentByDate(dateFor: string, type?: string): Promise<Content[]> {
    if (type) {
      return await db.select().from(content).where(and(eq(content.dateFor, dateFor), eq(content.type, type)));
    }
    return await db.select().from(content).where(eq(content.dateFor, dateFor));
  }

  async createContent(insertContent: InsertContent): Promise<Content> {
    const [item] = await db.insert(content).values({ ...insertContent, isEnabled: false }).returning();
    return item;
  }

  async updateContent(id: number, updates: Partial<InsertContent>): Promise<Content | undefined> {
    const [item] = await db.update(content).set(updates).where(eq(content.id, id)).returning();
    return item || undefined;
  }

  async deleteContent(id: number): Promise<boolean> {
    const result = await db.delete(content).where(eq(content.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async toggleContent(id: number): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    if (!item) return undefined;
    
    const [updated] = await db.update(content)
      .set({ isEnabled: !item.isEnabled })
      .where(eq(content.id, id))
      .returning();
    return updated || undefined;
  }

  // Results methods
  async getResult(id: number): Promise<Result | undefined> {
    const [result] = await db.select().from(results).where(eq(results.id, id));
    return result || undefined;
  }

  async getResultsByStudent(studentId: number): Promise<Result[]> {
    return await db.select().from(results).where(eq(results.studentId, studentId)).orderBy(desc(results.submittedAt));
  }

  async getResultsByContent(contentId: number): Promise<Result[]> {
    return await db.select().from(results).where(eq(results.contentId, contentId)).orderBy(desc(results.submittedAt));
  }

  async getAllResults(): Promise<Result[]> {
    return await db.select().from(results).orderBy(desc(results.submittedAt));
  }

  async createResult(insertResult: InsertResult): Promise<Result> {
    const [result] = await db.insert(results).values(insertResult).returning();
    return result;
  }

  async deleteResult(id: number): Promise<boolean> {
    const result = await db.delete(results).where(eq(results.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // PDF Folder methods
  async getAllPdfFolders(): Promise<PdfFolder[]> {
    return await db.select().from(pdfFolders).orderBy(desc(pdfFolders.createdAt));
  }

  async getPdfFolder(id: number): Promise<PdfFolder | undefined> {
    const [folder] = await db.select().from(pdfFolders).where(eq(pdfFolders.id, id));
    return folder || undefined;
  }

  async createPdfFolder(folder: InsertPdfFolder): Promise<PdfFolder> {
    const [created] = await db.insert(pdfFolders).values(folder).returning();
    return created;
  }

  async deletePdfFolder(id: number): Promise<boolean> {
    // First delete all resources in this folder (due to foreign key constraint)
    await db.delete(pdfResources).where(eq(pdfResources.folderId, id));
    // Then delete the folder
    const result = await db.delete(pdfFolders).where(eq(pdfFolders.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // PDF Resource methods
  async getAllPdfResources(): Promise<PdfResource[]> {
    return await db.select().from(pdfResources).orderBy(desc(pdfResources.createdAt));
  }

  async getPdfResource(id: number): Promise<PdfResource | undefined> {
    const [resource] = await db.select().from(pdfResources).where(eq(pdfResources.id, id));
    return resource || undefined;
  }

  async getPdfResourcesByFolder(folderId: number): Promise<PdfResource[]> {
    return await db.select().from(pdfResources).where(eq(pdfResources.folderId, folderId)).orderBy(desc(pdfResources.createdAt));
  }

  async createPdfResource(resource: InsertPdfResource): Promise<PdfResource> {
    const [created] = await db.insert(pdfResources).values(resource).returning();
    return created;
  }

  async updatePdfResource(id: number, updates: Partial<InsertPdfResource>): Promise<PdfResource | undefined> {
    const [resource] = await db.update(pdfResources).set(updates).where(eq(pdfResources.id, id)).returning();
    return resource || undefined;
  }

  async deletePdfResource(id: number): Promise<boolean> {
    const result = await db.delete(pdfResources).where(eq(pdfResources.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Dictation methods
  async getAllDictations(): Promise<Dictation[]> {
    return await db.select().from(dictations).orderBy(desc(dictations.createdAt));
  }

  async getDictation(id: number): Promise<Dictation | undefined> {
    const [dictation] = await db.select().from(dictations).where(eq(dictations.id, id));
    return dictation || undefined;
  }

  async createDictation(insertDictation: InsertDictation): Promise<Dictation> {
    const [dictation] = await db.insert(dictations).values(insertDictation).returning();
    return dictation;
  }

  async updateDictation(id: number, updates: Partial<InsertDictation>): Promise<Dictation | undefined> {
    const [dictation] = await db.update(dictations).set(updates).where(eq(dictations.id, id)).returning();
    return dictation || undefined;
  }

  async deleteDictation(id: number): Promise<boolean> {
    const result = await db.delete(dictations).where(eq(dictations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async toggleDictation(id: number): Promise<Dictation | undefined> {
    const [item] = await db.select().from(dictations).where(eq(dictations.id, id));
    if (!item) return undefined;
    
    const [updated] = await db.update(dictations)
      .set({ isEnabled: !item.isEnabled })
      .where(eq(dictations.id, id))
      .returning();
    return updated || undefined;
  }

  // Selected Candidates methods
  async getAllSelectedCandidates(): Promise<SelectedCandidate[]> {
    return await db.select().from(selectedCandidates).orderBy(desc(selectedCandidates.createdAt));
  }

  async getSelectedCandidate(id: number): Promise<SelectedCandidate | undefined> {
    const [candidate] = await db.select().from(selectedCandidates).where(eq(selectedCandidates.id, id));
    return candidate || undefined;
  }

  async createSelectedCandidate(candidate: InsertSelectedCandidate): Promise<SelectedCandidate> {
    const [created] = await db.insert(selectedCandidates).values(candidate).returning();
    return created;
  }

  async deleteSelectedCandidate(id: number): Promise<boolean> {
    const result = await db.delete(selectedCandidates).where(eq(selectedCandidates.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Gallery methods
  async getAllGalleryImages(): Promise<GalleryImage[]> {
    return await db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt));
  }

  async getGalleryImage(id: number): Promise<GalleryImage | undefined> {
    const [image] = await db.select().from(galleryImages).where(eq(galleryImages.id, id));
    return image || undefined;
  }

  async createGalleryImage(image: InsertGalleryImage): Promise<GalleryImage> {
    const [created] = await db.insert(galleryImages).values(image).returning();
    return created;
  }

  async deleteGalleryImage(id: number): Promise<boolean> {
    const result = await db.delete(galleryImages).where(eq(galleryImages.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async upsertSetting(insertSetting: InsertSetting): Promise<Setting> {
    const existing = await this.getSetting(insertSetting.key);
    
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value: insertSetting.value, updatedAt: new Date() })
        .where(eq(settings.key, insertSetting.key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings).values(insertSetting).returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
