const prisma = require('./db');
const { getUserTopTracks, getUserPremiumStatus, getPlayableTrackIds } = require('./utils/spotify');
const { getValidToken } = require('./utils/tokenHelper');
const axios = require('axios');

const VALID_PLAYBACK_MODES = ['FREE', 'PREMIUM'];

function mapUserForClient(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    profileImage: user.profileImage,
    role: user.role,
    isFinished: user.isFinished,
    isPremium: user.isPremium
  };
}

async function refreshUserPremiumStatus(userId) {
  try {
    const token = await getValidToken(userId);
    const isPremium = await getUserPremiumStatus(token);
    return prisma.user.update({
      where: { id: userId },
      data: { isPremium }
    });
  } catch (err) {
    console.error(`Failed to refresh premium status for ${userId}:`, err.message);
    return prisma.user.findUnique({ where: { id: userId } });
  }
}

// Fetch 30-second audio previews from iTunes (used for Free lobbies)
async function fetchITunesPreview(title, artist) {
  try {
    // Strip trailing details like (feat. X) or - Remastered to maximize iTunes hits
    const cleanTitle = title.replace(/\s*[([].*?[\])]/g, '').split(' - ')[0].trim();
    const cleanArtist = artist.split(',')[0].trim(); // Use primary artist
    
    const query = `${cleanArtist} ${cleanTitle}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=1&entity=song`;
    const response = await axios.get(url, { timeout: 3500 });
    
    if (response.data?.results?.[0]?.previewUrl) {
      return response.data.results[0].previewUrl;
    }
  } catch (error) {
    console.error(`[ITUNES FALLBACK ERROR] Failed for "${title}" by ${artist}:`, error.message);
  }
  return null;
}

