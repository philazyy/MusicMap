const axios = require('axios');
const querystring = require('querystring');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

/**
 * Generate authorization URL for Spotify login
 */
function getAuthUrl(state) {
  const scopes = [
    'user-top-read',
    'user-read-private',
    'user-modify-playback-state',
    'streaming',
    'playlist-modify-public',
    'playlist-modify-private'
  ].join(' ');

  return 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scopes,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state: state,
      show_dialog: true
    });
}

/**
 * Exchange Authorization Code for Access & Refresh Tokens
 */
async function exchangeCode(code) {
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    data: querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    }
  });

  return response.data;
}

/**
 * Refresh Access Token using Refresh Token
 */
async function refreshAccessToken(refreshToken) {
  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const response = await axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    data: querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`
    }
  });

  return response.data;
}

/**
 * Get User Profile (Spotify User ID, Display Name, Profile Image URL)
 */
async function getUserProfile(accessToken) {
  const response = await axios({
    method: 'get',
    url: 'https://api.spotify.com/v1/me',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const { id, display_name, images, product } = response.data;
  return {
    id,
    displayName: display_name || id,
    profileImage: images && images.length > 0 ? images[0].url : null,
    isPremium: product === 'premium'
  };
}

/**
 * Check whether the user has an active Spotify Premium subscription.
 */
async function getUserPremiumStatus(accessToken) {
  const profile = await getUserProfile(accessToken);
  return profile.isPremium;
}

/**
 * Batch-check which track IDs are playable in the user's market (Premium streaming).
 */
async function getPlayableTrackIds(accessToken, trackIds) {
  const playable = new Set();
  const unique = [...new Set(trackIds.filter(Boolean))];

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/tracks',
      params: { ids: chunk.join(',') },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    for (const track of response.data.tracks || []) {
      if (track?.id && track.is_playable) {
        playable.add(track.id);
      }
    }
  }

  return playable;
}

/**
 * Get User's Top Tracks (default: limit 50, medium_term)
 */
async function getUserTopTracks(accessToken, limit = 50) {
  const response = await axios({
    method: 'get',
    url: 'https://api.spotify.com/v1/me/top/tracks',
    params: {
      limit,
      time_range: 'medium_term'
    },
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return response.data.items.map(track => ({
    spotifyId: track.id,
    title: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    albumArt: track.album.images && track.album.images.length > 0 ? track.album.images[0].url : '',
    previewUrl: track.preview_url // Note: Spotify returns null for some tracks depending on region/markets. We handle null preview urls.
  }));
}

/**
 * Create Spotify Playlist for User
 */
async function createPlaylist(accessToken, spotifyUserId, name, description) {
  const response = await axios({
    method: 'post',
    url: `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
    data: {
      name,
      description,
      public: false // Default to private collaborative
    },
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

/**
 * Add Tracks to a Spotify Playlist
 */
async function addTracksToPlaylist(accessToken, playlistId, trackIds) {
  // Spotify requires URIs in the format spotify:track:<id>
  const uris = trackIds.map(id => `spotify:track:${id}`);

  // Spotify restricts adding more than 100 tracks per request. We cap at 100.
  const slicedUris = uris.slice(0, 100);

  const response = await axios({
    method: 'post',
    url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    data: {
      uris: slicedUris
    },
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getUserProfile,
  getUserPremiumStatus,
  getPlayableTrackIds,
  getUserTopTracks,
  createPlaylist,
  addTracksToPlaylist
};
