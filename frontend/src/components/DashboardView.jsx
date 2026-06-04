import React, { useState } from 'react';
import { LogOut, ArrowRight, Music, Plus, Users, ShieldAlert, Headphones, Crown } from 'lucide-react';

export default function DashboardView({
  user,
  isPremium,
  onCreateLobby,
  onJoinLobby,
  onLogout,
  error
}) {
  const [lobbyCode, setLobbyCode] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (lobbyCode.trim().length !== 6) return;
    onJoinLobby(lobbyCode.trim().toUpperCase());
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-pink/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-spotify/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      <header className="w-full max-w-4xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2 font-bold text-2xl tracking-tight">
          <div className="p-2 bg-spotify rounded-xl text-dark-900 shadow-glow-spotify">
            <Music className="w-5 h-5" />
          </div>
          <span>Music<span className="text-spotify">Map</span></span>
        </div>

        <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-2 pr-4 rounded-full backdrop-blur-md">
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt={user.displayName}
              className="w-8 h-8 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent-purple/30 text-accent-purple border border-white/20 flex items-center justify-center font-bold text-xs uppercase">
              {user.displayName.substring(0, 2)}
            </div>
          )}
          <div className="hidden sm:flex flex-col items-start">
            <span className="font-medium text-sm leading-none">{user.displayName}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isPremium ? 'text-spotify' : 'text-white/40'}`}>
              {isPremium ? 'Spotify Premium' : 'Spotify Free'}
            </span>
          </div>
          <button
            onClick={onLogout}
            title="Abmelden"
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center w-full max-w-4xl z-10 my-8">
        {error && (
          <div className="w-full max-w-md glass-panel border-red-500/20 bg-red-950/20 text-red-200 px-4 py-3.5 rounded-xl mb-6 flex items-center gap-3 animate-shake">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Lobby-Typ wählen</h2>
          <p className="text-white/50 text-sm md:text-base max-w-lg mx-auto">
            <strong className="text-white/70">Free:</strong> 30-Sekunden-Previews über iTunes — für alle.
            <br />
            <strong className="text-white/70">Premium:</strong> volle Songs über Spotify — nur wenn alle Premium haben.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-8">
          <div className="glass-panel glass-panel-hover p-8 flex flex-col justify-between items-start gap-6 relative overflow-hidden group">
            <div className="absolute top-[-30%] right-[-30%] w-48 h-48 rounded-full bg-accent-cyan/5 group-hover:bg-accent-cyan/10 blur-2xl transition-all duration-300 pointer-events-none"></div>
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-accent-cyan/15 text-accent-cyan rounded-xl border border-accent-cyan/20 w-fit">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">Free Lobby</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Jeder kann mitspielen. Beim Swipen hörst du 30-Sekunden-Previews aus der iTunes-Suche — kein Spotify Premium nötig.
              </p>
            </div>
            <button
              onClick={() => onCreateLobby('FREE')}
              className="w-full glass-btn glass-btn-accent py-3.5 rounded-xl group font-semibold text-white transition-all duration-300"
            >
              <span>Free Lobby erstellen</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
            </button>
          </div>

          <div className="glass-panel glass-panel-hover p-8 flex flex-col justify-between items-start gap-6 relative overflow-hidden group">
            <div className="absolute top-[-30%] right-[-30%] w-48 h-48 rounded-full bg-spotify/5 group-hover:bg-spotify/10 blur-2xl transition-all duration-300 pointer-events-none"></div>
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-spotify/15 text-spotify rounded-xl border border-spotify/20 w-fit">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">Premium Lobby</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Volle Songs von jedem Track in der Runde. Funktioniert nur, wenn <em>alle</em> Spieler Spotify Premium haben.
              </p>
              {!isPremium && (
                <p className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/20 px-3 py-2 rounded-lg">
                  Du hast aktuell kein Premium — diese Lobby kannst du nicht hosten.
                </p>
              )}
            </div>
            <button
              onClick={() => onCreateLobby('PREMIUM')}
              disabled={!isPremium}
              className="w-full glass-btn glass-btn-primary py-3.5 rounded-xl group font-semibold text-dark-900 transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>Premium Lobby erstellen</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
            </button>
          </div>
        </div>

        <div className="w-full max-w-md glass-panel p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="p-3 bg-accent-purple/15 text-accent-purple rounded-xl border border-accent-purple/20 w-fit">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Lobby beitreten</h3>
            <p className="text-white/60 text-sm">
              Code eingeben — der Lobby-Typ (Free oder Premium) wurde vom Host festgelegt.
            </p>
          </div>
          <form onSubmit={handleJoin} className="w-full flex flex-col gap-3">
            <input
              type="text"
              maxLength={6}
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              placeholder="6-STELLIGER CODE"
              className="glass-input text-center tracking-widest font-mono text-lg font-bold placeholder:font-sans placeholder:tracking-normal placeholder:text-sm uppercase py-3.5"
            />
            <button
              type="submit"
              disabled={lobbyCode.trim().length !== 6}
              className="w-full glass-btn border border-white/10 py-3.5 rounded-xl group font-semibold text-white transition-all duration-300"
            >
              <span>Beitreten</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full max-w-4xl text-center text-xs text-white/20 border-t border-white/5 pt-6 mt-6 z-10">
        <p>Nach dem Login erneut anmelden, falls Premium gerade nicht erkannt wird.</p>
      </footer>
    </div>
  );
}
