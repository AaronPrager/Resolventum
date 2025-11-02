#!/usr/bin/env node

/**
 * CSV Student Import Script
 * 
 * Usage:
 *   node scripts/import-students.js <csv-file-path> [userId]
 * 
 * Example:
 *   node scripts/import-students.js students.csv
 *   node scripts/import-students.js students.csv "user-id-here"
 * 
 * CSV Format:
 *   The script tries to match common column names. Required: firstName, lastName
 *   Supported columns:
 *   - firstName, first_name, First Name
 *   - lastName, last_name, Last Name
 *   - email, Email
 *   - phone, Phone
 *   - dateOfBirth, date_of_birth, Date of Birth, DOB
 *   - address, Address
 *   - schoolName, school_name, School
 *   - grade, Grade
 *   - subject, Subject
 *   - difficulties, Difficulties
 *   - pricePerLesson, price_per_lesson
 *   - pricePerPackage, price_per_package
 *   - parentFullName, parent_full_name, Parent Name
 *   - parentEmail, parent_email, Parent Email
 *   - parentPhone, parent_phone, Parent Phone
 *   - parentAddress, parent_address
 *   - emergencyContactInfo, emergency_contact
 *   - notes, Notes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import prisma from '../prisma/client.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// CSV parser that handles quoted fields and commas inside quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

// Parse CSV content
function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  
  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Only process rows that match header length (or allow shorter rows with empty values)
    const row = {};
    header.forEach((col, index) => {
      row[col] = values[index]?.replace(/^"|"$/g, '') || null; // Remove quotes
    });
    rows.push(row);
  }

  return { header, rows };
}

// Normalize column names (case-insensitive, handles spaces/underscores/slashes)
function normalizeColumnName(colName) {
  return colName.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '')
    .replace(/\//g, '')  // Remove slashes (e.g., "Parent/Guardian" -> "parentguardian")
    .replace(/-/g, '');  // Remove hyphens too
}

// Split full name into first and last name
function splitFullName(fullName) {
  if (!fullName || !fullName.trim()) {
    return { firstName: null, lastName: null };
  }

  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  } else if (parts.length === 1) {
    // Only one name - use it as firstName
    return { firstName: parts[0], lastName: '' };
  } else {
    // Multiple parts - first is firstName, rest is lastName (handles middle names)
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }
}

// Map CSV row to Student data
function mapRowToStudent(row, userId) {
  const student = {
    userId,
    firstName: null,
    lastName: null,
  };

  // Column mapping (flexible matching)
  const columnMap = {
    // Name fields
    firstname: 'firstName',
    lastname: 'lastName',
    fullname: 'fullName', // Special handling for full name
    full_name: 'fullName',
    name: 'fullName',
    studentname: 'fullName',
    studentsfullname: 'fullName',
    'students full name': 'fullName',
    'studentsfullname': 'fullName',
    
    // Contact info
    email: 'email',
    phone: 'phone',
    
    // Student details
    dateofbirth: 'dateOfBirth',
    dob: 'dateOfBirth',
    'date of birth': 'dateOfBirth',
    gradelevel: 'grade',
    'grade level': 'grade',
    grade: 'grade',
    schoolname: 'schoolName',
    school: 'schoolName',
    'school name': 'schoolName',
    subject: 'subject',
    'subject needing tutoring': 'subject',
    'subjectneedingtutoring': 'subject',
    
    // Learning difficulties
    difficulties: 'difficulties',
    'learning difficulties': 'difficulties',
    'does the student have any learning difficulties or special needs': 'difficulties',
    'learningdifficulties': 'difficulties',
    
    // Parent/Guardian info
    parentfullname: 'parentFullName',
    parentname: 'parentFullName',
    'parent/guardian full name': 'parentFullName', // Normalizes to parentguardianfullname
    parentguardianfullname: 'parentFullName', // Direct normalized match (slash removed)
    'guardian full name': 'parentFullName',
    parentemail: 'parentEmail',
    'parent/guardian email': 'parentEmail', // Normalizes to parentguardianemail
    parentguardianemail: 'parentEmail', // Direct normalized match (slash removed)
    'guardian email': 'parentEmail',
    parentphone: 'parentPhone',
    'parent/guardian phone number': 'parentPhone', // Normalizes to parentguardianphonenumber
    parentguardianphonenumber: 'parentPhone', // Direct normalized match (slash removed)
    'guardian phone': 'parentPhone',
    parentaddress: 'parentAddress',
    'parent/guardian address': 'parentAddress',
    
    // Emergency contact
    emergencycontactinfo: 'emergencyContactInfo',
    emergencycontact: 'emergencyContactInfo',
    'emergency contact name and phone number': 'emergencyContactInfo',
    'emergencycontactnameandphonenumber': 'emergencyContactInfo',
    
    // Notes and comments
    notes: 'notes',
    comments: 'notes',
    'specific goals': 'notes', // Combine with other notes
    'specificgoals': 'notes',
    'any additional comments or requests': 'notes',
    'additionalcommentsorrequests': 'notes',
    
    // Pricing (optional - may not be in this CSV)
    priceperlesson: 'pricePerLesson',
    priceperpackage: 'pricePerPackage',
    
    // Address
    address: 'address',
    
    // Ignore these (agreement, referral, timestamp)
    timestamp: null, // Ignore
    'do you agree to the liability release & responsibility agreement': null,
    'how did you hear about us': null,
  };

  // Build a lookup map for fast column matching
  const csvColumns = {};
  Object.keys(row).forEach(key => {
    csvColumns[normalizeColumnName(key)] = key;
  });

  // Check for full name first (before individual first/last name)
  // Try to match various full name column patterns
  let fullNameFound = false;
  const fullNamePatterns = [
    // Exact matches (normalized)
    'fullname', 'full_name', 'name', 'studentname', 
    'studentsfullname', 'students full name',
    // Common variations
    'students name', 'student name', 'studentfullname',
    'full name', 'complete name', 'student full name'
  ];
  
  // Also check original column names directly for "full name" or "name" patterns
  for (const originalKey of Object.keys(row)) {
    const normalizedKey = normalizeColumnName(originalKey);
    // Check if it contains "name" and might be a full name column
    if (normalizedKey.includes('name') && 
        (normalizedKey.includes('full') || 
         normalizedKey.includes('student') ||
         normalizedKey === 'name' ||
         originalKey.toLowerCase().includes("'s"))) {
      const fullName = row[originalKey]?.trim();
      if (fullName && fullName.length > 0) {
        const { firstName, lastName } = splitFullName(fullName);
        if (firstName) {
          student.firstName = firstName;
          student.lastName = lastName || '';
          fullNameFound = true;
          break;
        }
      }
    }
  }
  
  // Fallback: try normalized pattern matching
  if (!fullNameFound) {
    for (const normalized of fullNamePatterns) {
      const csvKey = csvColumns[normalized];
      if (csvKey && row[csvKey]) {
        const fullName = row[csvKey].trim();
        if (fullName) {
          const { firstName, lastName } = splitFullName(fullName);
          if (firstName) {
            student.firstName = firstName;
            student.lastName = lastName || '';
            fullNameFound = true;
            break;
          }
        }
      }
    }
  }

  // Map other values (including first/last name if full name wasn't found)
  Object.entries(columnMap).forEach(([normalized, field]) => {
    // Skip null fields (ignored columns)
    if (field === null) {
      return;
    }
    
    // Skip fullName field and firstName/lastName if we already got them from fullName
    if (field === 'fullName' || (fullNameFound && (field === 'firstName' || field === 'lastName'))) {
      return;
    }

    const csvKey = csvColumns[normalized];
    if (csvKey && row[csvKey]) {
      const value = row[csvKey].trim();
      if (value && value.toLowerCase() !== 'n/a' && value.toLowerCase() !== 'na') {
        // Handle date fields
        if (field === 'dateOfBirth') {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            student[field] = date;
          }
        }
        // Handle numeric fields
        else if (field === 'pricePerLesson' || field === 'pricePerPackage') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            student[field] = num;
          }
        }
        // Handle notes field - append if multiple note fields exist
        else if (field === 'notes') {
          if (student.notes) {
            student.notes += '\n\n' + value;
          } else {
            student.notes = value;
          }
        }
        // Handle string fields (firstName, lastName, etc.)
        else {
          student[field] = value;
        }
      }
    }
  });

  return student;
}

// Main import function
async function importStudents(csvFilePath, userId = null) {
  try {
    console.log('📄 Reading CSV file:', csvFilePath);
    
    // Read CSV file
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`File not found: ${csvFilePath}`);
    }

    const content = fs.readFileSync(csvFilePath, 'utf-8');
    const { header, rows } = parseCSV(content);

    console.log(`📊 Found ${rows.length} rows in CSV`);
    console.log(`📋 Columns: ${header.join(', ')}`);
    console.log(`\n🔍 Detecting column types...`);
    
    // Show what we detected
    const sampleRow = rows[0] || {};
    const detectedFullName = Object.keys(sampleRow).find(key => {
      const normalized = normalizeColumnName(key);
      return normalized.includes('name') && 
             (normalized.includes('full') || normalized.includes('student') || normalized === 'name');
    });
    
    if (detectedFullName) {
      console.log(`   ✅ Detected full name column: "${detectedFullName}"`);
      console.log(`   📝 Sample: "${sampleRow[detectedFullName]}" → firstName: "${splitFullName(sampleRow[detectedFullName]).firstName}", lastName: "${splitFullName(sampleRow[detectedFullName]).lastName}"`);
    } else {
      console.log(`   ⚠️  No full name column detected. Looking for: firstName/lastName columns or name/fullName`);
    }
    
    // Debug: Show parent/guardian column detection
    const parentColumns = Object.keys(sampleRow).filter(key => {
      const normalized = normalizeColumnName(key);
      return normalized.includes('parent') || normalized.includes('guardian');
    });
    if (parentColumns.length > 0) {
      console.log(`   ✅ Detected parent/guardian columns: ${parentColumns.join(', ')}`);
      parentColumns.forEach(col => {
        const normalized = normalizeColumnName(col);
        const sampleValue = sampleRow[col] || '(empty)';
        console.log(`      - "${col}" → normalized: "${normalized}" → value: "${sampleValue}"`);
      });
    } else {
      console.log(`   ⚠️  No parent/guardian columns detected in CSV`);
    }
    console.log('');

    // Get userId if not provided
    if (!userId) {
      console.log('🔍 Finding first user in database...');
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        throw new Error('No users found in database. Please create a user first or provide userId.');
      }
      userId = firstUser.id;
      console.log(`✅ Using user: ${firstUser.email} (${firstUser.name})`);
    } else {
      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error(`User with id ${userId} not found`);
      }
      console.log(`✅ Using user: ${user.email} (${user.name})`);
    }

    // Process rows
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log('\n📝 Importing students...\n');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const studentData = mapRowToStudent(row, userId);

        // Validate required fields
        if (!studentData.firstName) {
          // Show which columns were found for debugging
          const availableColumns = Object.keys(row).filter(k => row[k]?.trim()).join(', ');
          throw new Error(`Missing required field: firstName. Available columns in this row: ${availableColumns || 'none'}`);
        }
        
        // lastName can be empty, but we'll use firstName as fallback if needed
        if (!studentData.lastName) {
          studentData.lastName = ''; // Allow empty lastName
        }

        // Check if student already exists (by email if available, or by name)
        let existingStudent = null;
        if (studentData.email) {
          existingStudent = await prisma.student.findFirst({
            where: {
              userId: userId,
              email: studentData.email
            }
          });
        }
        
        // If not found by email, try to find by firstName + lastName
        if (!existingStudent && studentData.firstName && studentData.lastName) {
          existingStudent = await prisma.student.findFirst({
            where: {
              userId: userId,
              firstName: studentData.firstName,
              lastName: studentData.lastName
            }
          });
        }

        let student;
        if (existingStudent) {
          // Update existing student
          student = await prisma.student.update({
            where: { id: existingStudent.id },
            data: studentData
          });
          successCount++;
          console.log(`🔄 [${i + 1}/${rows.length}] Updated: ${studentData.firstName} ${studentData.lastName}`);
        } else {
          // Create new student
          student = await prisma.student.create({
            data: studentData
          });
          successCount++;
          console.log(`✅ [${i + 1}/${rows.length}] Created: ${studentData.firstName} ${studentData.lastName}`);
        }
      } catch (error) {
        errorCount++;
        const errorMsg = `❌ [${i + 1}/${rows.length}] Error: ${error.message}`;
        console.error(errorMsg);
        errors.push({
          row: i + 1,
          data: row,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary:');
    console.log(`   ✅ Successfully processed: ${successCount} (created + updated)`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n💡 Note: Students are updated if they already exist (matched by email or name)');
    console.log('='.repeat(50));

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run script
const csvFilePath = process.argv[2];
const userId = process.argv[3] || null;

if (!csvFilePath) {
  console.error('Usage: node scripts/import-students.js <csv-file-path> [userId]');
  console.error('\nExample:');
  console.error('  node scripts/import-students.js students.csv');
  console.error('  node scripts/import-students.js students.csv "user-id-here"');
  process.exit(1);
}

importStudents(csvFilePath, userId);

