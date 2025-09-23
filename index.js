const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { ReadableStream } = require('web-streams-polyfill');
global.ReadableStream = ReadableStream;

const { delay } = require('@whiskeysockets/baileys');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const { Pool } = require('pg');

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://database_3lb1_user:SG82maildcd1UeiIs0Gdndp8tMPRjOcI@dpg-d37c830gjchc73c5l15g-a/database_3lb1',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Config
const YOUR_PERSONAL_NUMBER = '1234567890';
const YOUR_PERSONAL_JID = `${YOUR_PERSONAL_NUMBER}@s.whatsapp.net`;
const CONSTANT_ADMINS = [YOUR_PERSONAL_JID, '27614159817@s.whatsapp.net', '263717457592@s.whatsapp.net', '263777627210@s.whatsapp.net'];

// State
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;
const MAX_PAIRING_ATTEMPTS = 3;
let pairingAttemptCount = 0;
let pairingMode = true;
let currentWhatsAppPairingCode = null;
let pairingCodeTimestamp = null;
const activePairingCodes = new Map();
const PAIRING_CODE_EXPIRY = 10 * 60 * 1000;

// Message storage
const yourMessages = { received: [], sent: [], groups: new Map(), contacts: new Map() };

// Logger
const createSimpleLogger = () => ({
  trace: console.log, debug: console.log, info: console.log, warn: console.warn, error: console.error, fatal: console.error, child: () => createSimpleLogger()
});

