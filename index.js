const { default: makeWASocket } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

const sock = makeWASocket({
    printQRInTerminal: true,
});

sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    
    if (qr) {
        qrcode.generate(qr, { small: true });
        console.log('Scan the QR code above with WhatsApp');
    }
    
    if (connection === 'open') {
        console.log('✅ WhatsApp connected!');
    }
});

sock.ev.on('messages.upsert', ({ messages }) => {
    const m = messages[0];
    
    if (m && m.message) {
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        
        if (text === '!ping') {
            sock.sendMessage(m.key.remoteJid, { text: 'pong' });
        }
    }
});