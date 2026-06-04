const prisma = require('../db');
const { refreshAccessToken } = require('./spotify');

/**
 * Retrieve a valid Spotify access token for a user.
 * If the token is expired or expiring in under 2 minutes, it will be automatically refreshed.
 */
async function getValidToken(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();
  const isExpiring = user.tokenExpiresAt <= new Date(now.getTime() + 120 * 1000);

  if (isExpiring) {
    if (!user.refreshToken) {
      throw new Error('No refresh token available for user');
    }

    try {
      console.log(`Token expiring for user ${userId}. Refreshing...`);
      const refreshData = await refreshAccessToken(user.refreshToken);
      const updatedExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          accessToken: refreshData.access_token,
          refreshToken: refreshData.refresh_token || user.refreshToken,
          tokenExpiresAt: updatedExpiresAt
        }
      });

      return updatedUser.accessToken;
    } catch (err) {
      console.error(`Failed to silently refresh token for user ${userId}:`, err.response?.data || err.message);
      throw new Error('Spotify token refresh failed');
    }
  }

  return user.accessToken;
}

module.exports = { getValidToken };
