import React from 'react';
import { Music, Radio, Sparkles, Heart } from 'lucide-react';

export default function LandingView() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  const handleLogin = () => {
    // Redirect user to backend OAuth flow
    window.location.href = `${BACKEND_URL}/api/auth/login`;
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-purple/15 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-spotify/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight">
          <div className="p-2 bg-spotify rounded-xl text-dark-900 shadow-glow-spotify">
            <Music className="w-6 h-6" />
          </div>
          <span>Music<span className="text-spotify">Map</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Spotify Sync Ready</span>
        </div>
      </header>

      {/* Hero Content */}
      <main className="flex-1 flex flex-col justify-center items-center max-w-4xl text-center z-10 my-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-sm font-medium mb-6 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>New: Swipe and export custom playlists!</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6">
          Find Your Perfect <br className="hidden md:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-spotify via-accent-cyan to-accent-purple">
            Common Taste
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-10 leading-relaxed font-light">
          Log in with your Spotify account, invite friends into your real-time swiping lobby, and instantly generate shared collaborative playlists matching everyone's vibe.
        </p>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleLogin}
            className="group flex items-center justify-center gap-3 bg-spotify hover:bg-spotify/95 text-dark-900 px-8 py-4 rounded-2xl font-bold text-lg shadow-glow-spotify active:scale-95 transition-all duration-300"
          >
            {/* Spotify SVG Logo */}
            <svg className="w-6 h-6 fill-current transition-transform group-hover:rotate-12 duration-300" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.075-.668-.135-.745-.47-.077-.337.135-.669.47-.746 3.855-.88 7.15-.51 9.822 1.13.295.178.387.563.206.86zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.08-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.66-1.11 8.224-.566 11.35 1.355.367.226.487.707.26 1.074zm.106-2.833C14.392 8.78 8.444 8.583 5.018 9.623c-.527.16-1.09-.14-1.25-.668-.16-.528.14-1.09.668-1.25 3.955-1.2 10.514-.975 14.59 1.444.475.283.63.896.347 1.37-.282.476-.897.63-1.37.348z" />
            </svg>
            <span>Connect Spotify to Start</span>
          </button>
          <span className="text-xs text-white/40 tracking-wider">NO PREMIUM ACCOUNT REQUIRED</span>
        </div>

        {/* Feature grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-24">
          <div className="glass-panel glass-panel-hover p-6 text-left flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-spotify/20 text-spotify flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-bold text-lg">Create a Lobby</h3>
            <p className="text-white/60 text-sm">Create a lobby and send your friends a unique 6-character room code to join in real-time.</p>
          </div>

          <div className="glass-panel glass-panel-hover p-6 text-left flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-bold text-lg">Tinder Swiping Game</h3>
            <p className="text-white/60 text-sm">Listen to 30-second previews and swipe right (like) or left (dislike). Tastes are blended round-robin.</p>
          </div>

          <div className="glass-panel glass-panel-hover p-6 text-left flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-purple/20 text-accent-purple flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-bold text-lg">Get Your Playlist</h3>
            <p className="text-white/60 text-sm">Find common songs. Export them straight into a new collaborative Spotify playlist with one click!</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl text-center text-xs text-white/30 border-t border-white/5 pt-6 mt-6 z-10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>© 2026 MusicMap. Built using Spotify Developer Web API.</p>
        <p className="flex items-center gap-1">
          Made with <Heart className="w-3.5 h-3.5 fill-accent-pink stroke-accent-pink" /> for music lovers.
        </p>
      </footer>
    </div>
  );
}
