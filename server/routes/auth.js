import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../prisma/client.js';
import { sendEmail, isEmailConfigured } from '../utils/emailService.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, companyName, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists (including deleted accounts)
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      // If user exists but is deleted, still prevent registration
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create verification token
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        companyName: companyName || null,
        phone: phone || null,
        verified: false,
        verificationToken,
        verificationTokenExpires
      },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        phone: true,
        verified: true,
        createdAt: true
      }
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send email notification to resolventum@gmail.com about new user registration
    try {
      if (isEmailConfigured()) {
        const emailSubject = 'New User Registration - Resolventum';
        const emailText = `A new user has registered on Resolventum:

Name: ${name}
Email: ${email}
Company Name: ${companyName || 'Not provided'}
Phone: ${phone || 'Not provided'}
Registration Date: ${new Date().toLocaleString()}

User ID: ${user.id}`;

        const emailHtml = `
          <h2>New User Registration</h2>
          <p>A new user has registered on Resolventum:</p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Company Name:</strong> ${companyName || 'Not provided'}</li>
            <li><strong>Phone:</strong> ${phone || 'Not provided'}</li>
            <li><strong>Registration Date:</strong> ${new Date().toLocaleString()}</li>
            <li><strong>User ID:</strong> ${user.id}</li>
          </ul>
        `;

        await sendEmail({
          to: 'resolventum@gmail.com',
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        });
        console.log('Registration notification email sent to resolventum@gmail.com');
      } else {
        console.log('Email service not configured - skipping registration notification');
      }
    } catch (emailError) {
      // Log error but don't fail registration if email fails
      console.error('Failed to send registration notification email:', emailError);
    }

    res.status(201).json({ user, token, verification: { token: verificationToken } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is deleted
    if (user.deleted) {
      return res.status(403).json({ message: 'This account has been deleted and login is disabled' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.companyName,
        phone: user.phone,
        verified: user.verified
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Verify email
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Token required' });
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) return res.status(400).json({ message: 'Invalid token' });
    if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
      return res.status(400).json({ message: 'Token expired' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { verified: true, verificationToken: null, verificationTokenExpires: null }
    });
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// Change password (authenticated)
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null
    if (!token) return res.status(401).json({ message: 'Unauthorized' })
    let payload
    try { payload = jwt.verify(token, process.env.JWT_SECRET) } catch { return res.status(401).json({ message: 'Unauthorized' }) }
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' })
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return res.status(404).json({ message: 'User not found' })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Failed to change password' })
  }
})

export default router;

