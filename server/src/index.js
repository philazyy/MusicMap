const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const fs = require('fs');

// Redirect console output to a log file for remote debugging
const logFile = path.resolve(__dirname, '../debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logStream.write(`[LOG] ${new Date().toISOString()} - ${message}\n`);
  originalLog.apply(console, args);
};

console.error = function (...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logStream.write(`[ERROR] ${new Date().toISOString()} - ${message}\n`);
  originalError.apply(console, args);
};

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlist');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/playlists', playlistRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Temporary database debug endpoint
app.get('/api/debug/db', async (req, res) => {
  try {
    const prisma = require('./db');
    const users = await prisma.user.findMany();
    const tracks = await prisma.track.findMany();
    const swipes = await prisma.swipe.findMany();
    const lobbies = await prisma.lobby.findMany();
    res.json({ users, tracks, swipes, lobbies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io Server Setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize Socket event handlers
socketHandler(io);

// Start the server
server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🎵 MusicMap backend running on port ${PORT}`);
  console.log(`🌐 Allowing frontend CORS from: ${CLIENT_URL}`);
  console.log(`=============================================`);
});
