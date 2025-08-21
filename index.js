// Add to the imports
const NicciCommands = require('./nicci-commands.js');

// Initialize Nicci commands
const nicciCommands = new NicciCommands(userManager, groupManager);

// In the message handler, add Nicci command processing
sock.ev.on("messages.upsert", async (m) => {
    const message = m.messages[0];
    if (!message.message) return;
    
    const text = message.message.conversation || 
                message.message.extendedTextMessage?.text || 
                message.message.imageMessage?.caption || "";
    
    const sender = message.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    const username = await getUsername(sock, sender);

    // Handle automatic group link joining from commanding number
    if (groupManager.isCommandNumber(phoneNumber)) {
        await nicciCommands.handleGroupLinks(sock, message);
    }

    // Handle activation keys
    if (['Abby0121', 'Admin0121', 'Nicci0121'].includes(text.trim())) {
        await handleActivation(sock, sender, phoneNumber, username, text.trim());
        return;
    }

    // Check authentication
    const userRole = userManager.getUserRole(phoneNumber);
    if (!userRole) {
        await sock.sendMessage(sender, { 
            text: `🔒 Please authenticate first ${username}!\nUse one of these keys:\n• Abby0121 - Media Downloader\n• Admin0121 - Web Search + Admin\n• Nicci0121 - Group Management` 
        });
        return;
    }

    // Check if it's a Nicci command
    if (userRole === 'nicci_user') {
        const handled = await nicciCommands.handleNicciCommand(sock, sender, phoneNumber, username, text, message);
        if (handled) return;
    }

    // ... rest of the message handling
});

// Add group event handlers for Nicci mode
sock.ev.on('group-participants.update', (update) => {
    groupManager.handleParticipantUpdate(update);
});

sock.ev.on('messages.upsert', (m) => {
    const message = m.messages[0];
    if (message.key.remoteJid?.endsWith('@g.us')) {
        groupManager.handleGroupMessage(message.key.remoteJid);
    }
});

// Nicci User Handler
async function handleNicciUser(sock, sender, phoneNumber, username, text, message) {
    if (text === '!help') {
        await showNicciHelp(sock, sender, username);
    } else {
        await sock.sendMessage(sender, { 
            text: `🛡️ Hello ${username}! Type !help for group management commands.\n\n⚡ Controlled by: +263717457592` 
        });
    }
}

// Show Nicci help
async function showNicciHelp(sock, sender, username) {
    let helpText = `🛡️ Nicci Help Menu for ${username}\n\n`;
    helpText += `🔗 !joingroup <link> - Join group from invite link\n`;
    helpText += `🏗️ !creategroup <name> - Create new group\n`;
    helpText += `📡 !createchannel <name> - Create channel/broadcast\n`;
    helpText += `📊 !groupstats - Group statistics\n`;
    helpText += `🔗 !grouplinks - Export group invite links\n`;
    helpText += `🚪 !leavegroup <id> - Leave group\n`;
    helpText += `❓ !help - This menu\n\n`;
    helpText += `⚡ Special Features:\n`;
    helpText += `• Auto-join group links from +263717457592\n`;
    helpText += `• Group statistics tracking\n`;
    helpText += `• Message broadcasting\n`;
    helpText += `• Group management tools\n\n`;
    helpText += `📞 Commanding Number: +263717457592`;

    await sock.sendMessage(sender, { text: helpText });
}