// Helper to generate a random 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Track state on the socket object
    socket.userId = null;
    socket.lobbyId = null;

    /**
     * CREATE LOBBY
     */
    socket.on('create_lobby', async ({ userId, displayName, profileImage, playbackMode = 'FREE' }) => {
      try {
        const mode = VALID_PLAYBACK_MODES.includes(playbackMode) ? playbackMode : 'FREE';
        const roomCode = generateRoomCode();

        await refreshUserPremiumStatus(userId);

        if (mode === 'PREMIUM') {
          const host = await prisma.user.findUnique({ where: { id: userId } });
          if (!host?.isPremium) {
            return socket.emit('error_message', 'Premium-Lobby: Du brauchst Spotify Premium, um diese Lobby zu erstellen.');
          }
        }
        
        // Create Lobby in DB
        await prisma.lobby.create({
          data: { id: roomCode, status: 'LOBBY', playbackMode: mode }
        });

        // Set Host
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            lobbyId: roomCode,
            role: 'HOST',
            isFinished: false
          }
        });

        socket.userId = userId;
        socket.lobbyId = roomCode;
        socket.join(roomCode);

        console.log(`Lobby ${roomCode} (${mode}) created by host ${displayName} (${userId})`);
        
        socket.emit('lobby_created', {
          lobbyId: roomCode,
          playbackMode: mode,
          users: [mapUserForClient(user)]
        });
      } catch (err) {
        console.error('Error creating lobby:', err.message);
        socket.emit('error_message', 'Failed to create lobby. Please try again.');
      }
    });

    /**
     * JOIN LOBBY
     */
    socket.on('join_lobby', async ({ lobbyId, userId, displayName, profileImage }) => {
      const code = lobbyId.toUpperCase();
      try {
        const lobby = await prisma.lobby.findUnique({
          where: { id: code },
          include: { users: true }
        });

        if (!lobby) {
          return socket.emit('error_message', 'Lobby not found. Check the code and try again.');
        }

        // If the game is already in progress, prevent joining (or handle accordingly)
        if (lobby.status !== 'LOBBY') {
          return socket.emit('error_message', 'This round has already started.');
        }

        await refreshUserPremiumStatus(userId);
        const joiningUser = await prisma.user.findUnique({ where: { id: userId } });

        if (lobby.playbackMode === 'PREMIUM' && !joiningUser?.isPremium) {
          return socket.emit('error_message', 'Premium-Lobby: Alle Spieler brauchen Spotify Premium. Bitte tritt einer Free-Lobby bei.');
        }

        // Check if the user is already the host of this lobby
        const existingHost = lobby.users.find(u => u.id === userId && u.role === 'HOST');
        const role = existingHost ? 'HOST' : 'PLAYER';

        // Update user in DB
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            lobbyId: code,
            role,
            isFinished: false
          }
        });

        socket.userId = userId;
        socket.lobbyId = code;
        socket.join(code);

        console.log(`User ${displayName} (${userId}) joined lobby ${code} as ${role}`);

        // Fetch updated users list
        const updatedLobby = await prisma.lobby.findUnique({
          where: { id: code },
          include: {
            users: {
              select: {
                id: true,
                displayName: true,
                profileImage: true,
                role: true,
                isFinished: true
              }
            }
          }
        });

        socket.emit('join_success', {
          lobbyId: code,
          playbackMode: updatedLobby.playbackMode,
          users: updatedLobby.users.map(mapUserForClient)
        });

        // Notify other users in the room
        io.to(code).emit('lobby_update', {
          playbackMode: updatedLobby.playbackMode,
          users: updatedLobby.users.map(mapUserForClient)
        });
      } catch (err) {
        console.error('Error joining lobby:', err.message);
        socket.emit('error_message', 'Failed to join lobby.');
      }
    });

    /**
     * START ROUND
     */
    socket.on('start_round', async ({ lobbyId }) => {
      try {
        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: { users: true }
        });

        if (!lobby) {
          return socket.emit('error_message', 'Lobby not found.');
        }

        // 1. Verify requester is the Host
        const requester = lobby.users.find(u => u.id === socket.userId);
        if (!requester || requester.role !== 'HOST') {
          return socket.emit('error_message', 'Only the Host can start the round.');
        }

        // Refresh premium flags before validating a premium round
        for (const user of lobby.users) {
          await refreshUserPremiumStatus(user.id);
        }
        const refreshedLobbyMeta = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: { users: true }
        });

        if (refreshedLobbyMeta.playbackMode === 'PREMIUM') {
          const nonPremium = refreshedLobbyMeta.users.filter(u => !u.isPremium);
          if (nonPremium.length > 0) {
            const names = nonPremium.map(u => u.displayName).join(', ');
            return io.to(lobbyId).emit(
              'error_message',
              `Premium-Lobby: Alle brauchen Spotify Premium. Ohne Premium: ${names}`
            );
          }
        }

        console.log(`Starting round for lobby ${lobbyId} (${refreshedLobbyMeta.playbackMode})...`);
        
        // Notify players that we are fetching and loading tracks (prevents lag UI)
        io.to(lobbyId).emit('loading_tracks');

        // 2. Fetch top tracks for every user in the lobby
        const allUsersTracks = []; // Array of arrays: [ [track1, track2], [track1, track2] ]
        
        for (const user of lobby.users) {
          try {
            const token = await getValidToken(user.id);
            const tracks = await getUserTopTracks(token, 50);
            if (tracks && tracks.length > 0) {
              allUsersTracks.push({
                userId: user.id,
                tracks
              });
            }
          } catch (tokenErr) {
            console.error(`Skipped fetching tracks for user ${user.displayName}:`, tokenErr.message);
          }
        }

        if (allUsersTracks.length === 0) {
          return io.to(lobbyId).emit('error_message', 'Could not fetch Spotify tracks for any lobby members. Please make sure everyone is logged in.');
        }

        // 3. Round-robin blend tracks to select 20 unique songs
        const selectedTracks = [];
        const selectedSpotifyIds = new Set();
        let addedCount = 0;
        
        // Clone lists to avoid mutation
        const userTrackLists = allUsersTracks.map(u => ({
          userId: u.userId,
          tracks: [...u.tracks]
        }));

        // Round-robin selection
        let hasTracksLeft = true;
        while (addedCount < 20 && hasTracksLeft) {
          hasTracksLeft = false;
          for (const userList of userTrackLists) {
            if (addedCount >= 20) break;
            
            if (userList.tracks.length > 0) {
              hasTracksLeft = true;
              const track = userList.tracks.shift(); // take the first track
              
              if (!selectedSpotifyIds.has(track.spotifyId)) {
                selectedSpotifyIds.add(track.spotifyId);
                selectedTracks.push(track);
                addedCount++;
              }
            }
          }
        }

        // If we ran out of round-robin tracks and still need up to 20, fill with whatever
        if (addedCount < 20) {
          const fallbackPool = allUsersTracks.flatMap(u => u.tracks);
          for (const track of fallbackPool) {
            if (addedCount >= 20) break;
            if (!selectedSpotifyIds.has(track.spotifyId)) {
              selectedSpotifyIds.add(track.spotifyId);
              selectedTracks.push(track);
              addedCount++;
            }
          }
        }

        const isPremiumLobby = refreshedLobbyMeta.playbackMode === 'PREMIUM';

        // Premium: prefer streamable tracks; keep others only if pool is too small (iTunes fallback on client)
        if (isPremiumLobby && selectedTracks.length > 0) {
          try {
            const hostToken = await getValidToken(requester.id);
            const pool = allUsersTracks.flatMap((u) => u.tracks);
            const playableIds = await getPlayableTrackIds(
              hostToken,
              pool.map((t) => t.spotifyId)
            );

            const seen = new Set();
            const reordered = [];

            for (const track of selectedTracks) {
              if (playableIds.has(track.spotifyId) && !seen.has(track.spotifyId)) {
                seen.add(track.spotifyId);
                reordered.push(track);
              }
            }
            for (const track of pool) {
              if (reordered.length >= 20) break;
              if (playableIds.has(track.spotifyId) && !seen.has(track.spotifyId)) {
                seen.add(track.spotifyId);
                reordered.push(track);
              }
            }
            for (const track of selectedTracks) {
              if (reordered.length >= 20) break;
              if (!seen.has(track.spotifyId)) {
                seen.add(track.spotifyId);
                reordered.push(track);
              }
            }

            selectedTracks.length = 0;
            selectedTracks.push(...reordered.slice(0, 20));
          } catch (playErr) {
            console.warn('Playability check skipped:', playErr.message);
          }
        }

        // iTunes previews for Free lobby; Premium lobby keeps them as fallback when SDK cannot stream
        await Promise.all(
          selectedTracks.map(async (track) => {
            const itunesUrl = await fetchITunesPreview(track.title, track.artist);
            if (itunesUrl) track.previewUrl = itunesUrl;
          })
        );

        // 4. Update Database
        // Reset old tracks and swipes for this lobby
        await prisma.track.deleteMany({ where: { lobbyId } });
        // Set Lobby status to SWIPING and Reset finished flags
        await prisma.lobby.update({
          where: { id: lobbyId },
          data: { status: 'SWIPING' }
        });
        await prisma.user.updateMany({
          where: { lobbyId },
          data: { isFinished: false }
        });

        // Insert tracks
        const createdTracks = [];
        for (const track of selectedTracks) {
          const dbTrack = await prisma.track.create({
            data: {
              spotifyId: track.spotifyId,
              title: track.title,
              artist: track.artist,
              albumArt: track.albumArt,
              previewUrl: track.previewUrl,
              lobbyId
            }
          });
          createdTracks.push(dbTrack);
        }

        // Fetch updated users list
        const refreshedLobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: { users: true }
        });

        // 5. Broadcast start round
        io.to(lobbyId).emit('round_started', {
          lobbyId,
          playbackMode: refreshedLobbyMeta.playbackMode,
          tracks: createdTracks,
          users: refreshedLobby.users.map(u => mapUserForClient({ ...u, isFinished: false }))
        });
        console.log(`Round started in room ${lobbyId} with ${createdTracks.length} tracks.`);
      } catch (err) {
        console.error('Error starting round:', err.message);
        io.to(lobbyId).emit('error_message', 'Failed to start the round.');
      }
    });

    /**
     * SUBMIT SWIPE
     */
    socket.on('submit_swipe', async ({ lobbyId, userId, trackId, liked }) => {
      try {
        // 1. Record Swipe in database
        await prisma.swipe.upsert({
          where: {
            userId_trackId: {
              userId,
              trackId
            }
          },
          update: { liked },
          create: { userId, trackId, liked }
        });

        // 2. Check if this user has finished swiping all tracks for this lobby
        const totalTracks = await prisma.track.count({ where: { lobbyId } });
        const userSwipes = await prisma.swipe.count({
          where: {
            userId,
            track: { lobbyId }
          }
        });

        const isFinished = userSwipes >= totalTracks;
        console.log(`[SWIPE DEBUG] User: ${userId}, Lobby: ${lobbyId}, Track: ${trackId}, Swipe recorded. Total Swipes: ${userSwipes}/${totalTracks}, isFinished: ${isFinished}`);

        if (isFinished) {
          console.log(`[SWIPE DEBUG] User ${userId} has finished swiping. Updating DB...`);
          await prisma.user.update({
            where: { id: userId },
            data: { isFinished: true }
          });
        }

        // Fetch user progress for everyone in the lobby
        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: {
            users: true,
            tracks: {
              include: {
                swipes: true
              }
            }
          }
        });

        // Update list of users to client
        const mappedUsers = lobby.users.map(mapUserForClient);

        io.to(lobbyId).emit('lobby_update', {
          playbackMode: lobby.playbackMode,
          users: mappedUsers
        });

        // 3. If everyone has finished, transition to Results
        const allFinished = lobby.users.every(u => u.isFinished);
        if (allFinished) {
          console.log(`All players finished swiping in lobby ${lobbyId}. Computing results...`);
          
          await prisma.lobby.update({
            where: { id: lobbyId },
            data: { status: 'RESULTS' }
          });

          const userCount = lobby.users.length;
          
          // Calculate intersection: Liked by EVERY user
          let matchedTracks = lobby.tracks.filter(track => {
            const likes = track.swipes.filter(s => s.liked).length;
            return likes === userCount;
          });

          let matchRate = '100%';

          // If empty, look for 80% matches
          if (matchedTracks.length === 0) {
            const threshold = Math.ceil(userCount * 0.8);
            matchedTracks = lobby.tracks.filter(track => {
              const likes = track.swipes.filter(s => s.liked).length;
              return likes >= threshold && likes > 0;
            });
            matchRate = '>=80%';
          }

          // If still empty, look for any match > 0%
          if (matchedTracks.length === 0) {
            matchedTracks = lobby.tracks.filter(track => {
              const likes = track.swipes.filter(s => s.liked).length;
              return likes > 0;
            });
            matchRate = '>0%';
          }

          // Emit game over with matches
          io.to(lobbyId).emit('game_over', {
            matchedTracks,
            matchRate,
            users: mappedUsers
          });
        }
      } catch (err) {
        console.error('Error submitting swipe:', err.message);
      }
    });

    /**
     * PLAY AGAIN (RESET GAME)
     */
    socket.on('play_again', async ({ lobbyId }) => {
      try {
        const lobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: { users: true }
        });

        if (!lobby) return;

        // Reset state
        await prisma.swipe.deleteMany({
          where: {
            track: { lobbyId }
          }
        });
        await prisma.track.deleteMany({ where: { lobbyId } });
        await prisma.lobby.update({
          where: { id: lobbyId },
          data: { status: 'LOBBY' }
        });
        await prisma.user.updateMany({
          where: { lobbyId },
          data: { isFinished: false }
        });

        const updatedLobby = await prisma.lobby.findUnique({
          where: { id: lobbyId },
          include: { users: true }
        });

        const usersList = updatedLobby.users.map(u => mapUserForClient({ ...u, isFinished: false }));

        io.to(lobbyId).emit('lobby_reset', {
          playbackMode: updatedLobby.playbackMode,
          users: usersList
        });
        console.log(`Lobby ${lobbyId} reset for another round.`);
      } catch (err) {
        console.error('Error resetting lobby:', err.message);
      }
    });

    /**
     * DISCONNECT HANDLER
     */
    socket.on('disconnecting', async () => {
      const { userId, lobbyId } = socket;
      if (userId && lobbyId) {
        try {
          console.log(`User ${userId} disconnecting from lobby ${lobbyId}`);
          
          // Remove lobby association for the user
          const user = await prisma.user.update({
            where: { id: userId },
            data: { lobbyId: null, role: 'PLAYER', isFinished: false }
          });

          // Check if there are remaining users in the lobby
          const lobby = await prisma.lobby.findUnique({
            where: { id: lobbyId },
            include: { users: true }
          });

          if (lobby) {
            if (lobby.users.length === 0) {
              // Delete empty lobby
              console.log(`Lobby ${lobbyId} has 0 users remaining. Deleting lobby.`);
              await prisma.lobby.delete({ where: { id: lobbyId } });
            } else {
              // If the disconnecting user was host, assign a new host
              if (user.role === 'HOST') {
                const nextUser = lobby.users[0];
                await prisma.user.update({
                  where: { id: nextUser.id },
                  data: { role: 'HOST' }
                });
                console.log(`Host left. Promoted user ${nextUser.displayName} to Host of Lobby ${lobbyId}`);
              }

              // Fetch updated user list to broadcast
              const refreshedLobby = await prisma.lobby.findUnique({
                where: { id: lobbyId },
                include: {
                  users: {
                    select: {
                      id: true,
                      displayName: true,
                      profileImage: true,
                      role: true,
                      isFinished: true,
                      isPremium: true
                    }
                  }
                }
              });

              io.to(lobbyId).emit('lobby_update', {
                playbackMode: refreshedLobby.playbackMode,
                users: refreshedLobby.users.map(mapUserForClient)
              });
            }
          }
        } catch (err) {
          console.error('Error handling disconnect for user:', err.message);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected from server:', socket.id);
    });
  });
};
