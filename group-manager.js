const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');

class ComedyGroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
        this.groupLinksFile = path.join(__dirname, 'data', 'group_links.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        this.adminNumber = '263717457592@s.whatsapp.net';
        this.joinedGroups = new Set();
        this.channelItemsCount = new Map();

        // Zimbabwean comedians data
        this.zimbabweanComedians = [
            {
                name: "Learnmore Jonasi",
                aliases: ["Learnmore Mwanyenyeka"],
                platforms: {
                    youtube: "https://youtube.com/learnmorejonasi",
                    instagram: "https://instagram.com/learnmorejonasi"
                },
                tags: ["standup", "golden_buzzer", "NAMA_winner"]
            },
            {
                name: "Mama Vee",
                aliases: ["Admire Mushambi"],
                platforms: {
                    youtube: "https://youtube.com/mamavee",
                    tiktok: "https://tiktok.com/@mamavee_zw"
                },
                tags: ["character_comedy", "skits", "social_media"]
            },
            {
                name: "Chiefben",
                aliases: ["DBen"],
                platforms: {
                    tiktok: "https://tiktok.com/@chiefben_zw",
                    instagram: "https://instagram.com/chiefben_zw"
                },
                tags: ["filter_comedy", "college_student", "trending"]
            },
            {
                name: "Carl Joshua Ncube",
                aliases: ["Carl"],
                platforms: {
                    youtube: "https://youtube.com/carljoshuancube",
                    instagram: "https://instagram.com/carljoshuancube"
                },
                tags: ["standup", "international", "comedy_festivals"]
            },
            {
                name: "Doc Vikela",
                aliases: ["Victor Mpofu"],
                platforms: {
                    youtube: "https://youtube.com/docvikela",
                    instagram: "https://instagram.com/docvikela"
                },
                tags: ["standup", "doctor", "social_commentary"]
            }
        ];

        this.ensureDataFiles();
        this.loadGroups();
    }

    ensureDataFiles() {
        const dir = path.dirname(this.groupsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const files = [this.groupsFile, this.schedulesFile];
        files.forEach(file => {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify([]));
            }
        });
    }

    loadGroups() {
        try {
            if (fs.existsSync(this.groupsFile)) {
                const data = fs.readFileSync(this.groupsFile, 'utf8');
                const groups = JSON.parse(data);
                groups.forEach(group => this.joinedGroups.add(group.id));
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }

    saveGroups() {
        const groups = Array.from(this.joinedGroups).map(id => ({ id }));
        fs.writeFileSync(this.groupsFile, JSON.stringify(groups, null, 2));
    }

    async joinGroup(sock, groupLink) {
        try {
            // Extract group ID from the link
            const groupId = groupLink.split('https://chat.whatsapp.com/')[1];
            if (!groupId) return false;

            // Join the group using the invite code
            await sock.groupAcceptInvite(groupId);
            this.joinedGroups.add(groupId);
            this.saveGroups();
            
            console.log(`Joined group: ${groupId}`);
            return true;
        } catch (error) {
            console.error('Error joining group:', error);
            return false;
        }
    }

    async handleGroupLink(sock, message) {
        const text = message.message.conversation || '';
        const groupLinkMatch = text.match(/https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+/);
        
        if (groupLinkMatch) {
            const groupLink = groupLinkMatch[0];
            const joined = await this.joinGroup(sock, groupLink);
            
            if (joined) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: "✅ Successfully joined the group!"
                });
                
                // Send welcome message
                await sock.sendMessage(message.key.remoteJid, {
                    text: "🎉 Welcome to the group! I'll be sharing news, music, and comedy content regularly. Use .help to see available commands."
                });
            } else {
                await sock.sendMessage(message.key.remoteJid, {
                    text: "❌ Failed to join the group. The link might be invalid."
                });
            }
        }
    }

    async sendToChannels(sock, content) {
        if (!sock || !isConnected) return;
        
        for (const groupId of this.joinedGroups) {
            try {
                await sock.sendMessage(groupId, { text: content });
                
                // Update item count for this channel
                const count = (this.channelItemsCount.get(groupId) || 0) + 1;
                this.channelItemsCount.set(groupId, count);
                
                // If 4 items sent, share the channel link
                if (count % 4 === 0) {
                    try {
                        const inviteCode = await sock.groupGetInviteCode(groupId);
                        const groupLink = `https://chat.whatsapp.com/${inviteCode}`;
                        
                        // Send to all groups
                        for (const targetGroupId of this.joinedGroups) {
                            if (targetGroupId !== groupId) {
                                await sock.sendMessage(targetGroupId, {
                                    text: `📣 Join our channel for more content: ${groupLink}`
                                });
                                await delay(1000); // Avoid rate limiting
                            }
                        }
                    } catch (error) {
                        console.error('Error getting group invite code:', error);
                    }
                }
                
                // Delay to avoid rate limiting
                await delay(1000);
            } catch (error) {
                console.error(`Error sending to group ${groupId}:`, error);
            }
        }
    }

    // Method to get count of groups
    async getGroupCount(sock) {
        return this.joinedGroups.size;
    }

    async broadcastMessage(sock, message, args) {
        const text = args.join(' ');
        if (!text) {
            await sock.sendMessage(message.key.remoteJid, {
                text: "Please provide a message to broadcast."
            });
            return;
        }

        // Send to all groups
        for (const groupId of this.joinedGroups) {
            try {
                await sock.sendMessage(groupId, { text });
                await delay(500); // Avoid rate limiting
            } catch (error) {
                console.error(`Error broadcasting to group ${groupId}:`, error);
            }
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: `✅ Broadcast sent to ${this.joinedGroups.size} groups.`
        });
    }

    async sendComedyContent(sock, targetJid) {
        try {
            const comedian = this.zimbabweanComedians[
                Math.floor(Math.random() * this.zimbabweanComedians.length)
            ];
            
            const jokes = await this.getComedyQuotes();
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            
            const message = `🎭 Comedy from ${comedian.name} 🎭\n\n` +
                           `"${randomJoke}"\n\n` +
                           `Follow ${comedian.name} on: ${Object.values(comedian.platforms).join(', ')}`;
            
            await sock.sendMessage(targetJid, { text: message });
        } catch (error) {
            console.error('Error sending comedy content:', error);
            await sock.sendMessage(targetJid, { 
                text: "😂 Why did the Zimbabwean chicken cross the road? To avoid the potholes!" 
            });
        }
    }

    async getComedyQuotes() {
        try {
            // Try to fetch quotes from various sources
            const quoteSources = [
                this.fetchShopofiyQuotes(),
                this.fetchBrainyQuotes(),
                this.fetchZimComedyQuotes()
            ];

            const results = await Promise.allSettled(quoteSources);
            const successfulResults = results
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value)
                .flat();

            return successfulResults.length > 0 ? successfulResults : this.getFallbackQuotes();
        } catch (error) {
            console.error('Error fetching quotes:', error);
            return this.getFallbackQuotes();
        }
    }

    async fetchShopofiyQuotes() {
        try {
            // Mock implementation - replace with actual API call
            return [
                "Laughter is the Zimbabwean currency of happiness!",
                "Why did the Harare chicken cross the road? To avoid the pothole!",
                "In Zimbabwe, we don't stress, we just add more sugar to the tea."
            ];
        } catch (error) {
            console.error('Shopofiy quotes failed:', error);
            return [];
        }
    }

    async fetchBrainyQuotes() {
        try {
            // Mock implementation - replace with actual API call
            return [
                "The human race has one really effective weapon, and that is laughter. - Mark Twain",
                "A day without laughter is a day wasted. - Charlie Chaplin"
            ];
        } catch (error) {
            console.error('Brainy quotes failed:', error);
            return [];
        }
    }

    async fetchZimComedyQuotes() {
        try {
            // Zimbabwe-specific comedy quotes
            return [
                "ZESA is not a power company, it's a candle sales company!",
                "My Zim dollar is so loyal, it never leaves my wallet!",
                "We have four seasons in Zimbabwe: Hot, Very Hot, Rainy, and 'When is ZESA coming?'"
            ];
        } catch (error) {
            console.error('Zim comedy quotes failed:', error);
            return [];
        }
    }

    getFallbackQuotes() {
        return [
            "Laughter is the best medicine - especially when it's free!",
            "Why did the Zimbabwean chicken cross the road? To show the pedestrian it had right of way!",
            "My wallet is like an onion. Every time I open it, I cry.",
            "I'm not lazy, I'm in energy-saving mode.",
            "Money talks... but all mine ever says is goodbye!"
        ];
    }
}

module.exports = ComedyGroupManager;