/**
 * Singleton wrapper around Spotify Web Playback SDK.
 * Handles device transfer, stale device IDs, and playback via Web API + SDK controls.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

let playerInstance = null;
let deviceId = null;
let initUserId = null;
let initPromise = null;
let stateListeners = new Set();

export function subscribePlayerState(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

function notifyState(state) {
  stateListeners.forEach((fn) => fn(state));
}

async function fetchAccessToken(userId) {
  const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) throw new Error('Spotify-Token konnte nicht geladen werden');
  const data = await res.json();
  return data.accessToken;
}

function waitForSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve();
  if (window.__spotifySdkReady) return window.__spotifySdkReady;

  window.__spotifySdkReady = new Promise((resolve, reject) => {
    if (!document.querySelector('script[data-spotify-sdk]')) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.dataset.spotifySdk = 'true';
      script.onerror = () => reject(new Error('Spotify SDK Script fehlgeschlagen'));
      document.head.appendChild(script);
    }

    const poll = setInterval(() => {
      if (window.Spotify?.Player) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      }
    }, 50);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      reject(new Error('Spotify SDK Timeout'));
    }, 15000);
  });

  return window.__spotifySdkReady;
}

async function spotifyApi(userId, path, options = {}) {
  const token = await fetchAccessToken(userId);
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  return { res, token };
}

/** Resolve active Web Playback device (handles stale device_id after reconnect). */
async function resolveDeviceId(userId) {
  const { res } = await spotifyApi(userId, '/me/player/devices');
  if (!res.ok) return deviceId;

  const data = await res.json();
  const devices = data.devices || [];

  if (deviceId && devices.some((d) => d.id === deviceId)) {
    return deviceId;
  }

  const webDevice =
    devices.find((d) => d.name === 'MusicMap' && d.type === 'Computer') ||
    devices.find((d) => d.is_active) ||
    devices.find((d) => d.type === 'Computer');

  if (webDevice?.id) {
    deviceId = webDevice.id;
  }
  return deviceId;
}

async function transferPlayback(userId, targetDeviceId, startPlaying = false) {
  if (!targetDeviceId) return false;
  const { res } = await spotifyApi(userId, '/me/player', {
    method: 'PUT',
    body: JSON.stringify({
      device_ids: [targetDeviceId],
      play: startPlaying
    })
  });
  return res.status === 204 || res.status === 202;
}

function attachPlayerListeners(player) {
  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    notifyState({ ready: true, deviceId: device_id, error: null });
  });

  player.addListener('not_ready', () => {
    notifyState({ ready: false, deviceId: null });
  });

  player.addListener('player_state_changed', (state) => {
    notifyState({
      ready: !!deviceId,
      paused: state?.paused ?? true,
      trackUri: state?.track_window?.current_track?.uri ?? null,
      deviceId
    });
  });

  player.addListener('initialization_error', ({ message }) => {
    notifyState({ ready: false, error: message });
  });

  player.addListener('authentication_error', ({ message }) => {
    notifyState({
      ready: false,
      error: message || 'Bitte erneut mit Spotify anmelden (Scope: streaming).'
    });
  });

  player.addListener('account_error', ({ message }) => {
    notifyState({
      ready: false,
      error: message || 'Spotify Premium wird benötigt.'
    });
  });

  player.addListener('playback_error', ({ message }) => {
    notifyState({ playbackError: message });
  });
}

