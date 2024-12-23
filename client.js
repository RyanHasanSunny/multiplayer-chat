// frontend/public/client.js
const socket = io('https://multiplayer-chat-backend-v2.glitch.me'); // Replace with your backend URL

const app = document.getElementById('app');

// Helper function to get URL path
function getPath() {
  return window.location.pathname;
}

// Render functions
function renderHome() {
  app.innerHTML = `
    <header>
      <h2>Welcome to Multiplayer Chat</h2>
    </header>
    <div id="home">
      <button id="public-chat-btn">Join Public Chat</button>
      <button id="create-private-chat-btn">Create Private Chat</button>
      <button id="join-private-chat-btn">Join Private Chat</button>
    </div>
  `;

  document.getElementById('public-chat-btn').addEventListener('click', () => {
    const username = prompt('Enter your username:') || 'Anonymous';
    window.location.href = `/public?username=${encodeURIComponent(username)}`;
  });

  document.getElementById('create-private-chat-btn').addEventListener('click', () => {
    const username = prompt('Enter your username:') || 'Anonymous';
    window.location.href = `/create?username=${encodeURIComponent(username)}`;
  });

  document.getElementById('join-private-chat-btn').addEventListener('click', () => {
    window.location.href = `/join`;
  });
}

function renderPublicChat(username) {
  app.innerHTML = `
    <header>
      <h2>Public Chat</h2>
      <p>Logged in as: ${username}</p>
    </header>
    <div id="chat-container">
      <div id="messages"></div>
      <form id="chat-form">
        <input id="message-input" type="text" placeholder="Type a message..." autocomplete="off" required />
        <button type="submit">Send</button>
      </form>
    </div>
    <button id="back-home-btn">Back to Home</button>
  `;

  socket.emit('joinPublic', username);

  socket.on('publicMessage', (data) => {
    displayMessage(data, 'public');
  });

  socket.on('userJoined', (user) => {
    displaySystemMessage(`${user} has joined the public chat.`);
  });

  socket.on('userLeft', (user) => {
    displaySystemMessage(`${user} has left the public chat.`);
  });

  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const message = document.getElementById('message-input').value.trim();
    if (message === '') return;
    socket.emit('publicMessage', message);
    document.getElementById('message-input').value = '';
  });

  document.getElementById('back-home-btn').addEventListener('click', () => {
    window.location.href = '/';
  });
}

function renderCreatePrivateChat(username) {
  app.innerHTML = `
    <header>
      <h2>Create Private Chat</h2>
      <p>Logged in as: ${username}</p>
    </header>
    <div id="create-room-container">
      <form id="create-room-form">
        <input type="text" id="room-name" placeholder="Enter room name" required />
        <input type="password" id="room-password" placeholder="Enter room password" required />
        <button type="submit">Create Room</button>
      </form>
    </div>
    <button id="back-home-btn">Back to Home</button>
  `;

  document.getElementById('create-room-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = document.getElementById('room-name').value.trim();
    const roomPassword = document.getElementById('room-password').value.trim();
    if (!roomName || !roomPassword) {
      alert('Room name and password are required.');
      return;
    }

    socket.emit('createPrivate', { roomName, password: roomPassword }, (response) => {
      if (response.success) {
        alert('Private room created successfully!');
        window.location.href = `/private/${response.roomId}`;
      } else {
        alert(`Error: ${response.message}`);
      }
    });
  });

  document.getElementById('back-home-btn').addEventListener('click', () => {
    window.location.href = '/';
  });
}

