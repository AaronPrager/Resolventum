import { google } from 'googleapis';
import prisma from '../prisma/client.js';
import { Readable } from 'stream';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5002'}/api/googledrive/callback`
);

/**
 * Get Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state = null) {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file', // Access to files created by the app
  ];

  const authUrlOptions = {
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
  };

  if (state) {
    authUrlOptions.state = state;
  }

  return oauth2Client.generateAuthUrl(authUrlOptions);
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get authenticated Google Drive client for a user
 */
export async function getDriveClient(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleDriveAccessToken: true,
      googleDriveRefreshToken: true,
      googleDriveTokenExpiry: true,
    }
  });

  if (!user || !user.googleDriveAccessToken) {
    throw new Error('Google Drive not connected');
  }

  // Set credentials
  oauth2Client.setCredentials({
    access_token: user.googleDriveAccessToken,
    refresh_token: user.googleDriveRefreshToken,
  });

  // Check if token is expired and refresh if needed
  if (user.googleDriveTokenExpiry && new Date(user.googleDriveTokenExpiry) <= new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update tokens in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleDriveAccessToken: credentials.access_token,
        googleDriveRefreshToken: credentials.refresh_token || user.googleDriveRefreshToken,
        googleDriveTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      }
    });

    oauth2Client.setCredentials(credentials);
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Upload file to Google Drive
 */
export async function uploadFileToDrive(userId, fileBuffer, fileName, mimeType, folderId = null) {
  const drive = await getDriveClient(userId);
  
  // Use user's specified folder or root
  const parentFolderId = folderId || 'root';
  
  const fileMetadata = {
    name: fileName,
    parents: [parentFolderId],
  };

  // Convert Buffer to Stream (Google Drive API requires a stream)
  const fileStream = Readable.from(fileBuffer);

  const media = {
    mimeType: mimeType,
    body: fileStream,
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink',
  });

  return {
    fileId: file.data.id,
    fileName: file.data.name,
    webViewLink: file.data.webViewLink,
    webContentLink: file.data.webContentLink,
  };
}

/**
 * Create a folder in Google Drive
 */
export async function createFolderInDrive(userId, folderName, parentFolderId = null) {
  const drive = await getDriveClient(userId);
  
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentFolderId ? [parentFolderId] : ['root'],
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name',
  });

  return {
    folderId: folder.data.id,
    folderName: folder.data.name,
  };
}

/**
 * Get or create the "Lessons" folder
 */
export async function getOrCreateLessonsFolder(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveFolderId: true }
  });

  const drive = await getDriveClient(userId);
  const baseFolderId = user?.googleDriveFolderId || 'root';
  const folderName = 'Lessons';

  // Check if "Lessons" folder already exists
  const response = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${baseFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return {
      folderId: response.data.files[0].id,
      folderName: response.data.files[0].name,
    };
  }

  // Create "Lessons" folder
  return await createFolderInDrive(userId, folderName, baseFolderId);
}

/**
 * Get or create a folder for a specific student under Lessons/<Student Name>/
 */
export async function getOrCreateStudentFolder(userId, studentName) {
  // First get or create the "Lessons" folder
  const lessonsFolder = await getOrCreateLessonsFolder(userId);
  
  const drive = await getDriveClient(userId);
  
  // Sanitize student name for folder name (remove invalid characters)
  const sanitizedName = studentName.replace(/[<>:"/\\|?*]/g, '_').trim();
  
  // Check if student folder already exists
  const response = await drive.files.list({
    q: `name='${sanitizedName}' and mimeType='application/vnd.google-apps.folder' and '${lessonsFolder.folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return {
      folderId: response.data.files[0].id,
      folderName: response.data.files[0].name,
    };
  }

  // Create student folder under Lessons
  return await createFolderInDrive(userId, sanitizedName, lessonsFolder.folderId);
}

/**
 * Get or create the "Purchases" folder in Google Drive
 */
export async function getOrCreatePurchasesFolder(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveFolderId: true }
  });

  const drive = await getDriveClient(userId);
  const baseFolderId = user?.googleDriveFolderId || 'root';
  const folderName = 'Purchases';
  
  // Check if Purchases folder already exists
  const response = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${baseFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return {
      folderId: response.data.files[0].id,
      folderName: response.data.files[0].name,
    };
  }

  // Create Purchases folder
  return await createFolderInDrive(userId, folderName, baseFolderId);
}

/**
 * Delete file from Google Drive
 */
export async function deleteFileFromDrive(userId, fileId) {
  const drive = await getDriveClient(userId);
  
  await drive.files.delete({
    fileId: fileId,
  });
  
  return true;
}

