const fs = require('fs').promises;
const path = require('path');

class AdminCommands {
    constructor(userManager, groupManager) {
        this.userManager = userManager;
        this.groupManager = groupManager;
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.adminNumbers = ['263717457592']; // Add other admin numbers here
    }

    isAdmin(phoneNumber) {
        return this.adminNumbers.includes(phoneNumber);
    }

    async handleAdminCommand(sock, sender, phoneNumber, username, text, message) {
        // Check if user is admin
        const userPhone = phoneNumber.replace('@s.whatsapp.net', '');
        if (!this.isAdmin(userPhone) && sender !== this.commandNumber) {
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

        if (command === '!sysinfo') {
            await this.handleSysInfoCommand(sock, sender);
            return true;
        }

        if (command.startsWith('!broadcast ')) {
            const message = text.substring('!broadcast '.length);
            await this.handleBroadcastCommand(sock, sender, message);
            return true;
        }

        if (command.startsWith('!userinfo ')) {
            const targetPhone = text.substring('!userinfo '.length).trim();
            await this.handleUserInfoCommand(sock, sender, targetPhone);
            return true;
        }

        if (command.startsWith('!genotp ')) {
            const params = text.substring('!genotp '.length).trim().split(' ');
            if (params.length >= 3) {
                await this.handleGenOtpCommand(sock, sender, params[0], params[1], params[2]);
            } else {
                await sock.sendMessage(sender, { 
                    text: '❌ Usage: !genotp <phone> <plan> <days>\nExample: !genotp 263123456789 weekly 7' 
                });
            }
            return true;
        }

        if (command === '!help') {
            await this.handleHelpCommand(sock, sender);
            return true;
        }

        return false;
    }

    async handleStatsCommand(sock, sender) {
        try {
            const stats = this.groupManager.getGroupStats();
            const users = await this.userManager.getAllUsers();
            const activeUsers = Object.keys(users).length;
            const activatedUsers = await this.userManager.getActivatedUsersCount();

            let response = `📊 Bot Statistics:\n\n`;
            response += `👥 Total Users: ${activeUsers}\n`;
            response += `✅ Activated Users: ${activatedUsers}\n`;
            response += `🦾 Total Groups Joined: ${stats.totalGroups}\n\n`;
            
            response += `👤 Groups by User:\n`;
            for (const [user, count] of Object.entries(stats.groupsByUser)) {
                response += `• ${user}: ${count} groups\n`;
            }

            await sock.sendMessage(sender, { text: response });
        } catch (error) {
            console.error('Error in stats command:', error);
            await sock.sendMessage(sender, { text: '❌ Error fetching statistics' });
        }
    }

    async handleGroupsCommand(sock, sender) {
        try {
            const groups = this.groupManager.getAllGroups();
            
            if (groups.length === 0) {
                await sock.sendMessage(sender, { text: 'No groups joined yet.' });
                return;
            }

            let response = `📋 Joined Groups (${groups.length}):\n\n`;
            
            groups.forEach((group, index) => {
                response += `${index + 1}. ${group.name}\n`;
                response += `   👤 Added by: ${group.joinedByUsername || 'Unknown'}\n`;
                response += `   📅 Joined: ${new Date(group.joinedAt).toLocaleDateString()}\n`;
                response += `   🔗 Link: ${group.inviteLink || 'Not available'}\n\n`;
            });

            // Split message if too long
            if (response.length > 4096) {
                const parts = this.splitMessage(response);
                for (const part of parts) {
                    await sock.sendMessage(sender, { text: part });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                await sock.sendMessage(sender, { text: response });
            }
        } catch (error) {
            console.error('Error in groups command:', error);
            await sock.sendMessage(sender, { text: '❌ Error fetching groups' });
        }
    }

    async handleUsersCommand(sock, sender) {
        try {
            const users = await this.userManager.getAllUsers();
            const userCount = Object.keys(users).length;
            
            if (userCount === 0) {
                await sock.sendMessage(sender, { text: 'No users registered yet.' });
                return;
            }

            let response = `👥 Registered Users (${userCount}):\n\n`;
            
            for (const [phone, userData] of Object.entries(users)) {
                response += `• ${userData.username} (${phone})\n`;
                response += `  🎯 Role: ${userData.role}\n`;
                response += `  ✅ Activated: ${userData.isActivated ? 'Yes' : 'No'}\n`;
                if (userData.activationDate) {
                    response += `  📅 Activated: ${new Date(userData.activationDate).toLocaleDateString()}\n`;
                }
                response += `  ⏰ Last Active: ${new Date(userData.lastSeen).toLocaleDateString()}\n\n`;
            }

            // Split message if too long
            if (response.length > 4096) {
                const parts = this.splitMessage(response);
                for (const part of parts) {
                    await sock.sendMessage(sender, { text: part });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                await sock.sendMessage(sender, { text: response });
            }
        } catch (error) {
            console.error('Error in users command:', error);
            await sock.sendMessage(sender, { text: '❌ Error fetching users' });
        }
    }

    async handleSysInfoCommand(sock, sender) {
        try {
            const os = require('os');
            const process = require('process');
            
            const totalMem = os.totalmem() / (1024 * 1024 * 1024);
            const freeMem = os.freemem() / (1024 * 1024 * 1024);
            const usedMem = totalMem - freeMem;
            
            const uptime = this.formatUptime(process.uptime());
            
            let response = `🖥️ System Information:\n\n`;
            response += `📊 Memory Usage: ${usedMem.toFixed(2)}GB / ${totalMem.toFixed(2)}GB\n`;
            response += `💾 Free Memory: ${freeMem.toFixed(2)}GB\n`;
            response += `⏰ Uptime: ${uptime}\n`;
            response += `🖥️ Platform: ${os.platform()} ${os.arch()}\n`;
            response += `🔢 CPU Cores: ${os.cpus().length}\n`;
            response += `📦 Node.js: ${process.version}\n`;

            await sock.sendMessage(sender, { text: response });
        } catch (error) {
            console.error('Error in sysinfo command:', error);
            await sock.sendMessage(sender, { text: '❌ Error fetching system information' });
        }
    }

    async handleBroadcastCommand(sock, sender, message) {
        try {
            const users = await this.userManager.getAllUsers();
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
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            await sock.sendMessage(sender, { 
                text: `✅ Broadcast completed!\n\n✅ Successful: ${successCount}\n❌ Failed: ${failCount}` 
            });
        } catch (error) {
            console.error('Error in broadcast command:', error);
            await sock.sendMessage(sender, { text: '❌ Error during broadcast' });
        }
    }

    async handleUserInfoCommand(sock, sender, targetPhone) {
        try {
            const user = await this.userManager.getUser(targetPhone);
            
            if (!user) {
                await sock.sendMessage(sender, { text: `❌ User ${targetPhone} not found.` });
                return;
            }

            let response = `👤 User Information:\n\n`;
            response += `📛 Name: ${user.username}\n`;
            response += `📞 Phone: ${user.phoneNumber}\n`;
            response += `🎯 Role: ${user.role}\n`;
            response += `✅ Activated: ${user.isActivated ? 'Yes' : 'No'}\n`;
            response += `📅 Registered: ${new Date(user.registrationDate).toLocaleDateString()}\n`;
            
            if (user.activationDate) {
                response += `📆 Activated: ${new Date(user.activationDate).toLocaleDateString()}\n`;
            }
            
            response += `⏰ Last Seen: ${new Date(user.lastSeen).toLocaleDateString()}\n`;
            response += `📊 Messages Sent: ${user.stats.messagesSent || 0}\n`;
            response += `⚡ Commands Used: ${user.stats.commandsUsed || 0}\n`;
            response += `📥 Media Downloaded: ${user.stats.mediaDownloaded || 0}\n`;

            await sock.sendMessage(sender, { text: response });
        } catch (error) {
            console.error('Error in userinfo command:', error);
            await sock.sendMessage(sender, { text: '❌ Error fetching user information' });
        }
    }

    async handleGenOtpCommand(sock, sender, phone, plan, days) {
        try {
            // Generate a simple OTP (in real implementation, use a proper OTP generator)
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            
            let response = `🔑 OTP Generated Successfully!\n\n`;
            response += `📞 Phone: ${phone}\n`;
            response += `📦 Plan: ${plan}\n`;
            response += `📅 Days: ${days}\n`;
            response += `🔢 OTP: ${otp}\n\n`;
            response += `💡 Send this OTP to the user for activation.`;

            await sock.sendMessage(sender, { text: response });
        } catch (error) {
            console.error('Error in genotp command:', error);
            await sock.sendMessage(sender, { text: '❌ Error generating OTP' });
        }
    }

    async handleHelpCommand(sock, sender) {
        const helpText = `🛠️ Admin Commands:\n\n` +
            `📊 !stats - Show bot statistics\n` +
            `📋 !groups - List all joined groups\n` +
            `👥 !users - List all registered users\n` +
            `🖥️ !sysinfo - Show system information\n` +
            `📢 !broadcast <message> - Broadcast message to all users\n` +
            `👤 !userinfo <phone> - Get user information\n` +
            `🔑 !genotp <phone> <plan> <days> - Generate OTP for subscription\n` +
            `❓ !help - Show this help message`;

        await sock.sendMessage(sender, { text: helpText });
    }

    splitMessage(message, maxLength = 4096) {
        const parts = [];
        let currentPart = '';
        
        const lines = message.split('\n');
        
        for (const line of lines) {
            if (currentPart.length + line.length + 1 > maxLength) {
                parts.push(currentPart);
                currentPart = line + '\n';
            } else {
                currentPart += line + '\n';
            }
        }
        
        if (currentPart.length > 0) {
            parts.push(currentPart);
        }
        
        return parts;
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }
}

module.exports = AdminCommands;
