const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: 'ad0d2988-121c-42a0-8270-5f617b6fdf55', email: 'dm5245@srmist.edu.in', role: 'STUDENT' },
  'dev-secret-key-that-should-be-changed',
  { expiresIn: '15m' }
);

console.log('Testing notification socket connection...');
const notifSocket = io('http://localhost:3001', {
  extraHeaders: {
    Cookie: `access_token=${token}`
  }
});

notifSocket.on('connect', () => {
  console.log('✅ Notification socket connected successfully');
  notifSocket.disconnect();
});

notifSocket.on('connect_error', (err) => {
  console.error('❌ Notification socket connection error:', err.message);
  process.exit(1);
});

console.log('Testing messaging socket connection...');
const msgSocket = io('http://localhost:3001/messages', {
  extraHeaders: {
    Cookie: `access_token=${token}`
  }
});

msgSocket.on('connect', () => {
  console.log('✅ Messaging socket connected successfully');
  msgSocket.disconnect();
});

msgSocket.on('connect_error', (err) => {
  console.error('❌ Messaging socket connection error:', err.message);
  process.exit(1);
});
