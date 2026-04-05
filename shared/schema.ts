import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, numeric, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: varchar("mobile", { length: 15 }).notNull().unique(),
  batch: text("batch").notNull(),
  studentId: varchar("student_id", { length: 50 }).unique(),
  email: text("email"),
  role: varchar("role", { length: 10 }).notNull(), // 'admin' | 'student'
  password: text("password").notNull(),
  
  // Additional fields
  city: text("city").notNull(),
  state: text("state").notNull(),
  profilePicture: text("profile_picture"),
  isPaymentCompleted: boolean("is_payment_completed").default(false),
  paymentAmount: numeric("payment_amount"),
  validUntil: timestamp("valid_until"),
  accessEnabledAt: timestamp("access_enabled_at"),
  purchasedPdfs: text("purchased_pdfs").array().default(sql`ARRAY[]::text[]`),
  currentSessionId: varchar("current_session_id", { length: 255 }), // Current active session ID for cheap validation
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  roleIdx: index("users_role_idx").on(table.role),
  studentIdIdx: index("users_student_id_idx").on(table.studentId),
  isPaymentCompletedIdx: index("users_is_payment_completed_idx").on(table.isPaymentCompleted),
}));

// Test Folders table (organize tests by language and folder)
export const testFolders = pgTable("test_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  language: varchar("language", { length: 10 }).notNull(), // 'english' | 'hindi'
  type: varchar("type", { length: 20 }).notNull().default("typing"), // 'typing' | 'shorthand'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  languageIdx: index("test_folders_language_idx").on(table.language),
  typeIdx: index("test_folders_type_idx").on(table.type),
  languageTypeIdx: index("test_folders_language_type_idx").on(table.language, table.type),
  createdAtIdx: index("test_folders_created_at_idx").on(table.createdAt),
}));

// Content table (typing, shorthand, and pitman book exercise tests)
export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'typing' | 'shorthand' | 'pitman'
  text: text("text").notNull(),
  duration: integer("duration").notNull(), // in minutes
  dateFor: varchar("date_for", { length: 20 }).notNull(), // ISO date string
  isEnabled: boolean("is_enabled").default(false).notNull(),
  autoScroll: boolean("auto_scroll").default(true).notNull(), // enable auto-scroll for typing tests
  language: varchar("language", { length: 10 }).default('english'), // 'english' | 'hindi'
  folderId: integer("folder_id").references(() => testFolders.id, { onDelete: "set null" }), // optional folder
  
  // YouTube video links for shorthand test (optional)
  video60wpm: text("video_60wpm"), // YouTube link for 60 WPM
  video80wpm: text("video_80wpm"), // YouTube link for 80 WPM
  video100wpm: text("video_100wpm"), // YouTube link for 100 WPM
  video120wpm: text("video_120wpm"), // YouTube link for 120 WPM
  
  // PDF file for Pitman Book Exercise (optional, stored as base64)
  pdfFile: text("pdf_file"), // Base64 encoded PDF file for pitman book exercise
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("content_type_idx").on(table.type),
  isEnabledIdx: index("content_is_enabled_idx").on(table.isEnabled),
  languageIdx: index("content_language_idx").on(table.language),
  folderIdIdx: index("content_folder_id_idx").on(table.folderId),
  typeIsEnabledIdx: index("content_type_is_enabled_idx").on(table.type, table.isEnabled),
  languageTypeIdx: index("content_language_type_idx").on(table.language, table.type),
  createdAtIdx: index("content_created_at_idx").on(table.createdAt),
}));

// Results table
export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id),
  studentDisplayId: varchar("student_display_id", { length: 50 }), // PIPS format ID for display
  studentName: text("student_name").notNull(),
  contentId: integer("content_id").references(() => content.id, { onDelete: "set null" }),
  contentTitle: text("content_title").notNull(),
  contentType: varchar("content_type", { length: 20 }).notNull(),
  
  // Original content - with and without HTML
  originalText: text("original_text"), // With HTML - for rendering/PDF
  originalTextClean: text("original_text_clean"), // Without HTML - for metrics calculation
  
  // Typed content - with and without HTML/PARA_TOKENs
  typedText: text("typed_text").notNull(), // With PARA_TOKENs - for rendering
  typedTextClean: text("typed_text_clean"), // Without HTML or PARA_TOKENs - for metrics calculation
  
  language: varchar("language", { length: 10 }).default('english'),
  
  // Metrics stored as JSON-like fields
  words: integer("words").notNull(),
  time: integer("time").notNull(),
  mistakes: numeric("mistakes").notNull(),
  halfMistakes: numeric("half_mistakes"), // Comma errors for shorthand (missing or extra commas)
  backspaces: integer("backspaces").default(0),
  grossSpeed: text("gross_speed"),
  netSpeed: text("net_speed"),
  result: varchar("result", { length: 10}), // 'Pass' | 'Fail'
  
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => ({
  studentIdIdx: index("results_student_id_idx").on(table.studentId),
  contentTypeIdx: index("results_content_type_idx").on(table.contentType),
  contentIdIdx: index("results_content_id_idx").on(table.contentId),
  submittedAtIdx: index("results_submitted_at_idx").on(table.submittedAt),
  studentIdContentTypeIdx: index("results_student_id_content_type_idx").on(table.studentId, table.contentType),
  contentTypeSubmittedAtIdx: index("results_content_type_submitted_at_idx").on(table.contentType, table.submittedAt),
}));

