const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const ytdl = require('ytdl-core');

class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
        this.groupLinksFile = path.join(__dirname, 'data', 'group_links.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        this.adminNumber = '263717457592@s.whatsapp.net';
        
        // Comedians data
        this.comedians = [
            {
                name: "Learnmore Jonasi",
                socialMedia: {
                    youtube: "https://youtube.com/...",
                    instagram: "https://instagram.com/...",
                    tiktok: "https://tiktok.com/..."
                }
            },
            {
                name: "Mama Vee",
                socialMedia: {
                    youtube: "https://youtube.com/...",
                    instagram: "https://instagram.com/...",
                    tiktok: "https://tiktok.com/..."
                }
            },
            // Add other comedians similarly
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
            // Fetch quotes from shopofiy.com
            const shopofiyResponse = await axios.get('https://shopofiy.com/api/quotes');
            const shopofiyQuotes = shopofiyResponse.data;
            
            // Fetch quotes from brainyquote.com
            const brainyQuoteResponse = await axios.get('https://www.brainyquote.com/api/quotes/random');
            const brainyQuotes = brainyQuoteResponse.data;
            
            return [...shopofiyQuotes, ...brainyQuotes];
        } catch (error) {
            console.error('Error fetching quotes:', error);
            return this.getFallbackQuotes();
        }
    }

    getFallbackQuotes() {
        // Fallback quotes if APIs fail
        return [
            "Laughter is the best medicine - especially when it's free!",
            "Why did the Zimbabwean chicken cross the road? To show the pedestrian it had right of way!",
            "My wallet is like an onion. Every time I open it, I cry.",
            "I'm not lazy, I'm in energy-saving mode.",
            "Money talks... but all mine ever says is goodbye!"
        ];
    }

    async getComedyVideos(comedianName) {
        try {
            // This would be replaced with actual API calls to YouTube, Instagram, or TikTok
            // For now, we'll return some placeholder data
            const comedian = this.comedians.find(c => c.name === comedianName);
            if (comedian) {
                return [
                    {
                        url: `${comedian.socialMedia.youtube}/video1`,
                        type: 'video',
                        duration: 30
                    },
                    {
                        url: `${comedian.socialMedia.instagram}/reel1`,
                        type: 'reel',
                        duration: 15
                    }
                ];
            }
            return [];
        } catch (error) {
            console.error('Error fetching comedy videos:', error);
            return [];
        }
    }

    async sendScheduledComedyContent(sock) {
        for (const schedule of this.schedules.schedules) {
            if (this.shouldSendContent(schedule)) {
                // 70% chance to send video, 30% to send text
                const sendVideo = Math.random() < 0.7;
                
                if (sendVideo) {
                    const randomComedian = this.comedians[Math.floor(Math.random() * this.comedians.length)];
                    const videos = await this.getComedyVideos(randomComedian.name);
                    
                    if (videos.length > 0) {
                        const video = videos[Math.floor(Math.random() * videos.length)];
                        await this.sendVideoToGroup(sock, schedule.groupId, video.url);
                    } else {
                        // Fallback to text if no videos available
                        const quotes = await this.getComedyQuotes();
                        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                        await this.sendMessageToGroup(sock, schedule.groupId, randomQuote);
                    }
                } else {
                    const quotes = await this.getComedyQuotes();
                    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                    await this.sendMessageToGroup(sock, schedule.groupId, randomQuote);
                }
                
                // Update last sent time
                schedule.lastSent = new Date().toISOString();
            }
        }
        
        this.saveData();
    }

    shouldSendContent(schedule) {
        if (!schedule.lastSent) return true;
        
        const lastSent = new Date(schedule.lastSent);
        const now = new Date();
        const frequencyMs = schedule.frequency * 60 * 60 * 1000; // Convert hours to ms
        
        return (now - lastSent) >= frequencyMs;
    }

    async sendVideoToGroup(sock, groupId, videoUrl) {
        try {
            // Download video
            const videoPath = path.join(__dirname, 'temp', `video_${Date.now()}.mp4`);
            const writer = fs.createWriteStream(videoPath);
            
            const response = await axios({
                url: videoUrl,
                method: 'GET',
                responseType: 'stream'
            });
            
            response.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            
            // Send video to group
            await sock.sendMessage(groupId, {
                video: fs.readFileSync(videoPath),
                caption: "😂 Zimbabwean Comedy 😂"
            });
            
            // Clean up
            fs.unlinkSync(videoPath);
        } catch (error) {
            console.error('Error sending video:', error);
            // Fallback to text
            const quotes = await this.getComedyQuotes();
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            await this.sendMessageToGroup(sock, groupId, randomQuote);
        }
    }

    async sendMessageToGroup(sock, groupId, message) {
        try {
            await sock.sendMessage(groupId, { text: message });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    // Other GroupManager methods for group management would go here
    // (addGroup, removeGroup, scheduleContent, etc.)
}

module.exports = GroupManager;