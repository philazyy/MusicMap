import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

import LandingView from './components/LandingView';
import AuthCallback from './components/AuthCallback';
import DashboardView from './components/DashboardView';
import LobbyView from './components/LobbyView';
import SwipingView from './components/SwipingView';
import ResultsView from './components/ResultsView';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function App() {
  const [view, setView] = useState('LANDING'); // LANDING, CALLBACK, DASHBOARD, LOBBY, SWIPING, RESULTS
  const [user, setUser] = useState({
    token: null,
    userId: null,
    displayName: '',
    profileImage: '',
    isPremium: false
  });

  // Lobby & Game States
  const [lobbyId, setLobbyId] = useState('');
  const [playbackMode, setPlaybackMode] = useState('FREE');
  const [users, setUsers] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [matchedTracks, setMatchedTracks] = useState([]);
  const [matchRate, setMatchRate] = useState('100%');
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [lobbyError, setLobbyError] = useState('');

  const socketRef = useRef(null);

  // Parse routing on mount
  useEffect(() => {
    const path = window.location.pathname;
    
    if (path === '/auth-callback') {
      setView('CALLBACK');
      return;
    }

    const savedToken = localStorage.getItem('musicmap_token');
    const savedUserId = localStorage.getItem('musicmap_userId');
    const savedDisplayName = localStorage.getItem('musicmap_displayName');
    const savedProfileImage = localStorage.getItem('musicmap_profileImage');
    const savedIsPremium = localStorage.getItem('musicmap_isPremium') === '1';

    if (savedToken && savedUserId) {
      const userData = {
        token: savedToken,
        userId: savedUserId,
        displayName: savedDisplayName || savedUserId,
        profileImage: savedProfileImage || '',
        isPremium: savedIsPremium
      };
      setUser(userData);
      setView('DASHBOARD');
      initializeSocket(userData);
    } else {
      setView('LANDING');
    }
  }, []);

  // Initialize Socket.io Connection
  const initializeSocket = (userData) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server:', socket.id);
    });

    socket.on('lobby_created', ({ lobbyId, users, playbackMode: mode }) => {
      setLobbyId(lobbyId);
      setUsers(users);
      setPlaybackMode(mode || 'FREE');
      setLobbyError('');
      setView('LOBBY');
    });

    socket.on('join_success', ({ lobbyId, users, playbackMode: mode }) => {
      setLobbyId(lobbyId);
      setUsers(users);
      setPlaybackMode(mode || 'FREE');
      setLobbyError('');
      setView('LOBBY');
    });

    socket.on('lobby_update', ({ users, playbackMode: mode }) => {
      setUsers(users);
      if (mode) setPlaybackMode(mode);
    });

    socket.on('loading_tracks', () => {
      setLoadingTracks(true);
      setView('LOBBY');
    });

    socket.on('round_started', ({ lobbyId, tracks, users, playbackMode: mode }) => {
      setTracks(tracks);
      setUsers(users);
      setPlaybackMode(mode || 'FREE');
      setLoadingTracks(false);
      setView('SWIPING');
    });

    socket.on('game_over', ({ matchedTracks, matchRate, users }) => {
      setMatchedTracks(matchedTracks);
      setMatchRate(matchRate);
      setUsers(users);
      setView('RESULTS');
    });

    socket.on('lobby_reset', ({ users, playbackMode: mode }) => {
      setUsers(users);
      if (mode) setPlaybackMode(mode);
      setTracks([]);
      setMatchedTracks([]);
      setView('LOBBY');
    });

    socket.on('error_message', (msg) => {
      setLobbyError(msg);
      setLoadingTracks(false);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected from server');
    });
  };

  // Auth Handlers
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setView('DASHBOARD');
    initializeSocket(userData);
    // Clear URL parameters
    window.history.replaceState({}, document.title, '/');
  };

  const handleLogout = () => {
    localStorage.removeItem('musicmap_token');
    localStorage.removeItem('musicmap_userId');
    localStorage.removeItem('musicmap_displayName');
    localStorage.removeItem('musicmap_profileImage');
    localStorage.removeItem('musicmap_isPremium');

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setUser({
      token: null,
      userId: null,
      displayName: '',
      profileImage: '',
      isPremium: false
    });
    setLobbyId('');
    setPlaybackMode('FREE');
    setUsers([]);
    setTracks([]);
    setMatchedTracks([]);
    setView('LANDING');
  };

  // Lobby Handlers
  const handleCreateLobby = (mode = 'FREE') => {
    if (!socketRef.current) return;
    socketRef.current.emit('create_lobby', {
      userId: user.userId,
      displayName: user.displayName,
      profileImage: user.profileImage,
      playbackMode: mode
    });
  };

  const handleJoinLobby = (code) => {
    if (!socketRef.current) return;
    setLobbyError('');
    socketRef.current.emit('join_lobby', {
      lobbyId: code,
      userId: user.userId,
      displayName: user.displayName,
      profileImage: user.profileImage
    });
  };

  const handleLeaveLobby = () => {
    if (socketRef.current) {
      // Disconnecting the socket triggers the server cleanup automatically.
      // Re-connecting places the user back in a fresh standby state.
      initializeSocket(user);
    }
    setLobbyId('');
    setUsers([]);
    setTracks([]);
    setMatchedTracks([]);
    setView('DASHBOARD');
  };

  const handleStartRound = () => {
    if (!socketRef.current || !lobbyId) return;
    socketRef.current.emit('start_round', { lobbyId });
  };

  const handleSwipe = (trackId, liked) => {
    if (!socketRef.current || !lobbyId) return;
    socketRef.current.emit('submit_swipe', {
      lobbyId,
      userId: user.userId,
      trackId,
      liked
    });
  };

  const handlePlayAgain = () => {
    if (!socketRef.current || !lobbyId) return;
    socketRef.current.emit('play_again', { lobbyId });
  };

  // Render Router
  return (
    <div className="h-full w-full">
      {view === 'LANDING' && (
        <LandingView />
      )}
      {view === 'CALLBACK' && (
        <AuthCallback onLoginSuccess={handleLoginSuccess} />
      )}
      {view === 'DASHBOARD' && (
        <DashboardView
          user={user}
          isPremium={user.isPremium}
          onCreateLobby={handleCreateLobby}
          onJoinLobby={handleJoinLobby}
          onLogout={handleLogout}
          error={lobbyError}
        />
      )}
      {view === 'LOBBY' && (
        <LobbyView
          lobbyId={lobbyId}
          playbackMode={playbackMode}
          users={users}
          currentUser={user}
          onStartRound={handleStartRound}
          onLeaveLobby={handleLeaveLobby}
          loadingTracks={loadingTracks}
          error={lobbyError}
        />
      )}
      {view === 'SWIPING' && (
        <SwipingView
          lobbyId={lobbyId}
          playbackMode={playbackMode}
          tracks={tracks}
          users={users}
          currentUser={user}
          onSwipe={handleSwipe}
        />
      )}
      {view === 'RESULTS' && (
        <ResultsView
          lobbyId={lobbyId}
          matchedTracks={matchedTracks}
          matchRate={matchRate}
          users={users}
          currentUser={user}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
