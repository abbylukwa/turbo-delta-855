const { default: makeWASocket } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

console.log('🚀 Starting WhatsApp Bot...');

try {
    const sock = makeWASocket({
        printQRInTerminal: true,
        logger: console
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        
        if (qr) {
            console.log('📱 Scan this QR code with WhatsApp:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log('✅ WhatsApp connected! Bot is ready.');
        }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
        const m = messages[0];
        
        if (m && m.message) {
            const text = m.message.conversation || '';
            
            if (text === '!ping') {
                sock.sendMessage(m.key.remoteJid, { text: 'pong' });
            }
            
            if (text === '!hello') {
                sock.sendMessage(m.key.remoteJid, { text: 'Hello there! 👋' });
            }
        }
    });

} catch (error) {
    console.log('Error starting bot:', error);
}