// Core functions
async function ensureDirectories() {
  const dirs = ['auth_info_baileys', 'data', 'downloads', 'downloads/music', 'downloads/videos', 'downloads/reels'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanupTempFiles() {
  ['temp', 'downloads/temp'].forEach(dir => {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });
}

function cleanupExpiredPairingCodes() {
  const now = Date.now();
  for (const [code, data] of activePairingCodes.entries()) {
    if (now - data.timestamp > PAIRING_CODE_EXPIRY) activePairingCodes.delete(code);
  }
  if (currentWhatsAppPairingCode && now - pairingCodeTimestamp > PAIRING_CODE_EXPIRY) {
    currentWhatsAppPairingCode = null;
    pairingCodeTimestamp = null;
  }
}

function displayWhatsAppPairingCode(code, attempt) {
  currentWhatsAppPairingCode = code;
  pairingCodeTimestamp = Date.now();
  activePairingCodes.set(code, { phone: 'whatsapp_generated', timestamp: pairingCodeTimestamp, isRealWhatsAppCode: true, attempt });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   WHATSAPP PAIRING CODE                  ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║ 🔐 Attempt: ${attempt}/${MAX_PAIRING_ATTEMPTS} | Code: ${code}                ║`);
  console.log(`║ 📱 Your Number: ${YOUR_PERSONAL_NUMBER}                   ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

function displayQRCode(qr, count) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                       QR CODE                            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  qrcode.generate(qr, { small: true });
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

function storePersonalMessage(message) {
  try {
    const messageData = {
      timestamp: new Date().toISOString(),
      from: message.key.remoteJid,
      message: message.message,
      type: Object.keys(message.message)[0],
      id: message.key.id,
      participant: message.key.participant
    };

    let text = '';
    if (messageData.type === 'conversation') text = message.message.conversation;
    else if (messageData.type === 'extendedTextMessage') text = message.message.extendedTextMessage.text;
    else if (messageData.type === 'imageMessage') text = message.message.imageMessage.caption || '[Image]';
    else if (messageData.type === 'videoMessage') text = message.message.videoMessage.caption || '[Video]';
    messageData.text = text;

    const isFromYou = message.key.fromMe;
    if (isFromYou) yourMessages.sent.push(messageData);
    else yourMessages.received.push(messageData);

    if (yourMessages.received.length > 1000) yourMessages.received.shift();
    if (yourMessages.sent.length > 1000) yourMessages.sent.shift();
  } catch (error) {
    console.error('Error storing message:', error);
  }
}

// Message processing
async function processMessage(sock, message) {
  if (!message.message) return;
  storePersonalMessage(message);

  const sender = message.key.remoteJid;
  const messageType = Object.keys(message.message)[0];
  let text = '';

  if (messageType === 'conversation') text = message.message.conversation;
  else if (messageType === 'extendedTextMessage') text = message.message.extendedTextMessage.text;

  if (sender.endsWith('@broadcast') || sender === 'status@broadcast') return;

  const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
  if (!commandMatch) return;

  const command = commandMatch[1].toLowerCase();
  const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

  switch (command) {
    case 'status':
      await sock.sendMessage(sender, { text: `🤖 Bot Status:\n• Connected: ${isConnected ? '✅' : '❌'}\n• Mode: ${pairingMode ? 'Pairing' : 'QR'}\n• Attempts: ${pairingAttemptCount}/${MAX_PAIRING_ATTEMPTS}` });
      break;
    case 'mystats':
      if (sender === YOUR_PERSONAL_JID) {
        await sock.sendMessage(sender, { text: `📊 Your Stats:\n📥 Received: ${yourMessages.received.length}\n📤 Sent: ${yourMessages.sent.length}\n👥 Contacts: ${yourMessages.contacts.size}` });
      }
      break;
    default:
      await sock.sendMessage(sender, { text: "❌ Unknown command" });
  }
}

// Connection Manager
class ConnectionManager {
  constructor() {
    this.isConnecting = false;
    this.pairingCodeDisplayed = false;
    this.qrDisplayCount = 0;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log('🔗 Connecting to WhatsApp...');
      await this.initializeFreshAuth();
    } catch (error) {
      console.error('❌ Connection error:', error);
      this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  async initializeFreshAuth() {
    try {
      if (fs.existsSync('auth_info_baileys')) {
        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
      }

      const authState = await useMultiFileAuthState('auth_info_baileys');
      const { version } = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        logger: createSimpleLogger(),
        printQRInTerminal: false,
        auth: authState.state,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false
      });

      sock.ev.on('creds.update', authState.saveCreds);

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        if (pairingCode && pairingMode && !this.pairingCodeDisplayed) {
          pairingAttemptCount++;
          this.pairingCodeDisplayed = true;
          displayWhatsAppPairingCode(pairingCode, pairingAttemptCount);
          setTimeout(() => {
            if (pairingAttemptCount < MAX_PAIRING_ATTEMPTS) {
              this.pairingCodeDisplayed = false;
              this.handleReconnection();
            } else {
              pairingMode = false;
              this.handleReconnection();
            }
          }, 45000);
        }

        if (qr && (!pairingMode || pairingAttemptCount >= MAX_PAIRING_ATTEMPTS)) {
          this.qrDisplayCount++;
          displayQRCode(qr, this.qrDisplayCount);
        }

        if (connection === 'open') this.handleSuccessfulConnection();
        if (connection === 'close') this.handleReconnection();
      });

      sock.ev.on('messages.upsert', async (messageData) => {
        if (messageData.type === 'notify') {
          for (const message of messageData.messages) {
            await processMessage(sock, message);
          }
        }
      });

    } catch (error) {
      console.error('❌ Auth error:', error);
      this.handleConnectionError(error);
    }
  }

  handleSuccessfulConnection() {
    isConnected = true;
    reconnectAttempts = 0;
    console.log('✅ WhatsApp connected successfully!');
  }

  handleReconnection() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Max reconnection attempts reached');
      this.clearAuthAndRestart();
      return;
    }

    reconnectAttempts++;
    setTimeout(() => this.connect(), Math.min(RECONNECT_INTERVAL * reconnectAttempts, 300000));
  }

  handleConnectionError(error) {
    console.error('❌ Connection error:', error);
    isConnected = false;
    this.handleReconnection();
  }

  clearAuthAndRestart() {
    if (fs.existsSync('auth_info_baileys')) {
      fs.rmSync('auth_info_baileys', { recursive: true, force: true });
    }
    setTimeout(() => this.connect(), 5000);
  }
}

// Initialize
const connectionManager = new ConnectionManager();
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => res.json({ status: 'ok', connected: isConnected }));

async function start() {
  await ensureDirectories();
  cleanupTempFiles();
  await connectionManager.connect();
  
  app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
  
  setInterval(cleanupExpiredPairingCodes, 60000);
  setInterval(cleanupTempFiles, 3600000);
}

// Start bot
start();

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  process.exit(0);
});