const axios = require('axios');

class NicciCommands {
    constructor(userManager, groupManager) {
        this.userManager = userManager;
        this.groupManager = groupManager;
        this.commandNumber = '+263717457592';
    }

    // Group link detection function
    async detectGroupLink(text) {
        const groupLinkPatterns = [
            /chat\.whatsapp\.com\/([a-zA-Z0-9_-]{22})/,
            /whatsapp\.com\/(?:chat|invite)\/([a-zA-Z0-9_-]{22})/,
            /https?:\/\/(?:www\.)?whatsapp\.com\/.{22}/,
            /https?:\/\/(?:www\.)?chat\.whatsapp\.com\/.{22}/
        ];
        
        return groupLinkPatterns.some(pattern => pattern.test(text));
    }

    // Handle group links
    async handleGroupLinks(sock, message) {
        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text || '';
        
        const groupLinkMatch = text.match(/https?:\/\/(?:www\.)?(?:chat\.)?whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})/);
        
        if (groupLinkMatch) {
            const inviteCode = groupLinkMatch[1];
            try {
                console.log(`🔗 Attempting to join group with code: ${inviteCode}`);
                await sock.groupAcceptInvite(inviteCode);
                console.log('✅ Successfully joined group!');
                
                const sender = message.key.remoteJid;
                await sock.sendMessage(sender, { 
                    text: `✅ Successfully joined the group!\n\n🔗 Invite Code: ${inviteCode}\n📊 I will now monitor this group for management.`
                });
                
                return true;
            } catch (error) {
                console.error('❌ Failed to join group:', error);
                const sender = message.key.remoteJid;
                await sock.sendMessage(sender, { 
                    text: `❌ Failed to join group:\n${error.message || 'Unknown error'}`
                });
                return false;
            }
        }
        return false;
    }

    // Check if message is Nicci command
    async handleNicciCommand(sock, sender, phoneNumber, username, text, message) {
        if (!this.userManager.hasPermission(phoneNumber, 'manage_groups')) {
            return false;
        }

        // Check if it's a command from the commanding number
        const isFromCommandNumber = this.groupManager.isCommandNumber(phoneNumber);
        const commands = [
            '!joingroup', '!creategroup', '!createchannel', '!groupstats',
            '!grouplinks', '!sendall', '!sendto', '!leavegroup'
        ];

        if (commands.some(cmd => text.startsWith(cmd)) || isFromCommandNumber) {
            await this.processNicciCommand(sock, sender, phoneNumber, username, text, message, isFromCommandNumber);
            return true;
        }

        return false;
    }

    // Process Nicci commands
    async processNicciCommand(sock, sender, phoneNumber, username, text, message, isFromCommandNumber) {
        if (text.startsWith('!joingroup ')) {
            await this.joinGroup(sock, sender, text);
        } else if (text.startsWith('!creategroup ')) {
            await this.createGroup(sock, sender, text);
        } else if (text.startsWith('!createchannel ')) {
            await this.createChannel(sock, sender, text);
        } else if (text === '!groupstats') {
            await this.showGroupStats(sock, sender);
        } else if (text === '!grouplinks') {
            await this.exportGroupLinks(sock, sender);
        } else if (text.startsWith('!sendall ')) {
            if (isFromCommandNumber) {
                await this.sendToAllGroups(sock, sender, text);
            } else {
                await sock.sendMessage(sender, { text: "❌ Only the commanding number can send messages to all groups." });
            }
        } else if (text.startsWith('!sendto ')) {
            await this.sendToGroup(sock, sender, text);
        } else if (text.startsWith('!leavegroup ')) {
            await this.leaveGroup(sock, sender, text);
        }
    }

    // Join group from invite link
    async joinGroup(sock, sender, text) {
        const groupLink = text.replace('!joingroup ', '').trim();
        if (!groupLink) {
            await sock.sendMessage(sender, { text: "❌ Please provide a group invite link." });
            return;
        }

        await sock.sendMessage(sender, { text: "🔗 Attempting to join group..." });

        const result = await this.groupManager.joinGroup(sock, groupLink);
        
        if (result.success) {
            await sock.sendMessage(sender, { 
                text: `✅ Successfully joined group!\n\n🏷️ Name: ${result.name}\n👥 Members: ${result.participants}\n🆔 ID: ${result.groupId}\n\n🌐 Group added to managed groups.` 
            });
            
            // Notify commanding number
            if (!this.groupManager.isCommandNumber(sender.split('@')[0])) {
                await this.notifyCommandNumber(sock, `📥 ${username} joined group: ${result.name}`);
            }
        } else {
            await sock.sendMessage(sender, { 
                text: `❌ Failed to join group: ${result.error}\n💡 Make sure the invite link is valid and not expired.` 
            });
        }
    }

    // Create new group
    async createGroup(sock, sender, text) {
        const groupName = text.replace('!creategroup ', '').trim();
        if (!groupName) {
            await sock.sendMessage(sender, { text: "❌ Please provide a group name." });
            return;
        }

        await sock.sendMessage(sender, { text: `🏗️ Creating group "${groupName}"...` });

        const result = await this.groupManager.createGroup(sock, groupName);
        
        if (result.success) {
            await sock.sendMessage(sender, { 
                text: `✅ Group created successfully!\n\n🏷️ Name: ${result.name}\n🆔 ID: ${result.groupId}\n👑 You are now admin\n\n🌐 Group is now being managed.` 
            });
            
            // Notify commanding number
            await this.notifyCommandNumber(sock, `🏗️ New group created: ${result.name} by ${username}`);
        } else {
            await sock.sendMessage(sender, { 
                text: `❌ Failed to create group: ${result.error}` 
            });
        }
    }

    // Create channel/broadcast
    async createChannel(sock, sender, text) {
        const channelName = text.replace('!createchannel ', '').trim();
        if (!channelName) {
            await sock.sendMessage(sender, { text: "❌ Please provide a channel name." });
            return;
        }

        await sock.sendMessage(sender, { text: `📡 Creating channel "${channelName}"...` });

        const result = await this.groupManager.createChannel(sock, channelName);
        
        if (result.success) {
            await sock.sendMessage(sender, { 
                text: `✅ Channel created successfully!\n\n📡 Name: ${result.name}\n🆔 ID: ${result.channelId}\n\n🌐 Channel is now being managed.` 
            });
            
            // Notify commanding number
            await this.notifyCommandNumber(sock, `📡 New channel created: ${result.name} by ${username}`);
        } else {
            await sock.sendMessage(sender, { 
                text: `❌ Failed to create channel: ${result.error}` 
            });
        }
    }

    // Show group statistics
    async showGroupStats(sock, sender) {
        const stats = this.groupManager.getGroupStatistics();
        
        let statsText = `📊 GROUP STATISTICS\n\n`;
        statsText += `🏢 Total Groups: ${stats.totalGroups}\n`;
        statsText += `✅ Active Groups: ${stats.activeGroups}\n`;
        statsText += `❌ Inactive Groups: ${stats.inactiveGroups}\n`;
        statsText += `👥 Total Members: ${stats.totalMembers}\n`;
        statsText += `📤 Messages Sent: ${stats.messagesSent}\n`;
        statsText += `📈 Avg Messages/Group: ${stats.averageMessages}\n\n`;
        statsText += `🔄 Last Updated: ${new Date().toLocaleString()}`;

        await sock.sendMessage(sender, { text: statsText });
    }

    // Export group links
    async exportGroupLinks(sock, sender) {
        const links = this.groupManager.exportGroupLinks();
        
        if (links.length === 0) {
            await sock.sendMessage(sender, { text: "❌ No active groups with invite links." });
            return;
        }

        let linksText = `🔗 GROUP INVITE LINKS\n\n`;
        
        links.forEach((link, index) => {
            linksText += `${index + 1}. ${link.name}\n`;
            linksText += `   👥 Members: ${link.members}\n`;
            linksText += `   🔗 ${link.link}\n`;
            linksText += `   📅 Joined: ${link.joinedAt.toLocaleDateString()}\n\n`;
        });

        linksText += `📊 Total: ${links.length} active groups`;

        await sock.sendMessage(sender, { text: linksText });
        
        // Also send to commanding number if requested by someone else
        if (!this.groupManager.isCommandNumber(sender.split('@')[0])) {
            await this.notifyCommandNumber(sock, `📋 Group links exported by ${username}`);
        }
    }

    // Send message to all groups
    async sendToAllGroups(sock, sender, text) {
        const message = text.replace('!sendall ', '').trim();
        if (!message) {
            await sock.sendMessage(sender, { text: "❌ Please provide a message to send." });
            return;
        }

        await sock.sendMessage(sender, { text: `📤 Sending message to all groups...` });

        const results = await this.groupManager.sendToAllGroups(sock, message);
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        await sock.sendMessage(sender, { 
            text: `✅ Message sent to ${successful} groups\n❌ Failed for ${failed} groups\n\n📊 Total groups: ${results.length}` 
        });

        // Send detailed results to commanding number
        if (successful > 0) {
            let detailedText = `📊 MESSAGE DELIVERY REPORT\n\n`;
            detailedText += `✅ Successful: ${successful} groups\n`;
            detailedText += `❌ Failed: ${failed} groups\n`;
            detailedText += `📝 Message: "${message}"\n`;
            detailedText += `🕒 Sent at: ${new Date().toLocaleString()}`;
            
            await this.notifyCommandNumber(sock, detailedText);
        }
    }

    // Send message to specific group
    async sendToGroup(sock, sender, text) {
        const parts = text.split(' ');
        if (parts.length < 3) {
            await sock.sendMessage(sender, { text: "❌ Usage: !sendto <groupId> <message>" });
            return;
        }

        const groupId = parts[1];
        const message = parts.slice(2).join(' ');

        await sock.sendMessage(sender, { text: `📤 Sending message to group...` });

        const result = await this.groupManager.sendToGroup(sock, groupId, message);
        
        if (result.success) {
            await sock.sendMessage(sender, { text: `✅ Message sent successfully to group ${groupId}` });
        } else {
            await sock.sendMessage(sender, { text: `❌ Failed to send message: ${result.error}` });
        }
    }

    // Leave group
    async leaveGroup(sock, sender, text) {
        const groupId = text.replace('!leavegroup ', '').trim();
        if (!groupId) {
            await sock.sendMessage(sender, { text: "❌ Please provide a group ID." });
            return;
        }

        try {
            await sock.groupLeave(groupId);
            this.groupManager.removeGroup(groupId);
            
            await sock.sendMessage(sender, { text: `✅ Left group ${groupId} successfully` });
            await this.notifyCommandNumber(sock, `🚪 Left group: ${groupId}`);
        } catch (error) {
            await sock.sendMessage(sender, { text: `❌ Failed to leave group: ${error.message}` });
        }
    }

    // Notify commanding number
    async notifyCommandNumber(sock, message) {
        try {
            await sock.sendMessage(`${this.commandNumber}@s.whatsapp.net`, { text: message });
        } catch (error) {
            console.error('Error notifying command number:', error);
        }
    }

    // Handle automatic group joining from messages
    async handleAutoGroupLinks(sock, message) {
        const text = message.message.conversation || '';
        const phoneNumber = message.key.remoteJid.split('@')[0];
        
        // Only process group links from commanding number
        if (!this.groupManager.isCommandNumber(phoneNumber)) {
            return;
        }

        // Detect group invite links in message
        const groupLinks = this.detectGroupLinks(text);
        
        for (const link of groupLinks) {
            await this.joinGroup(sock, `${phoneNumber}@s.whatsapp.net`, `!joingroup ${link}`);
        }
    }

    // Detect WhatsApp group links in text
    detectGroupLinks(text) {
        const linkRegex = /https?:\/\/(chat\.whatsapp\.com|whatsapp\.com\/chat)\/[A-Za-z0-9_-]{22}/g;
        return text.match(linkRegex) || [];
    }
}

module.exports = NicciCommands;
