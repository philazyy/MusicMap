const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { getAuthUrl, exchangeCode, getUserProfile, refreshAccessToken } = require('../utils/spotify');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_musicmap_key_change_me';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * GET /api/auth/login
 * Redirects user to the Spotify authorization screen.
 */
router.get('/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  const authUrl = getAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /api/auth/callback
 * Handles Spotify's OAuth callback.
 * Exchanges authorization code for access token, gets profile, upserts user in database, signs JWT, and redirects to client.
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    console.error('Spotify login error callback:', error);
    return res.redirect(`${CLIENT_URL}?error=spotify_auth_failed`);
  }

  try {
    // 1. Exchange code for tokens
    const tokenData = await exchangeCode(code);
    const { access_token, refresh_token, expires_in } = tokenData;

    // 2. Fetch user profile from Spotify
    const profile = await getUserProfile(access_token);

    // 3. Upsert user in SQLite database
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    const user = await prisma.user.upsert({
      where: { id: profile.id },
      update: {
        displayName: profile.displayName,
        profileImage: profile.profileImage,
        isPremium: profile.isPremium,
        accessToken: access_token,
        refreshToken: refresh_token || undefined, // refresh_token might not be sent on subsequent logins unless requested or force-dialog
        tokenExpiresAt
      },
      create: {
        id: profile.id,
        displayName: profile.displayName,
        profileImage: profile.profileImage,
        isPremium: profile.isPremium,
        accessToken: access_token,
        refreshToken: refresh_token || '',
        tokenExpiresAt
      }
    });

    // 4. Generate local JWT
    const jwtToken = jwt.sign(
      { userId: user.id, displayName: user.displayName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Redirect back to React frontend with parameters
    const redirectUrl = `${CLIENT_URL}/auth-callback?` +
      `token=${jwtToken}&` +
      `userId=${user.id}&` +
      `displayName=${encodeURIComponent(user.displayName)}&` +
      `profileImage=${encodeURIComponent(user.profileImage || '')}&` +
      `isPremium=${user.isPremium ? '1' : '0'}`;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Error during Spotify OAuth callback processing:', err.response?.data || err.message);
    res.redirect(`${CLIENT_URL}?error=server_error`);
  }
});

/**
 * POST /api/auth/refresh
 * Refreshes the local user session.
 */
router.post('/refresh', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If token is still valid (with a 2-minute buffer), return existing token
    const isBufferValid = new Date(Date.now() + 120 * 1000) < user.tokenExpiresAt;
    if (isBufferValid) {
      return res.json({ accessToken: user.accessToken });
    }

    if (!user.refreshToken) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    // Refresh from Spotify
    const refreshData = await refreshAccessToken(user.refreshToken);
    const updatedExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || user.refreshToken, // Spotify might send a new one or keep the old one
        tokenExpiresAt: updatedExpiresAt
      }
    });

    res.json({ accessToken: updatedUser.accessToken });
  } catch (err) {
    console.error('Failed to refresh access token:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
