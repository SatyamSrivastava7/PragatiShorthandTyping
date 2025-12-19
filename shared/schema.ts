import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, numeric, serial } from "drizzle-orm/pg-core";
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
  city: text("city"),
  state: text("state"),
  profilePicture: text("profile_picture"),
  isPaymentCompleted: boolean("is_payment_completed").default(false),
  paymentAmount: numeric("payment_amount"),
  validUntil: timestamp("valid_until"),
  accessEnabledAt: timestamp("access_enabled_at"),
  purchasedPdfs: text("purchased_pdfs").array().default(sql`ARRAY[]::text[]`),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Content table (typing and shorthand tests)
export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'typing' | 'shorthand'
  text: text("text").notNull(),
  duration: integer("duration").notNull(), // in minutes
  dateFor: varchar("date_for", { length: 20 }).notNull(), // ISO date string
  isEnabled: boolean("is_enabled").default(false).notNull(),
  autoScroll: boolean("auto_scroll").default(true).notNull(), // enable auto-scroll for typing tests
  mediaUrl: text("media_url"),
  language: varchar("language", { length: 10 }).default('english'), // 'english' | 'hindi'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Results table
export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => users.id),
  studentDisplayId: varchar("student_display_id", { length: 50 }), // PIPS format ID for display
  studentName: text("student_name").notNull(),
  contentId: integer("content_id").notNull().references(() => content.id),
  contentTitle: text("content_title").notNull(),
  contentType: varchar("content_type", { length: 20 }).notNull(),
  typedText: text("typed_text").notNull(),
  originalText: text("original_text"),
  language: varchar("language", { length: 10 }).default('english'),
  
  // Metrics stored as JSON-like fields
  words: integer("words").notNull(),
  time: integer("time").notNull(),
  mistakes: numeric("mistakes").notNull(),
  backspaces: integer("backspaces").default(0),
  grossSpeed: text("gross_speed"),
  netSpeed: text("net_speed"),
  result: varchar("result", { length: 10}), // 'Pass' | 'Fail'
  
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

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
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertContentSchema = createInsertSchema(content).omit({
  id: true,
  createdAt: true,
  isEnabled: true,
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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
