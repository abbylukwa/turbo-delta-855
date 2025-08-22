const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// Import managers (keep your imports)
const UserManager = require('./user-manager');
const ActivationManager = require('./activation-manager');
// ... other imports

let sock = null;
let isConnected = false;
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

function echo(message) {
    console.log(`[DEBUG] ${message}`);
}

async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        sock = makeWASocket({
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            markOnlineOnConnect: true,
        });

        // Initialize managers (keep your initialization code)
        echo('Initializing UserManager...');
        const userManager = new UserManager();
        // ... other initializations

        // KEEP ONLY ONE OF EACH EVENT HANDLER - REMOVE DUPLICATES

        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;
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
            if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp connected successfully!');
            } else if (connection === 'close') {
                isConnected = false;
                console.log('🔌 Connection closed');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on("messages.upsert", async (m) => {
            try {
                // YOUR MESSAGE HANDLING LOGIC HERE
                // (keep only one copy of your message processing code)
                
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });

    } catch (error) {
        console.error('Error starting bot:', error);
        setTimeout(startBot, 5000);
    }
}

// Start the bot
startBot();

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});
