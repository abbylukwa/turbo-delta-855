const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let sock = null;
let isConnected = false;

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            markOnlineOnConnect: true,
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║                WHATSAPP BOT QR CODE               ║');
                console.log('╠══════════════════════════════════════════════════╣');
                console.log('║ Scan this QR code with WhatsApp -> Linked Devices║');
                console.log('║                                                  ║');
                qrcode.generate(qr, { small: true });
                console.log('║                                                  ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            }

            if (connection === 'close') {
                isConnected = false;
                console.log('Connection closed');
            } else if (connection === 'open') {
                isConnected = true;
                console.log('WhatsApp connected successfully!');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("messages.upsert", async (m) => {
            const message = m.messages[0];
            if (!message.message) return;

            const text = message.message.conversation || "";
            const sender = message.key.remoteJid;
            
            console.log(`Received message from ${sender}: ${text}`);
            
            // Echo message back to sender
            if (text) {
                await sock.sendMessage(sender, { text: `You said: ${text}` });
            }
        });

    } catch (error) {
        console.error('Error starting bot:', error);
    }
}

// Start the bot
console.log('Starting WhatsApp Bot...');
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    process.exit(0);
});