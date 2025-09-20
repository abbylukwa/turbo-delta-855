const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const ytdl = require('ytdl-core');

class ComedyGroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
        this.groupLinksFile = path.join(__dirname, 'data', 'group_links.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        this.adminNumber = '263717457592@s.whatsapp.net';
        
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
            // Add other comedians similarly...
        ];
        
        this.ensureDataFiles();
        this.loadData();
    }

    ensureDataFiles() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const files = {
            [this.groupsFile]: { groups: [] },
            [this.schedulesFile]: { schedules: [] },
            [this.groupLinksFile]: { links: [] }
        };

        for (const [file, defaultData] of Object.entries(files)) {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
            }
        }
    }

    loadData() {
        this.groups = JSON.parse(fs.readFileSync(this.groupsFile, 'utf8'));
        this.schedules = JSON.parse(fs.readFileSync(this.schedulesFile, 'utf8'));
        this.groupLinks = JSON.parse(fs.readFileSync(this.groupLinksFile, 'utf8'));
    }

    saveData() {
        fs.writeFileSync(this.groupsFile, JSON.stringify(this.groups, null, 2));
        fs.writeFileSync(this.schedulesFile, JSON.stringify(this.schedules, null, 2));
        fs.writeFileSync(this.groupLinksFile, JSON.stringify(this.groupLinks, null, 2));
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

    getRandomComedian() {
        return this.zimbabweanComedians[
            Math.floor(Math.random() * this.zimbabweanComedians.length)
        ];
    }

    async sendDailyComedy(sock) {
        try {
            console.log("Sending daily comedy content...");
            
            for (const group of this.groups.groups) {
                // 70% chance for video, 30% for text
                const sendVideo = Math.random() < 0.7;
                
                if (sendVideo) {
                    await this.sendComedyVideo(sock, group.id);
                } else {
                    await this.sendComedyQuote(sock, group.id);
                }
                
                // Add delay to avoid rate limiting
                await delay(2000);
            }
        } catch (error) {
            console.error('Error in sendDailyComedy:', error);
        }
    }

    async sendComedyVideo(sock, groupId) {
        try {
            const comedian = this.getRandomComedian();
            const message = `😂 Zimbabwean Comedy Spotlight: ${comedian.name} 😂\n\n` +
                           `Enjoy this clip from one of Zimbabwe's finest comedians!`;
            
            await sock.sendMessage(groupId, { text: message });
            
            // In a real implementation, you would fetch and send actual video
            console.log(`Would send video from ${comedian.name} to group ${groupId}`);
            
        } catch (error) {
            console.error('Error sending comedy video:', error);
            // Fallback to text
            await this.sendComedyQuote(sock, groupId);
        }
    }

    async sendComedyQuote(sock, groupId) {
        try {
            const quotes = await this.getComedyQuotes();
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            const comedian = this.getRandomComedian();
            
            const message = `🎭 Comedy Quote of the Day 🎭\n\n` +
                           `"${randomQuote}"\n\n` +
                           `- Inspired by the style of ${comedian.name}`;
            
            await sock.sendMessage(groupId, { text: message });
        } catch (error) {
            console.error('Error sending comedy quote:', error);
        }
    }

    // Method to add a group to receive comedy content
    addGroup(groupId, groupName) {
        const existingGroup = this.groups.groups.find(g => g.id === groupId);
        if (!existingGroup) {
            this.groups.groups.push({
                id: groupId,
                name: groupName,
                joinedAt: new Date().toISOString()
            });
            this.saveData();
            return true;
        }
        return false;
    }

    // Method to remove a group
    removeGroup(groupId) {
        const initialLength = this.groups.groups.length;
        this.groups.groups = this.groups.groups.filter(g => g.id !== groupId);
        
        if (this.groups.groups.length !== initialLength) {
            this.saveData();
            return true;
        }
        return false;
    }

    // Method to list all Zimbabwean comedians
    listComedians() {
        return this.zimbabweanComedians.map(comedian => 
            `${comedian.name} (${comedian.aliases.join(', ')}) - ${Object.keys(comedian.platforms).join(', ')}`
        ).join('\n');
    }
}

module.exports = ComedyGroupManager;