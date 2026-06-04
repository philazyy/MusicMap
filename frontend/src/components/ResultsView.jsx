import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Play, Pause, ExternalLink, ArrowRight, Share2, PlusCircle, Check, Loader2, Music } from 'lucide-react';

export default function ResultsView({ lobbyId, matchedTracks, matchRate, users, currentUser, onPlayAgain }) {
  const [exporting, setExporting] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [exportError, setExportError] = useState('');
  const [playingId, setPlayingId] = useState(null);
  
  const audioRef = React.useRef(new Audio());
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const token = localStorage.getItem('musicmap_token');

  const isHost = users.find(u => u.id === currentUser.userId)?.role === 'HOST';

  const handlePreview = (track) => {
    if (!track.previewUrl) return;

    if (playingId === track.id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      audioRef.current.pause();
      audioRef.current.src = track.previewUrl;
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setPlayingId(track.id))
        .catch(() => setPlayingId(null));
    }
  };

  React.useEffect(() => {
    return () => {
      audioRef.current.pause();
    };
  }, []);

  const handleExportPlaylist = async () => {
    if (!isHost) return;
    setExporting(true);
    setExportError('');

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/playlists/create`,
        { lobbyId },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (response.data?.success) {
        setPlaylistUrl(response.data.url);
      } else {
        setExportError('Failed to retrieve Spotify playlist URL.');
      }
    } catch (err) {
      console.error('Error exporting playlist:', err);
      setExportError(err.response?.data?.error || 'An error occurred during playlist creation.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-spotify/15 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-purple/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="p-1.5 bg-spotify rounded-lg text-dark-900 shadow-glow-spotify">
            <Music className="w-4 h-4" />
          </div>
          <span>Music<span className="text-spotify">Map</span></span>
        </div>
        <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          Room {lobbyId}
        </span>
      </header>

      {/* Main Results Container */}
      <main className="flex-1 flex flex-col justify-center items-center w-full max-w-2xl z-10 my-8">
        
        {/* Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-spotify/10 border border-spotify/20 text-spotify text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Consensus Level: {matchRate}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Your Common Vibe</h2>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            We found {matchedTracks.length} {matchedTracks.length === 1 ? 'song' : 'songs'} that matched your group's tastes!
          </p>
        </div>

        {/* Tracks List Card */}
        <div className="w-full glass-panel p-6 mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="font-bold text-sm text-white/50 tracking-wider uppercase">Match List</span>
            <span className="text-xs text-spotify font-semibold bg-spotify/5 px-2 py-0.5 border border-spotify/20 rounded-md">
              {matchedTracks.length} matched
            </span>
          </div>

          <div className="space-y-3.5 max-h-[35vh] overflow-y-auto pr-1">
            {matchedTracks.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <p className="mb-2 font-medium">No mutual likes this time.</p>
                <p className="text-xs">Try running another round with fresh selections!</p>
              </div>
            ) : (
              matchedTracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-3 bg-dark-900/40 border border-white/5 rounded-xl transition-all duration-300 hover:border-white/10"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Album Art */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group">
                      <img
                        src={track.albumArt}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      {track.previewUrl && (
                        <button
                          onClick={() => handlePreview(track)}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          {playingId === track.id ? (
                            <Pause className="w-4 h-4 fill-current text-spotify animate-pulse" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-white truncate pr-1" title={track.title}>
                        {track.title}
                      </span>
                      <span className="text-xs text-white/50 truncate" title={track.artist}>
                        {track.artist}
                      </span>
                    </div>
                  </div>

                  {/* Play on Spotify Link */}
                  <a
                    href={`https://open.spotify.com/track/${track.spotifyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-white/40 hover:text-spotify hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-all duration-200"
                    title="Open in Spotify"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full flex flex-col sm:flex-row gap-4 justify-center items-center">
          
          {/* Host Playlist Export Button */}
          {isHost ? (
            playlistUrl ? (
              <a
                href={playlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 bg-spotify hover:bg-spotify/95 text-dark-900 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-glow-spotify active:scale-95 transition-all duration-300"
              >
                {/* Spotify Logo Icon */}
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.075-.668-.135-.745-.47-.077-.337.135-.669.47-.746 3.855-.88 7.15-.51 9.822 1.13.295.178.387.563.206.86zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.08-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.66-1.11 8.224-.566 11.35 1.355.367.226.487.707.26 1.074zm.106-2.833C14.392 8.78 8.444 8.583 5.018 9.623c-.527.16-1.09-.14-1.25-.668-.16-.528.14-1.09.668-1.25 3.955-1.2 10.514-.975 14.59 1.444.475.283.63.896.347 1.37-.282.476-.897.63-1.37.348z" />
                </svg>
                <span>Open Spotify Playlist</span>
              </a>
            ) : (
              <div className="w-full sm:w-auto flex flex-col items-center gap-1.5">
                <button
                  onClick={handleExportPlaylist}
                  disabled={exporting || matchedTracks.length === 0}
                  className="w-full px-8 py-3.5 bg-spotify hover:bg-spotify/95 text-dark-900 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-glow-spotify active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Exporting Playlist...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-5 h-5" />
                      <span>Create Spotify Playlist</span>
                    </>
                  )}
                </button>
                {exportError && <span className="text-[10px] text-red-400 font-medium max-w-xs">{exportError}</span>}
              </div>
            )
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm font-medium text-white/60 text-center">
              {playlistUrl ? (
                <a
                  href={playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-spotify font-semibold hover:underline"
                >
                  <span>Open Host Playlist on Spotify</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span>Waiting for Host to export the playlist...</span>
              )}
            </div>
          )}

          {/* Play Another Round Button (Visible to all, but host triggers socket reset) */}
          <button
            onClick={onPlayAgain}
            className="w-full sm:w-auto px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition-all duration-300"
          >
            <span>Play Another Round</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center text-xs text-white/20">
        <p>MusicMap playlist exports are saved directly to your Spotify Library.</p>
      </footer>
    </div>
  );
}
