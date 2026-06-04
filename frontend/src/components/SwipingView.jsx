import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { Heart, X, Play, Pause, VolumeX, Loader2, Music4, Award } from 'lucide-react';
import useSpotifyPlayer from '../hooks/useSpotifyPlayer';

export default function SwipingView({ lobbyId, playbackMode, tracks, users, currentUser, onSwipe }) {
  const isPremiumMode = playbackMode === 'PREMIUM';
  const {
    ready: spotifyReady,
    error: spotifyError,
    isPlaying: spotifyIsPlaying,
    playTrack: playSpotifyTrack,
    pause: pauseSpotify,
    resume: resumeSpotify
  } = useSpotifyPlayer(currentUser.userId, isPremiumMode);
  const [isSwiping, setIsSwiping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [usingPreviewFallback, setUsingPreviewFallback] = useState(false);
  
  const audioRef = useRef(new Audio());
  const controls = useAnimation();
  
  // Motion values for swipe gesture
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.3, 1, 1, 1, 0.3]);
  const heartScale = useTransform(x, [0, 150], [0, 1.2]);
  const xScale = useTransform(x, [-150, 0], [1.2, 0]);

  const activeTrack = tracks[activeIndex];

  const playPreviewAudio = (previewUrl) => {
    if (!previewUrl) {
      setAudioError(true);
      setIsPlaying(false);
      return;
    }
    audioRef.current.src = previewUrl;
    audioRef.current.load();
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setAudioError(false);
      })
      .catch(() => setIsPlaying(false));
  };

  // Configure and handle audio playback when the active track changes
  useEffect(() => {
    audioRef.current.pause();
    if (isPremiumMode) pauseSpotify();
    setIsPlaying(false);
    setAudioError(false);
    setUsingPreviewFallback(false);

    if (!activeTrack) return;

    if (isPremiumMode) {
      if (!spotifyReady) return;

      let cancelled = false;
      playSpotifyTrack(activeTrack.spotifyId).then((ok) => {
        if (cancelled) return;
        if (ok) {
          setUsingPreviewFallback(false);
          setIsPlaying(true);
          setAudioError(false);
        } else if (activeTrack.previewUrl) {
          setUsingPreviewFallback(true);
          playPreviewAudio(activeTrack.previewUrl);
        } else {
          setAudioError(true);
        }
      });

      return () => {
        cancelled = true;
        audioRef.current.pause();
        pauseSpotify();
      };
    }

    if (activeTrack.previewUrl) {
      playPreviewAudio(activeTrack.previewUrl);
    } else {
      setAudioError(true);
    }

    return () => {
      audioRef.current.pause();
    };
  }, [activeIndex, activeTrack?.id, isPremiumMode, spotifyReady, playSpotifyTrack, pauseSpotify]);

  // Sync UI with SDK player state when not on preview fallback
  useEffect(() => {
    if (isPremiumMode && !usingPreviewFallback) {
      setIsPlaying(spotifyIsPlaying);
    }
  }, [spotifyIsPlaying, isPremiumMode, usingPreviewFallback]);

  // Sync volume state and loop state
  useEffect(() => {
    audioRef.current.volume = 0.5;
    audioRef.current.loop = true; // Loop the 30 seconds so they can listen as long as they want
  }, []);

  const canPlay = isPremiumMode
    ? (spotifyReady && activeTrack?.spotifyId) || activeTrack?.previewUrl
    : activeTrack?.previewUrl && !audioError;

  const togglePlay = () => {
    if (!canPlay) return;

    if (isPremiumMode) {
      if (usingPreviewFallback) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          playPreviewAudio(activeTrack.previewUrl);
        }
        return;
      }
      if (isPlaying) {
        pauseSpotify();
        setIsPlaying(false);
      } else {
        resumeSpotify();
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Trigger swiping animation and record swipe vote
  const triggerSwipe = async (direction) => {
    if (activeIndex >= tracks.length || isSwiping) return;
    
    setIsSwiping(true);

    audioRef.current.pause();
    if (isPremiumMode) pauseSpotify();
    setIsPlaying(false);

    const liked = direction === 'right';
    const swipeX = liked ? 400 : -400;

    // Submit swipe state to server
    onSwipe(activeTrack.id, liked);

    // Animate the card out
    await controls.start({
      x: swipeX,
      opacity: 0,
      rotate: liked ? 35 : -35,
      transition: { duration: 0.35, ease: 'easeOut' }
    });

    // Reset motion values for next card and advance
    x.set(0);
    setActiveIndex(prev => prev + 1);
    setIsSwiping(false);
  };

  // Handle Framer Motion Drag Ending
  const handleDragEnd = (event, info) => {
    if (isSwiping) return;
    const swipeThreshold = 120;
    if (info.offset.x > swipeThreshold) {
      triggerSwipe('right');
    } else if (info.offset.x < -swipeThreshold) {
      triggerSwipe('left');
    } else {
      // Bounce back to center
      controls.start({ x: 0, rotate: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  // Render when user has swiped all 20 cards
  if (activeIndex >= tracks.length) {
    const finishedCount = users.filter(u => u.isFinished).length;
    
    return (
      <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 overflow-hidden">
        {/* Decorative ambient glows */}
        <div className="absolute top-[20%] left-[20%] w-[45%] h-[45%] rounded-full bg-spotify/10 blur-[100px] pointer-events-none animate-pulse-slow"></div>
        <div className="absolute bottom-[20%] right-[20%] w-[45%] h-[45%] rounded-full bg-accent-purple/10 blur-[100px] pointer-events-none animate-pulse-slow"></div>

        <header className="w-full max-w-md flex justify-between items-center z-10">
          <span className="text-sm font-semibold tracking-wider text-white/30 uppercase">Lobby: {lobbyId}</span>
          <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-3 py-1 rounded-full">Completed</span>
        </header>

        <main className="flex-1 flex flex-col justify-center items-center w-full max-w-md z-10 my-8">
          <div className="glass-panel p-8 text-center w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-spotify to-accent-purple animate-pulse"></div>

            <div className="p-4 bg-spotify/10 text-spotify rounded-full border border-spotify/20 w-fit mx-auto mb-6">
              <Award className="w-10 h-10 animate-bounce" />
            </div>

            <h2 className="text-2xl font-bold mb-2">Round Finished!</h2>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              You've swiped all {tracks.length} songs. Now waiting for your friends to lock in their preferences.
            </p>

            {/* Progress indicator */}
            <div className="w-full bg-dark-900/60 rounded-full h-2.5 mb-6 overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-spotify to-accent-cyan h-full rounded-full transition-all duration-500"
                style={{ width: `${(finishedCount / users.length) * 100}%` }}
              ></div>
            </div>

            <div className="text-sm font-medium mb-4 text-white/40 uppercase tracking-widest text-left">
              Player Progress ({finishedCount}/{users.length})
            </div>

            {/* Room sync status list */}
            <div className="space-y-3 max-h-[25vh] overflow-y-auto pr-1">
              {users.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-dark-900/40 border border-white/5 rounded-xl text-left"
                >
                  <div className="flex items-center gap-3">
                    {member.profileImage ? (
                      <img
                        src={member.profileImage}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent-purple/20 text-accent-purple border border-white/10 flex items-center justify-center font-bold text-xs uppercase">
                        {member.displayName.substring(0, 2)}
                      </div>
                    )}
                    <span className="font-semibold text-xs truncate max-w-[120px]">{member.displayName}</span>
                  </div>

                  <div>
                    {member.isFinished ? (
                      <span className="text-[10px] bg-spotify/15 text-spotify border border-spotify/25 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Finished
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] text-white/40 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-bold uppercase tracking-wider">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Swiping...</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="w-full max-w-md text-center text-xs text-white/20">
          <p>Once everyone finishes swiping, results will load instantly.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-6 overflow-hidden">
      {/* Decorative ambient glows */}
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-pink/5 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-spotify/5 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Header */}
      <header className="w-full max-w-md flex justify-between items-center z-10">
        <div className="flex flex-col">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Lobby Code</span>
          <span className="text-sm font-mono font-bold text-spotify">{lobbyId}</span>
        </div>

        {/* Progress Tracker */}
        <div className="text-right">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block">Progress</span>
          <span className="text-sm font-bold">
            <span className="text-spotify font-extrabold">{activeIndex + 1}</span> / {tracks.length}
          </span>
        </div>
      </header>

      {(spotifyError && isPremiumMode) && (
        <p className="text-xs text-red-300 bg-red-950/40 border border-red-500/30 px-3 py-2 rounded-lg max-w-sm text-center z-20 mb-2">
          {spotifyError}
        </p>
      )}

      {/* Main swiping section */}
      <main className="flex-1 flex items-center justify-center w-full max-w-sm z-10 my-4 relative">
        
        {/* Tinder Stack */}
        <div className="card-container relative w-full h-[60vh] max-h-[500px]">
          {tracks.map((track, index) => {
            // Only render current active card and next card underneath for optimal performance
            if (index < activeIndex || index > activeIndex + 1) return null;
            
            const isActive = index === activeIndex;

            return (
              <motion.div
                key={track.id}
                style={isActive ? { x, rotate, opacity } : { scale: 0.95, y: 15, opacity: 0.6 }}
                animate={isActive ? controls : {}}
                drag={isActive ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={isActive ? handleDragEnd : undefined}
                className={`absolute inset-0 rounded-3xl overflow-hidden glass-panel border border-white/15 bg-dark-800 shadow-2xl flex flex-col justify-between ${
                  isActive ? 'z-20 cursor-grab active:cursor-grabbing' : 'z-10'
                }`}
              >
                {/* Visual Indicators Overlay (Like/Dislike) */}
                {isActive && (
                  <>
                    <motion.div
                      style={{ scale: heartScale }}
                      className="absolute top-6 left-6 p-4 rounded-full bg-spotify text-dark-900 border border-white/20 z-30 shadow-glow-spotify pointer-events-none"
                    >
                      <Heart className="w-8 h-8 fill-current" />
                    </motion.div>
                    <motion.div
                      style={{ scale: xScale }}
                      className="absolute top-6 right-6 p-4 rounded-full bg-accent-pink text-white border border-white/20 z-30 shadow-glow-pink pointer-events-none"
                    >
                      <X className="w-8 h-8" />
                    </motion.div>
                  </>
                )}

                {/* Album Cover Art */}
                <div className="relative w-full aspect-square bg-dark-900 overflow-hidden shrink-0 select-none">
                  {track.albumArt ? (
                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-dark-900 text-white/20">
                      <Music4 className="w-20 h-20" />
                    </div>
                  )}

                  {/* Gradient cover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-800 via-transparent to-transparent"></div>

                  {/* Audio Controls Overlay */}
                  {isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      disabled={
                        isPremiumMode
                          ? !spotifyReady || audioError
                          : !track.previewUrl || audioError
                      }
                      className="absolute bottom-4 right-4 p-3.5 bg-dark-900/80 hover:bg-dark-900 border border-white/10 text-white rounded-full backdrop-blur-md transition-all duration-200 active:scale-90 hover:scale-105"
                    >
                      {(isPremiumMode ? !spotifyReady || audioError : !track.previewUrl || audioError) ? (
                        <VolumeX className="w-5 h-5 text-white/40" />
                      ) : isPlaying ? (
                        <Pause className="w-5 h-5 text-spotify fill-current animate-pulse" />
                      ) : (
                        <Play className="w-5 h-5 text-white fill-current" />
                      )}
                    </button>
                  )}
                </div>

                {/* Song Meta Information */}
                <div className="p-6 flex-1 flex flex-col justify-between items-start bg-dark-800 text-left w-full select-none">
                  <div className="w-full">
                    <h2 className="text-xl font-bold truncate tracking-tight text-white mb-1.5" title={track.title}>
                      {track.title}
                    </h2>
                    <p className="text-sm font-medium text-white/50 truncate" title={track.artist}>
                      {track.artist}
                    </p>
                  </div>

                  {isActive && (
                    <div className="w-full flex items-center justify-between text-xs text-white/30 border-t border-white/5 pt-4 mt-2">
                      <span>
                        {isPremiumMode
                          ? usingPreviewFallback
                            ? '⚠️ Preview-Fallback (iTunes) — Song nicht streambar'
                            : spotifyReady
                              ? '🎵 Voller Song (Spotify Web Playback SDK)'
                              : '⏳ Spotify Player verbindet…'
                          : track.previewUrl
                            ? '🎵 iTunes Preview (30s)'
                            : '🚫 Kein Preview gefunden'}
                      </span>
                      <span className="font-mono text-[10px]">Swipe or Tap buttons</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Button Controller Footer */}
      <footer className="w-full max-w-sm flex justify-center items-center gap-6 z-10 py-2">
        {/* Dislike Button */}
        <button
          onClick={() => triggerSwipe('left')}
          disabled={isSwiping}
          className="p-5 rounded-full border border-white/10 bg-dark-800 hover:bg-accent-pink hover:text-white text-accent-pink active:scale-90 hover:shadow-glow-pink hover:border-accent-pink/40 disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 shadow-xl"
        >
          <X className="w-7 h-7" />
        </button>

        {/* Play/Pause indicator for mobile accessibility */}
        <button
          onClick={togglePlay}
          disabled={!canPlay || isSwiping}
          className="px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1.5 text-white/80 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all duration-200"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'Pause' : isPremiumMode ? 'Abspielen' : 'Preview'}</span>
        </button>

        {/* Like Button */}
        <button
          onClick={() => triggerSwipe('right')}
          disabled={isSwiping}
          className="p-5 rounded-full border border-white/10 bg-dark-800 hover:bg-spotify hover:text-dark-900 text-spotify active:scale-90 hover:shadow-glow-spotify hover:border-spotify/40 disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 shadow-xl"
        >
          <Heart className="w-7 h-7 fill-current" />
        </button>
      </footer>
    </div>
  );
}
