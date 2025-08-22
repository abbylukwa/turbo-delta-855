class AdminCommands {
    constructor(userManager, groupManager) {
        this.userManager = userManager;
        this.groupManager = groupManager;
        this.commandNumber = '263717457592@s.whatsapp.net';
    }

    async handleAdminCommand(sock, sender, phoneNumber, username, text, message) {
        // Check if command is from the authorized number
        if (sender !== this.commandNumber) {
            return false;
        }

        const command = text.toLowerCase().trim();

        if (command === '!stats') {
            await this.handleStatsCommand(sock, sender);
            return true;
        }

        if (command === '!groups') {
            await this.handleGroupsCommand(sock, sender);
            return true;
        }

        if (command === '!users') {
            await this.handleUsersCommand(sock, sender);
            return true;
        }

        if (command.startsWith('!broadcast ')) {
            const message = text.substring('!broadcast '.length);
            await this.handleBroadcastCommand(sock, sender, message);
            return true;
        }

        return false;
    }

    async handleStatsCommand(sock, sender) {
        const stats = this.groupManager.getGroupStats();
        const users = this.userManager.getAllUsers();
        const activeUsers = Object.keys(users).length;

        let response = `📊 Bot Statistics:\n\n`;
        response += `👥 Active Users: ${activeUsers}\n`;
        response += `🦾 Total Groups Joined: ${stats.totalGroups}\n\n`;
        
        response += `👤 Groups by User:\n`;
        for (const [user, count] of Object.entries(stats.groupsByUser)) {
            response += `• ${user}: ${count} groups\n`;
        }

        await sock.sendMessage(sender, { text: response });
    }

    async handleGroupsCommand(sock, sender) {
        const groups = this.groupManager.getAllGroups();
        
        if (groups.length === 0) {
            await sock.sendMessage(sender, { text: 'No groups joined yet.' });
            return;
        }

        let response = `📋 Joined Groups (${groups.length}):\n\n`;
        
        groups.forEach((group, index) => {
            response += `${index + 1}. ${group.name}\n`;
            response += `   👤 Added by: ${group.joinedByUsername}\n`;
            response += `   📅 Joined: ${new Date(group.joinDate).toLocaleDateString()}\n\n`;
        });

        // Split message if too long
        if (response.length > 4096) {
            const mid = response.lastIndexOf('\n\n', 4000);
            const part1 = response.substring(0, mid);
            const part2 = response.substring(mid);
            
            await sock.sendMessage(sender, { text: part1 });
            await sock.sendMessage(sender, { text: part2 });
        } else {
            await sock.sendMessage(sender, { text: response });
        }
    }

    async handleUsersCommand(sock, sender) {
        const users = this.userManager.getAllUsers();
        const userCount = Object.keys(users).length;
        
        if (userCount === 0) {
            await sock.sendMessage(sender, { text: 'No activated users yet.' });
            return;
        }

        let response = `👥 Activated Users (${userCount}):\n\n`;
        
        for (const [phone, userData] of Object.entries(users)) {
            response += `• ${userData.username} (${phone})\n`;
            response += `  📅 Activated: ${new Date(userData.activationDate).toLocaleDateString()}\n`;
            response += `  ⏰ Last Active: ${new Date(userData.lastActive).toLocaleDateString()}\n\n`;
        }

        // Split message if too long
        if (response.length > 4096) {
            const mid = response.lastIndexOf('\n\n', 4000);
            const part1 = response.substring(0, mid);
            const part2 = response.substring(mid);
            
            await sock.sendMessage(sender, { text: part1 });
            await sock.sendMessage(sender, { text: part2 });
        } else {
            await sock.sendMessage(sender, { text: response });
        }
    }

    async handleBroadcastCommand(sock, sender, message) {
        const users = this.userManager.getAllUsers();
        const userCount = Object.keys(users).length;
        
        if (userCount === 0) {
            await sock.sendMessage(sender, { text: 'No users to broadcast to.' });
            return;
        }

        await sock.sendMessage(sender, { 
            text: `📢 Broadcasting to ${userCount} users...` 
        });

        let successCount = 0;
        let failCount = 0;

        for (const phone of Object.keys(users)) {
            try {
                await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
                successCount++;
            } catch (error) {
                console.error(`Failed to send to ${phone}:`, error);
                failCount++;
            }
            
            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await sock.sendMessage(sender, { 
            text: `✅ Broadcast completed!\n\n✅ Successful: ${successCount}\n❌ Failed: ${failCount}` 
        });
    }
}

module.exports = AdminCommands;
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

        // Message handler
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];
                if (!message.message) return;

                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || "";
                
                const sender = message.key.remoteJid;
                const phoneNumber = sender.split('@')[0];
                
                // Get username
                let username = "User";
                try {
                    const contact = await sock.onWhatsApp(sender);
                    username = contact[0]?.exists ? contact[0].pushname || 'User' : 'User';
                } catch (error) {
                    console.error('Error getting username:', error);
                }

                console.log(`📨 Received message from ${username} (${phoneNumber}): ${text}`);

                // Check if user is activated
                const isActivated = userManager.isUserActivated(phoneNumber);
                
                // Handle activation
                if (!isActivated && text.trim() === '0121Abner') {
                    await activationManager.handleActivation(sock, sender, phoneNumber, username);
                    return;
                }

                // If not activated, ignore all messages
                if (!isActivated) {
                    console.log(`❌ Unactivated user ${phoneNumber} tried to send message`);
                    return;
                }

                // Handle group links from anyone (only if activated)
                const hasGroupLink = await groupManager.detectGroupLink(text);
                if (hasGroupLink) {
                    console.log(`🔗 Detected group link from ${username}, attempting to join...`);
                    await groupManager.handleGroupLink(sock, text, phoneNumber, username);
                    return;
                }

                // Handle commands from command number
                if (sender === COMMAND_NUMBER && text.startsWith('!')) {
                    await adminCommands.handleAdminCommand(sock, sender, phoneNumber, username, text, message);
                    return;
                }

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
