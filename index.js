const { default: makeWASocket, makeInMemoryStore, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// Simple auth state management
const authState = { creds: {}, keys: {} };

const sock = makeWASocket({
    auth: authState,
    printQRInTerminal: true,
    logger: console
});

sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    
    if (qr) {
        console.log('Scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully!');
    }
    
    if (connection === 'close') {
        console.log('❌ Connection closed, reconnecting...');
        setTimeout(() => {
            startBot();
        }, 5000);
    }
});

sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    
    if (!m.message) return;
    
    const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
    
    console.log('Received message:', messageText);
    
    if (messageText.toLowerCase() === '!ping') {
        await sock.sendMessage(m.key.remoteJid, { text: '🏓 pong!' });
        console.log('Sent pong response');
    }
    
    if (messageText.toLowerCase() === '!hello') {
        await sock.sendMessage(m.key.remoteJid, { text: '👋 Hello! Bot is working!' });
    }
});

console.log('🚀 Starting WhatsApp Bot...');