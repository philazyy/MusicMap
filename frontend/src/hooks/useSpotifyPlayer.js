import { useState, useEffect, useCallback } from 'react';
import {
  initSpotifyWebPlayer,
  playSpotifyTrack,
  pauseSpotifyPlayback,
  resumeSpotifyPlayback,
  activateSpotifyPlayer,
  cancelPendingPlayback,
  destroySpotifyWebPlayer,
  subscribePlayerState
} from '../lib/spotifyWebPlayer';

export default function useSpotifyPlayer(userId, enabled) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    if (!enabled || !userId) {
      destroySpotifyWebPlayer();
      setReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    initSpotifyWebPlayer(userId)
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setReady(false);
          setError(err.message || 'Spotify Player konnte nicht starten');
        }
      });

    const unsub = subscribePlayerState((state) => {
      if (state?.ready !== undefined) setReady(!!state.ready && !!state.deviceId);
      if (state?.error) setError(state.error);
      if (state?.playbackError) setError(state.playbackError);
      if (state?.paused !== undefined) setPaused(state.paused);
    });

    return () => {
      cancelled = true;
      unsub();
      destroySpotifyWebPlayer();
      setReady(false);
    };
  }, [userId, enabled]);

  const playTrack = useCallback(
    async (spotifyId) => {
      if (!userId || !spotifyId) return false;
      await activateSpotifyPlayer();
      const result = await playSpotifyTrack(userId, spotifyId);
      if (!result.ok) {
        setError(
          result.reason === 'api_error'
            ? 'Dieser Song ist bei Spotify gerade nicht abspielbar.'
            : 'Wiedergabe fehlgeschlagen — tippe auf Play.'
        );
        return false;
      }
      setError(null);
      setPaused(false);
      return true;
    },
    [userId]
  );

  const pause = useCallback(async () => {
    cancelPendingPlayback();
    await pauseSpotifyPlayback();
    setPaused(true);
  }, []);

  const resume = useCallback(async () => {
    await activateSpotifyPlayer();
    await resumeSpotifyPlayback();
    setPaused(false);
  }, []);

  const isPlaying = ready && !paused;

  return { ready, error, isPlaying, playTrack, pause, resume };
}