// PDF Folders
export const pdfFolders = pgTable("pdf_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PDF Resources
export const pdfResources = pgTable("pdf_resources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  pageCount: integer("page_count").notNull(),
  price: numeric("price").notNull(),
  folderId: integer("folder_id").references(() => pdfFolders.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  folderIdIdx: index("pdf_resources_folder_id_idx").on(table.folderId),
  createdAtIdx: index("pdf_resources_created_at_idx").on(table.createdAt),
}));

// Dictations
export const dictations = pgTable("dictations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  mediaUrl: text("media_url").notNull(),
  language: varchar("language", { length: 10 }).default('english'),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Selected Candidates
export const selectedCandidates = pgTable("selected_candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  designation: text("designation").notNull(),
  year: varchar("year", { length: 10 }).notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Gallery Images
export const galleryImages = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  order: integer("order").default(999).notNull(), // Default 999 for unselected; 0-9 for selected/featured images
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("gallery_images_order_idx").on(table.order),
  createdAtIdx: index("gallery_images_created_at_idx").on(table.createdAt),
}));

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notices
export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  heading: text("heading").notNull(),
  content: text("content").notNull(),
  pdfUrl: text("pdf_url"), // Optional PDF attachment
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Sessions - minimal tracking for restricting concurrent logins
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  loginTime: timestamp("login_time").defaultNow().notNull(),
  lastActivityTime: timestamp("last_activity_time").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  loginTime: true,
  lastActivityTime: true,
});

export const insertTestFolderSchema = createInsertSchema(testFolders).omit({
  id: true,
  createdAt: true,
});

export const insertContentSchema = createInsertSchema(content).omit({
  id: true,
  createdAt: true,
  isEnabled: true,
}).extend({
  autoScroll: z.boolean().optional(),
  folderId: z.number().optional(),
});

export const insertResultSchema = createInsertSchema(results).omit({
  id: true,
  submittedAt: true,
});

export const insertPdfFolderSchema = createInsertSchema(pdfFolders).omit({
  id: true,
  createdAt: true,
});

export const insertPdfResourceSchema = createInsertSchema(pdfResources).omit({
  id: true,
  createdAt: true,
}).extend({
  price: z.union([z.string(), z.number()]).transform(val => String(val)),
});

export const insertDictationSchema = createInsertSchema(dictations).omit({
  id: true,
  createdAt: true,
  isEnabled: true,
});

export const insertSelectedCandidateSchema = createInsertSchema(selectedCandidates).omit({
  id: true,
  createdAt: true,
});

export const insertGalleryImageSchema = createInsertSchema(galleryImages).omit({
  id: true,
  createdAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isActive: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TestFolder = typeof testFolders.$inferSelect;
export type InsertTestFolder = z.infer<typeof insertTestFolderSchema>;

export type Content = typeof content.$inferSelect;
export type InsertContent = z.infer<typeof insertContentSchema>;

export type Result = typeof results.$inferSelect;
export type InsertResult = z.infer<typeof insertResultSchema>;

export type PdfFolder = typeof pdfFolders.$inferSelect;
export type InsertPdfFolder = z.infer<typeof insertPdfFolderSchema>;

export type PdfResource = typeof pdfResources.$inferSelect;
export type InsertPdfResource = z.infer<typeof insertPdfResourceSchema>;

export type Dictation = typeof dictations.$inferSelect;
export type InsertDictation = z.infer<typeof insertDictationSchema>;

export type SelectedCandidate = typeof selectedCandidates.$inferSelect;
export type InsertSelectedCandidate = z.infer<typeof insertSelectedCandidateSchema>;

export type GalleryImage = typeof galleryImages.$inferSelect;
export type InsertGalleryImage = z.infer<typeof insertGalleryImageSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
