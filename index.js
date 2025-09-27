console.log('🚀 Starting Baileys WhatsApp Bot...');

const makeWASocket = require('@whiskeysockets/baileys').default;
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

function startBot() {
    const sock = makeWASocket({
        printQRInTerminal: true
        // No logger parameter
    });

    sock.ev.on('connection.update', ({ connection, qr }) => {
        if (qr) {
            console.log('Scan QR:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Bot is ready!');
        }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
        const msg = messages[0];
        if (msg?.message) {
            const text = msg.message.conversation || '';
            if (text === '!ping') {
                sock.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
            }
        }
    });

    sock.ev.on('connection.update', ({ lastDisconnect }) => {
        if (lastDisconnect?.error?.output?.statusCode === 401) {
            console.log('❌ Logged out, please scan QR again');
            startBot();
        }
    });
}

startBot();