import React, { useState } from 'react';
import { Copy, Check, Users, Play, Loader2, ArrowLeft, Disc, Headphones, Crown } from 'lucide-react';

export default function LobbyView({
  lobbyId,
  playbackMode,
  users,
  currentUser,
  onStartRound,
  onLeaveLobby,
  loadingTracks,
  error
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobbyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = users.find(u => u.id === currentUser.userId)?.role === 'HOST';
  const isPremiumLobby = playbackMode === 'PREMIUM';
  const allPremium = users.every(u => u.isPremium);
  const canStart = isHost && (!isPremiumLobby || allPremium);

  // Render the loading screen while tracks are fetching
  if (loadingTracks) {
    return (
      <div className="relative min-h-screen flex flex-col justify-center items-center px-4 bg-dark-900 overflow-hidden">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-spotify/10 blur-[100px] pointer-events-none animate-pulse-slow"></div>
        <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] rounded-full bg-accent-purple/10 blur-[100px] pointer-events-none animate-pulse-slow"></div>

        <div className="z-10 flex flex-col items-center max-w-md text-center">
          <div className="relative mb-6">
            <Disc className="w-16 h-16 text-spotify animate-spin-slow shadow-glow-spotify rounded-full" />
            <Loader2 className="w-6 h-6 text-accent-purple animate-spin absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Blending Taste Profile</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-1">
            MusicMap is currently calling the Spotify API to retrieve the top 50 tracks for every user in the room.
          </p>
          <p className="text-spotify text-xs font-semibold tracking-wider uppercase animate-pulse">
            {isPremiumLobby ? 'Premium-Modus: volle Songs' : 'Free-Modus: iTunes-Previews'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-spotify/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-purple/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center z-10">
        <button
          onClick={onLeaveLobby}
          className="glass-btn text-xs py-2 px-3 border-white/5 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Lobby</span>
        </button>

        <div className="flex items-center gap-1 text-white/40 text-xs uppercase tracking-wider font-bold">
          <Users className="w-3.5 h-3.5" />
          <span>{users.length} {users.length === 1 ? 'Player' : 'Players'}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col justify-center items-center w-full max-w-2xl z-10 my-8">
        
        {error && (
          <div className="w-full glass-panel border-red-500/20 bg-red-950/20 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Room Code Display Card */}
        <div className="w-full glass-panel p-6 text-center mb-8 relative overflow-hidden">
          <span className="text-xs text-white/40 font-semibold tracking-widest uppercase block mb-1">
            Lobby Room Code
          </span>
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl md:text-5xl font-mono font-extrabold tracking-widest text-spotify shadow-glow-spotify bg-dark-900/40 px-6 py-2.5 rounded-2xl border border-white/5">
              {lobbyId}
            </h1>
            <button
              onClick={handleCopyCode}
              title="Copy to Clipboard"
              className="p-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-2xl transition-all duration-200 active:scale-90"
            >
              {copied ? <Check className="w-5 h-5 text-spotify" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-white/40 mt-3">Teile den Code — alle hören denselben Modus.</p>
          <div
            className={`inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
              isPremiumLobby
                ? 'bg-spotify/15 text-spotify border-spotify/25'
                : 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/25'
            }`}
          >
            {isPremiumLobby ? <Crown className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
            {isPremiumLobby ? 'Premium Lobby — volle Songs' : 'Free Lobby — iTunes Previews'}
          </div>
        </div>

        {/* Players List Grid */}
        <div className="w-full glass-panel p-6 mb-8">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span>Connected Lobbyists</span>
            <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full border border-white/10 text-white/60">
              {users.length}
            </span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[30vh] overflow-y-auto pr-1">
            {users.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3.5 bg-dark-900/40 border border-white/5 rounded-xl transition-all duration-300 hover:border-white/10"
              >
                <div className="flex items-center gap-3">
                  {member.profileImage ? (
                    <img
                      src={member.profileImage}
                      alt={member.displayName}
                      className="w-10 h-10 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent-purple/20 text-accent-purple border border-white/10 flex items-center justify-center font-bold text-sm uppercase">
                      {member.displayName.substring(0, 2)}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm truncate max-w-[120px] sm:max-w-[150px]">
                      {member.displayName}
                    </span>
                    <span className="text-xs text-white/40">
                      {member.role === 'HOST' ? 'Lobby Creator' : 'Member'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {member.role === 'HOST' ? (
                    <span className="text-[10px] bg-spotify/15 text-spotify px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-spotify/25">
                      Host
                    </span>
                  ) : (
                    <span className="text-[10px] bg-white/5 text-white/50 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                      Bereit
                    </span>
                  )}
                  {isPremiumLobby && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                        member.isPremium
                          ? 'bg-spotify/10 text-spotify border-spotify/20'
                          : 'bg-red-950/40 text-red-300 border-red-500/30'
                      }`}
                    >
                      {member.isPremium ? 'Premium' : 'Kein Premium'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full text-center">
          {isHost ? (
            <div className="flex flex-col items-center gap-3">
              {isPremiumLobby && !allPremium && (
                <p className="text-sm text-amber-200/90 bg-amber-950/30 border border-amber-500/20 px-4 py-3 rounded-xl max-w-sm text-center">
                  Warte auf Premium bei allen Spielern, bevor die Runde starten kann.
                </p>
              )}
              <button
                onClick={onStartRound}
                disabled={!canStart}
                className="w-full max-w-sm glass-btn glass-btn-primary py-4 rounded-2xl font-extrabold flex items-center justify-center gap-2 group text-dark-900 hover:shadow-glow-spotify transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none disabled:animate-none animate-pulse"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Runde starten</span>
              </button>
              <span className="text-xs text-white/40 text-center max-w-sm">
                {isPremiumLobby
                  ? 'Alle hören die kompletten Songs über Spotify.'
                  : '30-Sekunden-Previews über iTunes für jeden Track.'}
              </span>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/5 rounded-2xl py-5 px-6 max-w-sm mx-auto flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-accent-cyan animate-spin" />
              <span className="text-sm font-medium text-white/70 text-left leading-tight">
                Waiting for the Host to start the round...
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center text-xs text-white/20">
        <p>Lobby Room: {lobbyId} • Users are synchronized using persistent WebSockets.</p>
      </footer>
    </div>
  );
}
