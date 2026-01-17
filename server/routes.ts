import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import busboy from "busboy";
import { 
  insertUserSchema, 
  insertContentSchema, 
  insertResultSchema,
  insertPdfFolderSchema,
  insertPdfResourceSchema,
  insertDictationSchema,
  insertSelectedCandidateSchema,
  insertGalleryImageSchema,
  insertSettingSchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Session user type
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== AUTH ROUTES ====================
  
  // Helper function to validate parsed IDs
  const validateId = (id: number): boolean => !isNaN(id) && id > 0;

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { paymentConfirmed, ...userData } = req.body;
      const validatedData = insertUserSchema.parse({ ...userData, role: 'student' });
      
      // Check if payment verification is required
      const paymentVerificationSetting = await storage.getSetting('requirePaymentVerification');
      const requirePaymentVerification = paymentVerificationSetting?.value === 'true';
      
      if (requirePaymentVerification && !paymentConfirmed) {
        return res.status(403).json({ 
          message: "Payment verification required. Please complete payment and confirm before registering." 
        });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByMobile(validatedData.mobile);
      if (existingUser) {
        return res.status(400).json({ message: "User with this mobile number already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Retry logic for handling concurrent registrations
      const maxRetries = 5;
      let user = null;
      let lastError = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Generate student ID (PIPS + year + sequential number)
          const year = new Date().getFullYear().toString().slice(-2);
          const allUsers = await storage.getAllUsers();
          const prefix = `PIPS${year}`;
          
          // Find the highest existing student ID number for this year
          let maxNum = 0;
          for (const u of allUsers) {
            if (u.studentId && u.studentId.startsWith(prefix)) {
              const numStr = u.studentId.slice(prefix.length);
              const num = parseInt(numStr, 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }
          const studentId = `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
          
          // Create user with isPaymentCompleted = false (requires admin approval)
          user = await storage.createUser({
            ...validatedData,
            password: hashedPassword,
            studentId,
            isPaymentCompleted: false,
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          // Check if it's a duplicate key error on student_id (code 23505)
          if (error?.code === '23505' && error?.constraint === 'users_student_id_unique') {
            // Retry with a new student ID
            continue;
          }
          // For other errors, throw immediately
          throw error;
        }
      }
      
      if (!user) {
        console.error("Registration failed after retries:", lastError);
        return res.status(500).json({ message: "Registration failed due to high traffic. Please try again." });
      }
      
      // Don't auto-login students - they need admin approval first
      // Return success with pending approval message
      res.json({ 
        success: true,
        pendingApproval: true,
        studentId: user.studentId,
        message: "Your profile has been created successfully! Please contact the administrator to activate your account before you can log in."
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to register user" });
    }
  });
  
  // Login (Students only - admins must use /api/auth/admin-login)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { mobile, password } = req.body;
      
      if (!mobile || !password) {
        return res.status(400).json({ message: "Mobile and password are required" });
      }
      
      // Find user
      const user = await storage.getUserByMobile(mobile);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Block admin login on student login page
      if (user.role === 'admin') {
        return res.status(403).json({ message: "Admin accounts must use the admin login page." });
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check if student access is disabled (payment not completed)
      if (user.role === 'student' && !user.isPaymentCompleted) {
        return res.status(403).json({ message: "Your access has been disabled. Please contact the administrator." });
      }
      
      // Check if student access has expired (30 days validity)
      if (user.role === 'student' && user.validUntil) {
        const now = new Date();
        const validUntil = new Date(user.validUntil);
        if (now > validUntil) {
          // Auto-disable access when expired
          await storage.updateUser(user.id, { isPaymentCompleted: false, accessEnabledAt: null, validUntil: null });
          return res.status(403).json({ message: "Your 30-day access has expired. Please contact the administrator to renew." });
        }
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Failed to login" });
    }
  });
  
  // Admin Login (Admin only)
  app.post("/api/auth/admin-login", async (req, res) => {
    try {
      const { mobile, password } = req.body;
      
      if (!mobile || !password) {
        return res.status(400).json({ message: "Mobile and password are required" });
      }
      
      // Find user
      const user = await storage.getUserByMobile(mobile);
      if (!user) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }
      
      // Only allow admin users
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "This login is for administrators only." });
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }
      
      // Set session and save it before responding
      req.session.userId = user.id;
      
      // Explicitly save session to ensure it's persisted before response
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });
  
  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Get session (returns user or null, never 401)
  app.get("/api/auth/session", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.json({ user: null });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.json({ user: null });
      }
      
      // Check if student access has expired (30 days validity)
      if (user.role === 'student' && user.validUntil) {
        const now = new Date();
        const validUntil = new Date(user.validUntil);
        if (now > validUntil) {
          // Auto-disable access when expired
          await storage.updateUser(user.id, { isPaymentCompleted: false, accessEnabledAt: null, validUntil: null });
          // Destroy session
          req.session.destroy(() => {});
          return res.json({ user: null, expired: true, message: "Your 30-day access has expired." });
        }
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.json({ user: null });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { studentId, mobile, city, newPassword } = req.body;
      
      if (!studentId || !mobile || !city || !newPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      // Find user by mobile
      const user = await storage.getUserByMobile(mobile);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify studentId and city match
      if (user.studentId !== studentId || user.city?.toLowerCase() !== city.toLowerCase()) {
        return res.status(400).json({ message: "Details do not match our records" });
      }
      
      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  
  // ==================== USER ROUTES ====================
  
  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    try {
      const role = req.query.role as string | undefined;
      const users = await storage.getAllUsers(role);
      
      // Remove passwords
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });
  
  // Get user by ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!validateId(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });
  
  // Update user
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!validateId(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const updates = req.body;
      
      // If password is being updated, hash it
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }
      
      // Handle access enable/disable with 30-day expiration
      if (updates.isPaymentCompleted !== undefined) {
        const existingUser = await storage.getUser(id);
        if (existingUser) {
          if (updates.isPaymentCompleted === true && !existingUser.isPaymentCompleted) {
            // Enabling access - set 30-day validity
            const now = new Date();
            const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
            updates.accessEnabledAt = now;
            updates.validUntil = validUntil;
          } else if (updates.isPaymentCompleted === false) {
            // Disabling access - clear validity dates
            updates.accessEnabledAt = null;
            updates.validUntil = null;
          }
        }
      }
      
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!validateId(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  // ==================== CONTENT ROUTES ====================
  
  // Get all content list (lightweight - excludes text field)
  app.get("/api/content/list", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const content = await storage.getAllContentList(type);
      res.json(content);
    } catch (error) {
      console.error("Error fetching content list:", error);
      res.status(500).json({ message: "Failed to get content", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Get enabled content list (lightweight - excludes text field)
  app.get("/api/content/enabled/list", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const language = req.query.language as string | undefined;
      let limit = req.query.limit ? Number(req.query.limit as string) : undefined;
      let offset = req.query.offset ? Number(req.query.offset as string) : undefined;
      if (!Number.isFinite(limit as number)) limit = undefined;
      if (!Number.isFinite(offset as number)) offset = undefined;

      // If pagination or filters provided, use paged method
      if (type || language || typeof limit === 'number' || typeof offset === 'number') {
        const content = await storage.getEnabledContentListPaged(type, language, limit, offset);
        return res.json(content);
      }

      const content = await storage.getEnabledContentList();
      res.json(content);
    } catch (error) {
      console.error("Error fetching enabled content list:", error);
      res.status(500).json({ message: "Failed to get content", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Get all content (full data including text)
  app.get("/api/content", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const dateFor = req.query.dateFor as string | undefined;
      
      let content;
      if (dateFor) {
        content = await storage.getContentByDate(dateFor, type);
      } else {
        content = await storage.getAllContent(type);
      }
      
      res.json(content);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ message: "Failed to get content", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Get enabled content only (full data)
  app.get("/api/content/enabled", async (req, res) => {
    try {
      const content = await storage.getEnabledContent();
      res.json(content);
    } catch (error) {
      console.error("Error fetching enabled content:", error);
      res.status(500).json({ message: "Failed to get content", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  
  // Get content by ID
  app.get("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const content = await storage.getContent(id);
      
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to get content" });
    }
  });
  
  // Create content (with FormData using busboy for streaming file uploads)
  app.post("/api/content/upload", async (req, res) => {
    try {
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
      const formData: Record<string, string> = {};
      let audioFileBuffer: Buffer | null = null;
      let audioMimeType: string | null = null;
      let fileSize = 0;

      return new Promise<void>((resolve, reject) => {
        const bb = busboy({ 
          headers: req.headers,
          limits: {
            fileSize: MAX_FILE_SIZE,
          }
        });

        // Handle file field
        bb.on('file', (name: string, file: any, info: { filename: string; encoding: string; mimeType: string }) => {
          const { mimeType } = info;
          
          if (name === 'audioFile') {
            audioMimeType = mimeType || 'audio/mpeg';
            const chunks: Buffer[] = [];

            file.on('data', (chunk: Buffer) => {
              fileSize += chunk.length;
              if (fileSize > MAX_FILE_SIZE) {
                file.destroy();
                if (!res.headersSent) {
                  res.status(400).json({ message: 'File size exceeds 100MB limit' });
                }
                reject(new Error('File size exceeds 100MB limit'));
                return;
              }
              chunks.push(chunk);
            });

            file.on('end', () => {
              audioFileBuffer = Buffer.concat(chunks);
            });

            file.on('error', (err: Error) => {
              reject(new Error(`File upload error: ${err.message}`));
            });
          } else {
            // Ignore other files
            file.resume();
          }
        });

        // Handle form fields
        bb.on('field', (name: string, value: string) => {
          formData[name] = value;
        });

        // Handle form completion
        bb.on('finish', async () => {
          try {
            // Convert audio file to base64 if present
            let mediaUrl: string | null = null;
            if (audioFileBuffer) {
              const base64 = audioFileBuffer.toString('base64');
              mediaUrl = `data:${audioMimeType || 'audio/mpeg'};base64,${base64}`;
            }

            const validatedData = insertContentSchema.parse({
              title: formData.title,
              type: formData.type,
              text: formData.text,
              duration: parseInt(formData.duration),
              dateFor: formData.dateFor,
              language: formData.language || 'english',
              mediaUrl,
              autoScroll: formData.autoScroll === 'true',
            });

            const content = await storage.createContent(validatedData);
            res.status(201).json(content);
            resolve();
          } catch (error) {
            if (!res.headersSent) {
              if (error instanceof z.ZodError) {
                res.status(400).json({ message: fromZodError(error).message });
              } else {
                res.status(500).json({ message: "Failed to create content" });
              }
            }
            reject(error);
          }
        });

        // Handle errors
        bb.on('error', (err: Error) => {
          if (!res.headersSent) {
            res.status(400).json({ message: `Upload error: ${err.message}` });
          }
          reject(err);
        });

        // Pipe request to busboy
        req.pipe(bb);
      });
    } catch (error) {
      if (!res.headersSent) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: fromZodError(error).message });
        }
        res.status(500).json({ message: "Failed to create content" });
      }
    }
  });

  // Create content (original JSON endpoint)
  app.post("/api/content", async (req, res) => {
    try {
      const validatedData = insertContentSchema.parse(req.body);
      const content = await storage.createContent(validatedData);
      res.status(201).json(content);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create content" });
    }
  });
  
  // Update content
  app.patch("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const content = await storage.updateContent(id, req.body);
      
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content" });
    }
  });
  
  // Toggle content (lightweight - only returns id and isEnabled, no text/mediaUrl)
  // Supports both POST and PATCH
  app.post("/api/content/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.toggleContentLightweight(id);
      
      if (!result) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Return only id and isEnabled (no large fields like text/mediaUrl)
      // This prevents downloading large audio files on toggle
      res.json(result);
    } catch (error) {
      console.error("Error toggling content:", error);
      res.status(500).json({ message: "Failed to toggle content" });
    }
  });

  app.patch("/api/content/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.toggleContentLightweight(id);
      
      if (!result) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Return only id and isEnabled (no large fields like text/mediaUrl)
      // This prevents downloading large audio files on toggle
      res.json(result);
    } catch (error) {
      console.error("Error toggling content:", error);
      res.status(500).json({ message: "Failed to toggle content" });
    }
  });
  
  // Delete content
  app.delete("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!validateId(id)) {
        return res.status(400).json({ message: "Invalid content ID" });
      }
      const success = await storage.deleteContent(id);
      
      if (!success) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Delete content error:", error);
      res.status(500).json({ message: "Failed to delete content" });
    }
  });
  
  // ==================== RESULTS ROUTES ====================
  
  // Get all results
  app.get("/api/results", async (req, res) => {
    try {
      const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
      const contentId = req.query.contentId ? parseInt(req.query.contentId as string) : undefined;
      
      let results;
      if (studentId) {
        results = await storage.getResultsByStudent(studentId);
      } else if (contentId) {
        results = await storage.getResultsByContent(contentId);
      } else {
        results = await storage.getAllResults();
      }
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to get results" });
    }
  });

  // Get results by student ID (URL pattern)
  app.get("/api/results/student/:studentId", async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const results = await storage.getResultsByStudent(studentId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to get results" });
    }
  });
  
  // Get result by ID
  app.get("/api/results/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.getResult(id);
      
      if (!result) {
        return res.status(404).json({ message: "Result not found" });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get result" });
    }
  });
  
  // Create result
  app.post("/api/results", async (req, res) => {
    try {
      // Get current user from session
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Get content details
      const contentItem = await storage.getContent(req.body.contentId);
      if (!contentItem) {
        return res.status(404).json({ message: "Content not found" });
      }
      
      // Calculate pass/fail result based on 5% mistake rule for all test types
      // More than 5% mistakes = Fail, 5% or less = Pass
      const mistakes = parseFloat(req.body.mistakes) || 0;
      const totalWords = parseFloat(req.body.words) || 0;
      const mistakePercentage = totalWords > 0 ? (mistakes / totalWords) * 100 : 0;
      const calculatedResult = mistakePercentage > 5 ? 'Fail' : 'Pass';
      
      // Build complete result data
      const resultData = {
        ...req.body,
        studentId: user.id,
        studentDisplayId: user.studentId, // PIPS format ID for display
        studentName: user.name,
        contentTitle: contentItem.title,
        contentType: contentItem.type,
        originalText: contentItem.text,
        language: contentItem.language || 'english',
        result: calculatedResult,
      };
      
      const validatedData = insertResultSchema.parse(resultData);
      const result = await storage.createResult(validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create result" });
    }
  });
  
  // Delete result
  app.delete("/api/results/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteResult(id);
      
      if (!success) {
        return res.status(404).json({ message: "Result not found" });
      }
      
      res.json({ message: "Result deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete result" });
    }
  });
  
  // ==================== PDF FOLDER ROUTES ====================
  
  // Support both /api/pdf-folders and /api/pdf/folders
  app.get("/api/pdf-folders", async (req, res) => {
    try {
      const folders = await storage.getAllPdfFolders();
      res.json(folders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get folders" });
    }
  });

  app.get("/api/pdf/folders", async (req, res) => {
    try {
      const folders = await storage.getAllPdfFolders();
      res.json(folders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get folders" });
    }
  });
  
  app.post("/api/pdf-folders", async (req, res) => {
    try {
      const validatedData = insertPdfFolderSchema.parse(req.body);
      const folder = await storage.createPdfFolder(validatedData);
      res.status(201).json(folder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.post("/api/pdf/folders", async (req, res) => {
    try {
      const validatedData = insertPdfFolderSchema.parse(req.body);
      const folder = await storage.createPdfFolder(validatedData);
      res.status(201).json(folder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create folder" });
    }
  });
  
  app.delete("/api/pdf-folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePdfFolder(id);
      
      if (!success) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      res.json({ message: "Folder deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  app.delete("/api/pdf/folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePdfFolder(id);
      
      if (!success) {
        return res.status(404).json({ message: "Folder not found" });
      }
      
      res.json({ message: "Folder deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });
  
  // ==================== PDF RESOURCE ROUTES ====================
  
  // Support both /api/pdf-resources and /api/pdf/resources
  app.get("/api/pdf-resources", async (req, res) => {
    try {
      const folderId = req.query.folderId ? parseInt(req.query.folderId as string) : undefined;
      
      let resources;
      if (folderId) {
        resources = await storage.getPdfResourcesByFolder(folderId);
      } else {
        resources = await storage.getAllPdfResources();
      }
      
      res.json(resources);
    } catch (error) {
      res.status(500).json({ message: "Failed to get resources" });
    }
  });

  app.get("/api/pdf/resources", async (req, res) => {
    try {
      const folderId = req.query.folderId ? parseInt(req.query.folderId as string) : undefined;
      
      let resources;
      if (folderId) {
        resources = await storage.getPdfResourcesByFolder(folderId);
      } else {
        resources = await storage.getAllPdfResources();
      }
      
      res.json(resources);
    } catch (error) {
      res.status(500).json({ message: "Failed to get resources" });
    }
  });
  
  app.post("/api/pdf-resources", async (req, res) => {
    try {
      const validatedData = insertPdfResourceSchema.parse(req.body);
      const resource = await storage.createPdfResource(validatedData);
      res.status(201).json(resource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create resource" });
    }
  });

  app.post("/api/pdf/resources", async (req, res) => {
    try {
      const validatedData = insertPdfResourceSchema.parse(req.body);
      const resource = await storage.createPdfResource(validatedData);
      res.status(201).json(resource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create resource" });
    }
  });
  
  app.patch("/api/pdf-resources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const resource = await storage.updatePdfResource(id, req.body);
      
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      res.json(resource);
    } catch (error) {
      res.status(500).json({ message: "Failed to update resource" });
    }
  });
  
  app.delete("/api/pdf-resources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePdfResource(id);
      
      if (!success) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      res.json({ message: "Resource deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  app.delete("/api/pdf/resources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePdfResource(id);
      
      if (!success) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      res.json({ message: "Resource deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  // PDF Purchase route
  app.post("/api/pdf/purchase/:pdfId", async (req, res) => {
    try {
      const pdfId = parseInt(req.params.pdfId);
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Add pdfId to user's purchasedPdfs
      const purchasedPdfs = user.purchasedPdfs || [];
      if (!purchasedPdfs.includes(pdfId.toString())) {
        purchasedPdfs.push(pdfId.toString());
        await storage.updateUser(userId, { purchasedPdfs });
      }
      
      res.json({ message: "PDF purchased successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to purchase PDF" });
    }
  });
  
  // Consume PDF purchase (remove from purchased list after download)
  app.post("/api/pdf/consume/:pdfId", async (req, res) => {
    try {
      const pdfId = parseInt(req.params.pdfId);
      const userId = req.session.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove pdfId from user's purchasedPdfs
      const purchasedPdfs = (user.purchasedPdfs || []).filter(id => id !== pdfId.toString());
      await storage.updateUser(userId, { purchasedPdfs });
      
      res.json({ message: "PDF purchase consumed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to consume PDF purchase" });
    }
  });
  
  // ==================== DICTATION ROUTES ====================
  
  app.get("/api/dictations", async (req, res) => {
    try {
      const dictations = await storage.getAllDictations();
      res.json(dictations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dictations" });
    }
  });
  
  app.post("/api/dictations", async (req, res) => {
    try {
      const validatedData = insertDictationSchema.parse(req.body);
      const dictation = await storage.createDictation(validatedData);
      res.status(201).json(dictation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create dictation" });
    }
  });
  
  app.patch("/api/dictations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dictation = await storage.updateDictation(id, req.body);
      
      if (!dictation) {
        return res.status(404).json({ message: "Dictation not found" });
      }
      
      res.json(dictation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update dictation" });
    }
  });
  
  app.post("/api/dictations/:id/toggle", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dictation = await storage.toggleDictation(id);
      
      if (!dictation) {
        return res.status(404).json({ message: "Dictation not found" });
      }
      
      res.json(dictation);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle dictation" });
    }
  });
  
  app.delete("/api/dictations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDictation(id);
      
      if (!success) {
        return res.status(404).json({ message: "Dictation not found" });
      }
      
      res.json({ message: "Dictation deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dictation" });
    }
  });
  
  // ==================== SELECTED CANDIDATES ROUTES ====================
  
  app.get("/api/selected-candidates", async (req, res) => {
    try {
      const candidates = await storage.getAllSelectedCandidates();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get candidates" });
    }
  });
  
  app.post("/api/selected-candidates", async (req, res) => {
    try {
      const validatedData = insertSelectedCandidateSchema.parse(req.body);
      const candidate = await storage.createSelectedCandidate(validatedData);
      res.status(201).json(candidate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create candidate" });
    }
  });
  
  app.delete("/api/selected-candidates/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSelectedCandidate(id);
      
      if (!success) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      
      res.json({ message: "Candidate deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete candidate" });
    }
  });
  
  // ==================== GALLERY ROUTES ====================
  
  app.get("/api/gallery", async (req, res) => {
    try {
      const images = await storage.getAllGalleryImages();
      res.json(images);
    } catch (error) {
      res.status(500).json({ message: "Failed to get images" });
    }
  });
  
  app.post("/api/gallery", async (req, res) => {
    try {
      const validatedData = insertGalleryImageSchema.parse(req.body);
      const image = await storage.createGalleryImage(validatedData);
      res.status(201).json(image);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create image" });
    }
  });
  
  app.delete("/api/gallery/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteGalleryImage(id);
      
      if (!success) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete image" });
    }
  });

  // Delete gallery image by URL (body-based)
  app.delete("/api/gallery", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }
      
      // Find image by URL and delete
      const images = await storage.getAllGalleryImages();
      const image = images.find(img => img.url === url);
      
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      const success = await storage.deleteGalleryImage(image.id);
      if (!success) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete image" });
    }
  });
  
  // ==================== SETTINGS ROUTES ====================
  
  app.get("/api/settings", async (req, res) => {
    try {
      const key = req.query.key as string | undefined;
      
      if (key) {
        const setting = await storage.getSetting(key);
        if (!setting) {
          return res.status(404).json({ message: "Setting not found" });
        }
        res.json(setting);
      } else {
        const settingsArray = await storage.getAllSettings();
        const settingsObj: Record<string, any> = {};
        for (const s of settingsArray) {
          if (s.key === 'registrationFee') {
            settingsObj.registrationFee = Number(s.value) || 0;
          } else if (['autoScrollEnabled', 'showRegistrationFee', 'showQrCode', 'requirePaymentVerification'].includes(s.key)) {
            settingsObj[s.key] = s.value === 'true';
          } else {
            settingsObj[s.key] = s.value;
          }
        }
        res.json(settingsObj);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });
  
  app.post("/api/settings", async (req, res) => {
    try {
      const validatedData = insertSettingSchema.parse(req.body);
      const setting = await storage.upsertSetting(validatedData);
      res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to upsert setting" });
    }
  });

  // Update settings (PATCH - update multiple settings at once)
  app.patch("/api/settings", async (req, res) => {
    try {
      const updates = req.body;
      
      // Update each setting provided in the body
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          await storage.upsertSetting({ key, value: String(value) });
        }
      }
      
      // Return all settings after update in object format
      const settingsArray = await storage.getAllSettings();
      const settingsObj: Record<string, any> = {};
      for (const s of settingsArray) {
        if (s.key === 'registrationFee') {
          settingsObj.registrationFee = Number(s.value) || 0;
        } else if (['autoScrollEnabled', 'showRegistrationFee', 'showQrCode', 'requirePaymentVerification'].includes(s.key)) {
          settingsObj[s.key] = s.value === 'true';
        } else {
          settingsObj[s.key] = s.value;
        }
      }
      res.json(settingsObj);
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  return httpServer;
}
