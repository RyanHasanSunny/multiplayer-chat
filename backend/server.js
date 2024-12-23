// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sanitizeHtml = require('sanitize-html');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_ORIGIN || '*', // Use environment variable
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(cors());

// Serve a simple message at the root
app.get('/', (req, res) => {
  res.send('Multiplayer Chat Server is Running.');
});

// In-memory storage for rooms
const rooms = {}; // { roomId: { passwordHash, users: [socket.id, ...] } }

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle joining a public chat
  socket.on('joinPublic', (username) => {
    const sanitizedUsername = sanitizeHtml(username.trim());
    socket.username = sanitizedUsername;
    socket.join('public');
    io.to('public').emit('userJoined', sanitizedUsername);
    console.log(`${sanitizedUsername} joined public chat.`);
  });

  // Handle public chat messages
  socket.on('publicMessage', (message) => {
    const sanitizedMessage = sanitizeHtml(message.trim());
    const timestamp = new Date().toISOString();
    io.to('public').emit('publicMessage', {
      username: socket.username,
      message: sanitizedMessage,
      timestamp
    });
    console.log(`[Public] ${socket.username}: ${sanitizedMessage}`);
  });

  // Handle creating a private room
  socket.on('createPrivate', async (data, callback) => {
    const { roomName, password } = data;
    const sanitizedRoomName = sanitizeHtml(roomName.trim());
    const sanitizedPassword = sanitizeHtml(password.trim());

    if (!sanitizedRoomName || !sanitizedPassword) {
      return callback({ success: false, message: 'Room name and password are required.' });
    }

    const roomId = uuidv4();
    const passwordHash = await bcrypt.hash(sanitizedPassword, 10);

    rooms[roomId] = {
      roomName: sanitizedRoomName,
      passwordHash,
      users: []
    };

    const roomLink = `https://your-frontend-domain.com/private/${roomId}`;
    callback({ success: true, roomId, roomLink });
    console.log(`${socket.username} created private room: ${sanitizedRoomName} (${roomId})`);
  });

  // Handle joining a private room
  socket.on('joinPrivate', async (data, callback) => {
    const { roomId, password, username } = data;
    const sanitizedRoomId = sanitizeHtml(roomId.trim());
    const sanitizedPassword = sanitizeHtml(password.trim());
    const sanitizedUsername = sanitizeHtml(username.trim());

    const room = rooms[sanitizedRoomId];
    if (!room) {
      return callback({ success: false, message: 'Room does not exist.' });
    }

    const passwordMatch = await bcrypt.compare(sanitizedPassword, room.passwordHash);
    if (!passwordMatch) {
      return callback({ success: false, message: 'Incorrect password.' });
    }

    socket.username = sanitizedUsername;
    socket.join(sanitizedRoomId);
    room.users.push(socket.id);
    io.to(sanitizedRoomId).emit('userJoined', sanitizedUsername);
    callback({ success: true, roomName: room.roomName });
    console.log(`${sanitizedUsername} joined private room: ${room.roomName} (${sanitizedRoomId})`);
  });

  // Handle private chat messages
  socket.on('privateMessage', (data) => {
    const { roomId, message } = data;
    const sanitizedRoomId = sanitizeHtml(roomId.trim());
    const sanitizedMessage = sanitizeHtml(message.trim());
    const timestamp = new Date().toISOString();

    if (!rooms[sanitizedRoomId]) {
      return;
    }

    io.to(sanitizedRoomId).emit('privateMessage', {
      username: socket.username,
      message: sanitizedMessage,
      timestamp
    });
    console.log(`[Private][${sanitizedRoomId}] ${socket.username}: ${sanitizedMessage}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Remove user from any private rooms they were part of
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const userIndex = room.users.indexOf(socket.id);
      if (userIndex !== -1) {
        room.users.splice(userIndex, 1);
        io.to(roomId).emit('userLeft', socket.username);
        console.log(`${socket.username} left private room: ${room.roomName} (${roomId})`);
        // Optionally, delete the room if empty
        if (room.users.length === 0) {
          delete rooms[roomId];
          console.log(`Private room deleted: ${room.roomName} (${roomId})`);
        }
      }
    }

    // Notify public chat
    if (socket.username) {
      io.to('public').emit('userLeft', socket.username);
      console.log(`${socket.username} left public chat.`);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
