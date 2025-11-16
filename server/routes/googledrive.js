import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../prisma/client.js';
import { getGoogleAuthUrl, getTokensFromCode } from '../utils/googleDrive.js';

const router = express.Router();

// Get Google OAuth URL (requires authentication)
router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        message: 'Google Drive integration not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' 
      });
    }

    // Include user ID in state for callback
    const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
    const authUrl = getGoogleAuthUrl(state);
    res.json({ authUrl });
  } catch (error) {
    console.error('Get Google auth URL error:', error);
    res.status(500).json({ message: 'Error generating Google auth URL' });
  }
});

// Handle OAuth callback (no authentication required - called by Google)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code not provided' });
    }

    // Decode state to get user ID
    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
    } catch (e) {
      console.error('Error parsing state:', e);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/account?googleDriveError=invalid_state`);
    }

    if (!userId) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/account?googleDriveError=no_user_id`);
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Update user with tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleDriveAccessToken: tokens.access_token,
        googleDriveRefreshToken: tokens.refresh_token,
        googleDriveTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        fileStorageType: 'googleDrive',
      }
    });

    // Redirect to frontend with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/account?googleDriveConnected=true`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/account?googleDriveError=true`);
  }
});

// Disconnect Google Drive (requires authentication)
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fileStorageType: 'local',
        googleDriveAccessToken: null,
        googleDriveRefreshToken: null,
        googleDriveTokenExpiry: null,
        googleDriveFolderId: null,
      }
    });

    res.json({ message: 'Google Drive disconnected successfully' });
  } catch (error) {
    console.error('Disconnect Google Drive error:', error);
    res.status(500).json({ message: 'Error disconnecting Google Drive' });
  }
});

// Test Google Drive connection (requires authentication)
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const { getDriveClient } = await import('../utils/googleDrive.js');
    const drive = await getDriveClient(req.user.id);
    
    // Try to list files to test connection
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)',
    });

    res.json({ 
      connected: true, 
      message: 'Google Drive connection successful',
      fileCount: response.data.files?.length || 0
    });
  } catch (error) {
    console.error('Test Google Drive connection error:', error);
    res.status(500).json({ 
      connected: false,
      message: error.message || 'Error testing Google Drive connection' 
    });
  }
});

export default router;

