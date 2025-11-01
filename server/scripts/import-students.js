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

// Simple CSV parser (no external dependencies)
function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length !== header.length) continue; // Skip malformed rows
    
    const row = {};
    header.forEach((col, index) => {
      row[col] = values[index] || null;
    });
    rows.push(row);
  }

  return { header, rows };
}

// Normalize column names (case-insensitive, handles spaces/underscores)
function normalizeColumnName(colName) {
  return colName.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
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
    firstname: 'firstName',
    lastname: 'lastName',
    email: 'email',
    phone: 'phone',
    dateofbirth: 'dateOfBirth',
    dob: 'dateOfBirth',
    address: 'address',
    schoolname: 'schoolName',
    school: 'schoolName',
    grade: 'grade',
    subject: 'subject',
    difficulties: 'difficulties',
    priceperlesson: 'pricePerLesson',
    priceperpackage: 'pricePerPackage',
    parentfullname: 'parentFullName',
    parentname: 'parentFullName',
    parentemail: 'parentEmail',
    parentphone: 'parentPhone',
    parentaddress: 'parentAddress',
    emergencycontactinfo: 'emergencyContactInfo',
    emergencycontact: 'emergencyContactInfo',
    notes: 'notes',
  };

  // Build a lookup map for fast column matching
  const csvColumns = {};
  Object.keys(row).forEach(key => {
    csvColumns[normalizeColumnName(key)] = key;
  });

  // Map values
  Object.entries(columnMap).forEach(([normalized, field]) => {
    const csvKey = csvColumns[normalized];
    if (csvKey && row[csvKey]) {
      const value = row[csvKey].trim();
      if (value) {
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
        // Handle string fields
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
        if (!studentData.firstName || !studentData.lastName) {
          throw new Error('Missing required fields: firstName or lastName');
        }

        // Create student
        const student = await prisma.student.create({
          data: studentData
        });

        successCount++;
        console.log(`✅ [${i + 1}/${rows.length}] Created: ${studentData.firstName} ${studentData.lastName}`);
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
    console.log(`   ✅ Successfully imported: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
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

