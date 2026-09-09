import { storage } from "./storage";
import bcrypt from "bcryptjs";

async function seed() {
  try {
    console.log("Starting database seed...");
    
    // Check if admin already exists
    const existingAdmin = await storage.getUserByMobile("9918724449");
    
    if (existingAdmin) {
      console.log("Admin user already exists. Skipping seed.");
      return;
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash("admin1234", 10);
    const admin = await storage.createUser({
      mobile: "9918724449",
      password: hashedPassword,
      name: "Admin",
      batch: "Administration",
      city: "N/A",
      state: "N/A",
      role: "admin",
    });
    
    console.log("Admin user created successfully:");
    // console.log("Mobile: 9918724449");
    // console.log("Password: admin1234");
    // console.log("Role:", admin.role);
    
    // Create some initial settings
    await storage.upsertSetting({
      key: "institute_name",
      value: "Pragati Institute",
    });
    
    await storage.upsertSetting({
      key: "institute_address",
      value: "123 Main Street, City",
    });
    
    await storage.upsertSetting({
      key: "contact_mobile",
      value: "9876543210",
    });
    
    await storage.upsertSetting({
      key: "contact_email",
      value: "info@pragatiinstitute.com",
    });
    
    console.log("Initial settings created successfully.");
    console.log("Seed completed!");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
