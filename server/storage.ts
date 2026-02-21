import { 
  users, 
  content, 
  results, 
  pdfFolders, 
  pdfResources, 
  testFolders,
  selectedCandidates, 
  galleryImages,
  settings,
  notices,
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
  type TestFolder,
  type InsertTestFolder,
  type SelectedCandidate,
  type InsertSelectedCandidate,
  type GalleryImage,
  type InsertGalleryImage,
  type Setting,
  type InsertSetting,
  type Notice,
  type InsertNotice,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, lt } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(role?: string): Promise<User[]>;
  getNextStudentId(year: string): Promise<string>;
  deleteUser(id: number): Promise<boolean>;
  
  // Content methods
  getContent(id: number): Promise<Content | undefined>;
  getAllContent(type?: string): Promise<Content[]>;
  getEnabledContent(): Promise<Content[]>;
  getContentCounts(enabled?: boolean): Promise<Record<string, number>>;
  getContentByDate(dateFor: string, type?: string): Promise<Content[]>;
  createContent(content: InsertContent): Promise<Content>;
  updateContent(id: number, updates: Partial<InsertContent>): Promise<Content | undefined>;
  deleteContent(id: number): Promise<boolean>;
  toggleContent(id: number): Promise<Content | undefined>;
  toggleContentLightweight(id: number): Promise<{ id: number; isEnabled: boolean } | undefined>;
  
  // Test Folder methods
  getTestFoldersByLanguage(language: string, type?: string, onlyWithContent?: boolean): Promise<TestFolder[]>;
  getLatestTestFoldersByLanguage(language: string, limit?: number, offset?: number, type?: string, onlyWithContent?: boolean): Promise<TestFolder[]>;
  getTestFolder(id: number): Promise<TestFolder | undefined>;
  createTestFolder(folder: InsertTestFolder): Promise<TestFolder>;
  updateTestFolder(id: number, updates: Partial<InsertTestFolder>): Promise<TestFolder | undefined>;
  deleteTestFolder(id: number): Promise<boolean>;
  
  // Results methods
  getResult(id: number): Promise<Result | undefined>;
  getResultsByIds(ids: number[]): Promise<Result[]>;
  getResultsByStudent(studentId: number, contentType?: string): Promise<Result[]>;
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
  
  // Results paging + counts
  getResultsPaged(type?: string, studentId?: number, limit?: number, offset?: number): Promise<Result[]>;
  getResultCounts(studentId?: number): Promise<Record<string, number>>;
  
  // Selected Candidates methods
  getAllSelectedCandidates(): Promise<SelectedCandidate[]>;
  getSelectedCandidate(id: number): Promise<SelectedCandidate | undefined>;
  createSelectedCandidate(candidate: InsertSelectedCandidate): Promise<SelectedCandidate>;
  deleteSelectedCandidate(id: number): Promise<boolean>;
  
  // Gallery methods
  getAllGalleryImages(): Promise<GalleryImage[]>;
  getGalleryImagesPaged(limit: number, offset: number): Promise<GalleryImage[]>;
  getFeaturedGalleryImages(): Promise<GalleryImage[]>;
  getGalleryImage(id: number): Promise<GalleryImage | undefined>;
  createGalleryImage(image: InsertGalleryImage): Promise<GalleryImage>;
  deleteGalleryImage(id: number): Promise<boolean>;
  updateGalleryImageOrder(imageIds: number[]): Promise<boolean>;
  
  // Settings methods
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  upsertSetting(setting: InsertSetting): Promise<Setting>;
  
  // Notices methods
  createNotice(notice: InsertNotice): Promise<Notice>;
  getNotice(id: number): Promise<Notice | undefined>;
  getActiveNotices(): Promise<Notice[]>;
  getAllNotices(): Promise<Notice[]>;
  updateNotice(id: number, updates: Partial<InsertNotice>): Promise<Notice | undefined>;
  deleteNotice(id: number): Promise<boolean>;
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

  async getNextStudentId(year: string): Promise<string> {
    // Efficiently fetch only student IDs for the current year (instead of all users)
    const prefix = `PIPS${year}`;
    const likePattern = `${prefix}%`;
    
    const result = await db
      .select({ studentId: users.studentId })
      .from(users)
      .where(sql`${users.studentId} LIKE ${likePattern}`)
      .orderBy(desc(users.studentId))
      .limit(1);
    
    let maxNum = 0;
    if (result.length > 0 && result[0].studentId) {
      const numStr = result[0].studentId.slice(prefix.length);
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        maxNum = num;
      }
    }
    
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
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

  async getAllContentList(type?: string): Promise<Omit<Content, 'text' | 'mediaUrl' | 'video60wpm' | 'video80wpm' | 'video100wpm' | 'video120wpm'>[]> {
    const columns = {
      id: content.id,
      title: content.title,
      type: content.type,
      duration: content.duration,
      dateFor: content.dateFor,
      isEnabled: content.isEnabled,
      autoScroll: content.autoScroll,
      language: content.language,
      createdAt: content.createdAt,
      folderId: content.folderId,
    };
    if (type) {
      return await db.select(columns).from(content).where(eq(content.type, type)).orderBy(desc(content.createdAt)) as any;
    }
    return await db.select(columns).from(content).orderBy(desc(content.createdAt)) as any;
  }

  async getEnabledContentList(): Promise<Omit<Content, 'text' | 'mediaUrl' | 'video60wpm' | 'video80wpm' | 'video100wpm' | 'video120wpm'>[]> {
    return await db.select({
      id: content.id,
      title: content.title,
      type: content.type,
      duration: content.duration,
      dateFor: content.dateFor,
      isEnabled: content.isEnabled,
      autoScroll: content.autoScroll,
      language: content.language,
      createdAt: content.createdAt,
      folderId: content.folderId,
    }).from(content).where(eq(content.isEnabled, true)).orderBy(desc(content.createdAt)) as any;
  }

  async getEnabledContentListPaged(type?: string, language?: string, folderId?: number, limit?: number, offset?: number): Promise<Omit<Content, 'text' | 'mediaUrl' | 'video60wpm' | 'video80wpm' | 'video100wpm' | 'video120wpm'>[]> {
    const columns = {
      id: content.id,
      title: content.title,
      type: content.type,
      duration: content.duration,
      dateFor: content.dateFor,
      isEnabled: content.isEnabled,
      autoScroll: content.autoScroll,
      video60wpm: content.video60wpm,
      video80wpm: content.video80wpm,
      video100wpm: content.video100wpm,
      video120wpm: content.video120wpm,
      language: content.language,
      createdAt: content.createdAt,
      folderId: content.folderId,
    };

    // Build conditions array and apply as a single where clause to satisfy Drizzle's types
    const conditions = [eq(content.isEnabled, true)];
    if (type) conditions.push(eq(content.type, type));
    if (language) conditions.push(eq(content.language, language));
    if (folderId) conditions.push(eq(content.folderId, folderId));

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Build base query
    let q: any = db.select(columns).from(content).where(whereClause).orderBy(desc(content.createdAt));

    // Only apply limit/offset when they are finite numbers
    if (Number.isFinite(limit as number)) {
      q = q.limit(Number(limit));
    }
    if (Number.isFinite(offset as number)) {
      q = q.offset(Number(offset));
    }

    return await q as any;
  }

  async getEnabledContent(): Promise<Content[]> {
    return await db.select().from(content).where(eq(content.isEnabled, true)).orderBy(desc(content.createdAt));
  }

  async getResultsPaged(type?: string, studentId?: number, limit?: number, offset?: number): Promise<Result[]> {
    const conditions: any[] = [];
    
    // Ensure type is properly trimmed and normalized
    if (type && typeof type === 'string') {
      const normalizedType = type.trim().toLowerCase();
      conditions.push(eq(results.contentType, normalizedType));
    }
    
    if (typeof studentId === 'number') {
      conditions.push(eq(results.studentId, studentId));
    }

    let q: any = db.select().from(results);
    
    // Apply WHERE clause if conditions exist
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      q = q.where(whereClause);
    }
    
    // Apply ORDER BY
    q = q.orderBy(desc(results.submittedAt));
    
    // Apply LIMIT and OFFSET
    if (Number.isFinite(limit as number)) {
      q = q.limit(Number(limit));
    }
    if (Number.isFinite(offset as number)) {
      q = q.offset(Number(offset));
    }

    return await q;
  }

  async getResultCounts(studentId?: number): Promise<Record<string, number>> {
    const types = ['typing', 'shorthand'];
    const resultObj: Record<string, number> = {};

    for (const t of types) {
      const conditions: any[] = [eq(results.contentType, t)];
      if (typeof studentId === 'number') conditions.push(eq(results.studentId, studentId));
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      const q: any = db.select({ cnt: sql`count(*)`.as('cnt') }).from(results).where(whereClause);
      const [row] = await q;
      resultObj[t] = Number(row?.cnt ?? 0);
    }

    return resultObj;
  }

  async getContentCounts(enabled?: boolean): Promise<Record<string, number>> {
    const types = ['typing', 'shorthand'];
    const result: Record<string, number> = {};

    for (const t of types) {
      const conditions: any[] = [eq(content.type, t)];
      if (typeof enabled === 'boolean') conditions.push(eq(content.isEnabled, !!enabled));
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      const q: any = db.select({ cnt: sql`count(*)`.as('cnt') }).from(content).where(whereClause);
      const [row] = await q;
      result[t] = Number(row?.cnt ?? 0);
    }

    return result;
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
    // Delete only the test/content - intentionally preserve associated results
    // Results remain in the database even after test is deleted
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

  // Lightweight toggle - only returns id and isEnabled (no text/audio fields)
  async toggleContentLightweight(id: number): Promise<{ id: number; isEnabled: boolean } | undefined> {
    const [item] = await db.select({ id: content.id, isEnabled: content.isEnabled })
      .from(content)
      .where(eq(content.id, id));
    if (!item) return undefined;
    
    const [updated] = await db.update(content)
      .set({ isEnabled: !item.isEnabled })
      .where(eq(content.id, id))
      .returning({ id: content.id, isEnabled: content.isEnabled });
    return updated || undefined;
  }

  // Test Folder methods
  async getTestFoldersByLanguage(language: string, type?: string): Promise<TestFolder[]> {
    // Get all folders for the language and type
    const conditions = [eq(testFolders.language, language)];
    if (type) {
      conditions.push(eq(testFolders.type, type));
    }
    
    const folders = await db
      .select()
      .from(testFolders)
      .where(and(...conditions))
      .orderBy(asc(testFolders.name));
    
    return folders;
  }

  async getLatestTestFoldersByLanguage(language: string, limit: number = 6, offset: number = 0, type?: string, onlyWithContent: boolean = false): Promise<TestFolder[]> {
    // Get folders ordered by creation date
    const conditions = [eq(testFolders.language, language)];
    if (type) {
      conditions.push(eq(testFolders.type, type));
    }
    
    const folders = await db
      .select()
      .from(testFolders)
      .where(and(...conditions))
      .orderBy(desc(testFolders.createdAt));
    
    // If onlyWithContent is true, filter to only folders with enabled content
    let result = folders;
    if (onlyWithContent) {
      const foldersWithContent = await Promise.all(
        folders.map(async (folder) => {
          const hasEnabledContent = await db
            .select()
            .from(content)
            .where(and(
              eq(content.folderId, folder.id), 
              eq(content.isEnabled, true),
              eq(content.type, folder.type) // Ensure content type matches folder type
            ))
            .limit(1);
          
          return hasEnabledContent.length > 0 ? folder : null;
        })
      );
      
      result = foldersWithContent.filter((f): f is TestFolder => f !== null);
    }
    
    // Apply pagination
    return result.slice(offset, offset + limit);
  }

  async getTestFolder(id: number): Promise<TestFolder | undefined> {
    const [folder] = await db.select().from(testFolders).where(eq(testFolders.id, id));
    return folder || undefined;
  }

  async createTestFolder(folder: InsertTestFolder): Promise<TestFolder> {
    const [item] = await db.insert(testFolders).values(folder).returning();
    return item;
  }

  async updateTestFolder(id: number, updates: Partial<InsertTestFolder>): Promise<TestFolder | undefined> {
    const [item] = await db.update(testFolders).set(updates).where(eq(testFolders.id, id)).returning();
    return item || undefined;
  }

  async deleteTestFolder(id: number): Promise<boolean> {
    // Set folderId to null for all content in this folder
    await db.update(content).set({ folderId: null }).where(eq(content.folderId, id));
    // Delete the folder
    const result = await db.delete(testFolders).where(eq(testFolders.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Results methods
  async getResult(id: number): Promise<Result | undefined> {
    const [result] = await db.select().from(results).where(eq(results.id, id));
    return result || undefined;
  }

  async getResultsByIds(ids: number[]): Promise<Result[]> {
    if (!ids || ids.length === 0) return [];
    // Ensure all ids are numbers
    const numericIds = ids.map((i) => Number(i)).filter((i) => Number.isFinite(i));
    if (numericIds.length === 0) return [];

    // Fetch each result individually to avoid SQL dialect issues and keep code simple/safe
    const promises = numericIds.map((id) => this.getResult(id));
    const resultsArr = await Promise.all(promises);
    return resultsArr.filter((r): r is Result => !!r);
  }

  async getResultsByStudent(studentId: number, contentType?: string): Promise<Result[]> {
    if (contentType) {
      return await db.select().from(results).where(and(eq(results.studentId, studentId), eq(results.contentType, contentType))).orderBy(desc(results.submittedAt));
    }
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

  async getGalleryImagesPaged(limit: number, offset: number): Promise<GalleryImage[]> {
    return await db.select().from(galleryImages).orderBy(desc(galleryImages.createdAt)).limit(limit).offset(offset);
  }

  async getFeaturedGalleryImages(): Promise<GalleryImage[]> {
    // Get first 10 featured images sorted by order (ascending), limit to 10
    const images = await db.select().from(galleryImages).where(lt(galleryImages.order, 10)).orderBy(asc(galleryImages.order)).limit(10);
    console.log('Database query result - featured images:', {
      count: images.length,
      images: images.map((img: any) => ({ id: img.id, order: img.order, hasUrl: !!img.url }))
    });
    return images;
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

  async updateGalleryImageOrder(imageIds: number[]): Promise<boolean> {
    console.log('Updating gallery image order for IDs:', imageIds);
    
    // Reset all images to order 999 first
    await db.update(galleryImages).set({ order: 999 });
    
    // Update specified images with their new order (0-9 for first 10 selections)
    for (let i = 0; i < Math.min(imageIds.length, 10); i++) {
      const imageId = imageIds[i];
      console.log(`Setting image ${imageId} to order ${i}`);
      await db.update(galleryImages).set({ order: i }).where(eq(galleryImages.id, imageId));
    }
    
    // Verify the update
    const updated = await db.select().from(galleryImages).where(lt(galleryImages.order, 10)).orderBy(asc(galleryImages.order));
    console.log('Featured images after update:', {
      count: updated.length,
      images: updated.map((img: any) => ({ id: img.id, order: img.order, hasUrl: !!img.url }))
    });
    
    return true;
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
      try {
        const [created] = await db.insert(settings).values(insertSetting).returning();
        return created;
      } catch (error: any) {
        // Handle race condition - if another request inserted the same key, update instead
        if (error?.code === '23505') {
          const [updated] = await db.update(settings)
            .set({ value: insertSetting.value, updatedAt: new Date() })
            .where(eq(settings.key, insertSetting.key))
            .returning();
          return updated;
        }
        throw error;
      }
    }
  }

  // Notices methods
  async createNotice(notice: InsertNotice): Promise<Notice> {
    const [created] = await db.insert(notices).values(notice).returning();
    return created;
  }

  async getNotice(id: number): Promise<Notice | undefined> {
    const [notice] = await db.select().from(notices).where(eq(notices.id, id));
    return notice || undefined;
  }

  async getActiveNotices(limit?: number, offset?: number): Promise<Notice[]> {
    let q: any = db.select().from(notices).where(eq(notices.isActive, true)).orderBy(desc(notices.createdAt));
    if (typeof limit === 'number') q = q.limit(limit);
    if (typeof offset === 'number') q = q.offset(offset);
    return await q;
  }

  async getAllNotices(limit?: number, offset?: number): Promise<Notice[]> {
    let q: any = db.select().from(notices).orderBy(desc(notices.createdAt));
    if (typeof limit === 'number') q = q.limit(limit);
    if (typeof offset === 'number') q = q.offset(offset);
    return await q;
  }

  async updateNotice(id: number, updates: Partial<InsertNotice>): Promise<Notice | undefined> {
    const [updated] = await db.update(notices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notices.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNotice(id: number): Promise<boolean> {
    const result = await db.delete(notices).where(eq(notices.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const storage = new DatabaseStorage();
