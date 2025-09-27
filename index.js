const makeWASocket = require('@whiskeysockets/baileys').default;
const { useSingleFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
});

sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) {
        qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
        console.log('WhatsApp bot connected!');
    }
});

sock.ev.on('messages.upsert', ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    
    const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
    
    if (messageText === '!ping') {
        sock.sendMessage(m.key.remoteJid, { text: 'pong' });
    }
});

sock.ev.on('creds.update', saveState);