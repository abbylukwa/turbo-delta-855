const venom = require('venom-bot');

console.log('🚀 Starting WhatsApp Bot with Venom...');

venom
    .create({
        session: 'my-bot',
        headless: true,
        useChrome: false,
        debug: false,
        logQR: true
    })
    .then((client) => {
        console.log('✅ WhatsApp connected successfully!');
        
        client.onMessage((message) => {
            console.log('Received message:', message.body);
            
            if (message.body === '!ping') {
                client.sendText(message.from, '🏓 pong!');
            }
            
            if (message.body === '!hello') {
                client.sendText(message.from, '👋 Hello! Bot is working!');
            }
            
            if (message.body === '!info') {
                client.sendText(message.from, '🤖 This is a simple WhatsApp bot');
            }
        });
        
        // Auto-reply when bot starts
        client.sendText('0775156210@c.us', '🤖 Bot started successfully!')
            .then(() => console.log('Startup message sent'))
            .catch(() => console.log('Could not send startup message'));
    })
    .catch((error) => {
        console.log('❌ Error:', error);
    });