function renderJoinPrivateChat() {
  app.innerHTML = `
    <header>
      <h2>Join Private Chat</h2>
    </header>
    <div id="join-room-container">
      <form id="join-room-form">
        <input type="text" id="room-link" placeholder="Enter room link" required />
        <input type="password" id="room-password" placeholder="Enter room password" required />
        <button type="submit">Join Room</button>
      </form>
    </div>
    <button id="back-home-btn">Back to Home</button>
  `;

  document.getElementById('join-room-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const roomLink = document.getElementById('room-link').value.trim();
    const roomPassword = document.getElementById('room-password').value.trim();

    if (!roomLink || !roomPassword) {
      alert('Room link and password are required.');
      return;
    }

    // Extract roomId from the link
    const url = new URL(roomLink);
    const pathSegments = url.pathname.split('/');
    const roomId = pathSegments[pathSegments.length - 1];

    const username = prompt('Enter your username:') || 'Anonymous';

    socket.emit('joinPrivate', { roomId, password: roomPassword, username }, (response) => {
      if (response.success) {
        window.location.href = `/private/${roomId}?username=${encodeURIComponent(username)}`;
      } else {
        alert(`Error: ${response.message}`);
      }
    });
  });

  document.getElementById('back-home-btn').addEventListener('click', () => {
    window.location.href = '/';
  });
}

function renderPrivateChat(roomId, username) {
  app.innerHTML = `
    <header>
      <h2>Private Chat: ${roomId}</h2>
      <p>Logged in as: ${username}</p>
    </header>
    <div id="chat-container">
      <div id="messages"></div>
      <form id="chat-form">
        <input id="message-input" type="text" placeholder="Type a message..." autocomplete="off" required />
        <button type="submit">Send</button>
      </form>
    </div>
    <button id="back-home-btn">Back to Home</button>
  `;

  const queryParams = new URLSearchParams(window.location.search);
  const roomIdFromURL = roomId;
  socket.emit('joinPrivate', { roomId: roomIdFromURL, password: '', username }, (response) => {
    if (response.success) {
      // Successfully joined
    } else {
      alert(`Error: ${response.message}`);
      window.location.href = '/';
    }
  });

  socket.on('privateMessage', (data) => {
    displayMessage(data, 'private');
  });

  socket.on('userJoined', (user) => {
    displaySystemMessage(`${user} has joined the private chat.`);
  });

  socket.on('userLeft', (user) => {
    displaySystemMessage(`${user} has left the private chat.`);
  });

  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const message = document.getElementById('message-input').value.trim();
    if (message === '') return;
    socket.emit('privateMessage', { roomId, message });
    document.getElementById('message-input').value = '';
  });

  document.getElementById('back-home-btn').addEventListener('click', () => {
    window.location.href = '/';
  });
}

// Helper functions to display messages
function displayMessage(data, type) {
  const messages = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');

  if (type === 'private') {
    messageElement.classList.add('private-message');
  }

  const usernameElement = document.createElement('span');
  usernameElement.classList.add('username');
  usernameElement.textContent = `${data.username}:`;

  const textElement = document.createElement('span');
  textElement.classList.add('text');
  textElement.textContent = ` ${data.message}`;

  messageElement.appendChild(usernameElement);
  messageElement.appendChild(textElement);
  messages.appendChild(messageElement);

  // Scroll to the bottom
  messages.scrollTop = messages.scrollHeight;
}

function displaySystemMessage(message) {
  const messages = document.getElementById('messages');
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', 'system-message');

  const textElement = document.createElement('span');
  textElement.classList.add('text');
  textElement.textContent = message;

  messageElement.appendChild(textElement);
  messages.appendChild(messageElement);

  // Scroll to the bottom
  messages.scrollTop = messages.scrollHeight;
}

// Routing based on URL
function router() {
  const path = getPath();
  const params = new URLSearchParams(window.location.search);

  if (path.startsWith('/public')) {
    const username = params.get('username') || 'Anonymous';
    renderPublicChat(username);
  } else if (path.startsWith('/create')) {
    const username = params.get('username') || 'Anonymous';
    renderCreatePrivateChat(username);
  } else if (path.startsWith('/join')) {
    renderJoinPrivateChat();
  } else if (path.startsWith('/private/')) {
    const segments = path.split('/');
    const roomId = segments[2];
    const username = params.get('username') || 'Anonymous';
    renderPrivateChat(roomId, username);
  } else {
    renderHome();
  }
}

// Initialize router
window.onload = router;

// Handle back/forward navigation
window.onpopstate = router;