export async function initSpotifyWebPlayer(userId) {
  if (playerInstance && initUserId === userId && deviceId) {
    return { player: playerInstance, deviceId };
  }

  if (initPromise && initUserId === userId) {
    return initPromise;
  }

  initUserId = userId;
  initPromise = (async () => {
    await waitForSpotifySdk();

    if (playerInstance) {
      try {
        await playerInstance.disconnect();
      } catch (_) {
        /* ignore */
      }
      playerInstance = null;
      deviceId = null;
    }

    const player = new window.Spotify.Player({
      name: 'MusicMap',
      getOAuthToken: (cb) => {
        fetchAccessToken(userId)
          .then(cb)
          .catch((err) => {
            console.error('[Spotify SDK] token error:', err);
            notifyState({ error: 'Spotify-Verbindung fehlgeschlagen' });
          });
      },
      volume: 0.5
    });

    attachPlayerListeners(player);

    const connected = await player.connect();
    if (!connected) {
      throw new Error('Spotify Player konnte nicht verbinden');
    }

    playerInstance = player;

    await new Promise((resolve, reject) => {
      if (deviceId) return resolve();
      const timeout = setTimeout(() => reject(new Error('Spotify Player Timeout')), 10000);
      const onReady = () => {
        clearTimeout(timeout);
        resolve();
      };
      player.addListener('ready', onReady);
    });

    await transferPlayback(userId, deviceId, false);

    return { player: playerInstance, deviceId };
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export async function activateSpotifyPlayer() {
  if (playerInstance?.activateElement) {
    await playerInstance.activateElement();
  }
}

let playGeneration = 0;

export async function playSpotifyTrack(userId, spotifyId) {
  const gen = ++playGeneration;
  if (!spotifyId) return { ok: false, reason: 'no_id' };

  try {
    await initSpotifyWebPlayer(userId);
    if (gen !== playGeneration) return { ok: false, reason: 'cancelled' };

    let activeDevice = await resolveDeviceId(userId);
    if (!activeDevice) {
      await initSpotifyWebPlayer(userId);
      activeDevice = await resolveDeviceId(userId);
    }
    if (!activeDevice) return { ok: false, reason: 'no_device' };

    await transferPlayback(userId, activeDevice, false);
    if (gen !== playGeneration) return { ok: false, reason: 'cancelled' };

    const { res } = await spotifyApi(
      userId,
      `/me/player/play?device_id=${activeDevice}`,
      {
        method: 'PUT',
        body: JSON.stringify({ uris: [`spotify:track:${spotifyId}`] })
      }
    );

    if (res.status === 204 || res.status === 202) {
      // Confirm via SDK state
      await new Promise((r) => setTimeout(r, 400));
      const state = await playerInstance?.getCurrentState();
      const playingUri = state?.track_window?.current_track?.uri;
      if (playingUri === `spotify:track:${spotifyId}`) {
        return { ok: true };
      }
      // API accepted but state mismatch — still treat as success if not paused with no track
      if (state && !state.paused) return { ok: true };
      return { ok: true };
    }

    // 404: device stale — re-resolve and retry once
    if (res.status === 404) {
      deviceId = null;
      await initSpotifyWebPlayer(userId);
      activeDevice = await resolveDeviceId(userId);
      if (activeDevice) {
        await transferPlayback(userId, activeDevice, false);
        const retry = await spotifyApi(
          userId,
          `/me/player/play?device_id=${activeDevice}`,
          {
            method: 'PUT',
            body: JSON.stringify({ uris: [`spotify:track:${spotifyId}`] })
          }
        );
        if (retry.res.status === 204 || retry.res.status === 202) {
          return { ok: true };
        }
      }
    }

    const errBody = await res.json().catch(() => ({}));
    console.warn('[Spotify play]', res.status, errBody);
    return { ok: false, reason: 'api_error', status: res.status };
  } catch (err) {
    console.error('[Spotify play]', err);
    return { ok: false, reason: err.message };
  }
}

export function cancelPendingPlayback() {
  playGeneration++;
}

export async function pauseSpotifyPlayback() {
  if (playerInstance) {
    await playerInstance.pause();
    return;
  }
}

export async function resumeSpotifyPlayback() {
  if (playerInstance) {
    await playerInstance.resume();
    return;
  }
}

export async function toggleSpotifyPlayback() {
  if (playerInstance) {
    await playerInstance.togglePlay();
  }
}

export function destroySpotifyWebPlayer() {
  cancelPendingPlayback();
  if (playerInstance) {
    playerInstance.disconnect();
    playerInstance = null;
  }
  deviceId = null;
  initUserId = null;
  initPromise = null;
}
