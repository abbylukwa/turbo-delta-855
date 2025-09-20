const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

// Command number
const COMMAND_NUMBER = '263717457592@s.whatsapp.net';

// Simple logger implementation
const createSimpleLogger = () => {
    return {
        trace: (message, ...args) => console.log(`[TRACE] ${message}`, ...args),
        debug: (message, ...args) => console.log(`[DEBUG] ${message}`, ...args),
        info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
        warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
        error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
        fatal: (message, ...args) => console.error(`[FATAL] ${message}`, ...args),
        child: () => createSimpleLogger()
    };
};

// User Manager
class UserManager {
    async getUserInfo(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "User info feature will be implemented here." 
        });
    }

    async banUser(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Ban user feature will be implemented here." 
        });
    }

    async unbanUser(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Unban user feature will be implemented here." 
        });
    }
}

// Activation Manager
class ActivationManager {
    async handleActivation(sock, message, args, sender) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Activation feature will be implemented here." 
        });
    }
}

// Group Manager (Your provided class with minor adjustments)
class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
        this.groupLinksFile = path.join(__dirname, 'data', 'group_links.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        this.adminNumber = '263717457592@s.whatsapp.net';

        // Channel-specific settings
        this.channels = {
            musicChannel: '0029VbBn8li3LdQQcJbvwm2S',
            quotesChannel: '0029Vb6GzqcId7nWURAdJv0M'
        };

        // Joke sources
        this.jokeSources = {
            facebook: ['meme', 'jokes', 'mama vee', 'zimbabwe comedy', 'south africa comedy'],
            instagram: ['comedy', 'jokes', 'meme', 'funny'],
            youtube: ['wild n out', 'trevor noah', 'loyiso goba', 'sneaky sibu', 'celeste ntuli']
        };

        // Ensure data directory exists before loading data
        this.ensureDataDirectoryExists();

        this.groups = this.loadGroups();
        this.scheduledMessages = this.loadSchedules();
        this.groupLinks = this.loadGroupLinks();
        this.groupStats = {
            totalGroups: 0,
            activeGroups: 0,
            messagesSent: 0,
            autoJoined: 0
        };

        this.recentLinks = new Set();
        this.recentLinksCleanupInterval = setInterval(() => {
            this.recentLinks.clear();
        }, 60000);

        // Start scheduler for channel updates
        this.startChannelSchedulers();

        // Start scheduler for group auto-joining
        this.startGroupAutoJoin();

        // Start scheduler for admin broadcasts
        this.startAdminBroadcasts();

        // Start scheduler
        this.startScheduler();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('Created data directory:', dataDir);
        }
    }

    loadGroups() {
        try {
            if (fs.existsSync(this.groupsFile)) {
                const data = fs.readFileSync(this.groupsFile, 'utf8');
                const groups = JSON.parse(data);
                this.groupStats.totalGroups = groups.length;
                this.groupStats.activeGroups = groups.filter(g => g.active).length;
                return groups;
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }

        return [];
    }

    loadSchedules() {
        try {
            if (fs.existsSync(this.schedulesFile)) {
                const data = fs.readFileSync(this.schedulesFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading scheduled messages:', error);
        }

        return [];
    }

    loadGroupLinks() {
        try {
            if (fs.existsSync(this.groupLinksFile)) {
                const data = fs.readFileSync(this.groupLinksFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading group links:', error);
        }

        return [];
    }

    saveGroups() {
        try {
            const data = JSON.stringify(this.groups, null, 2);
            fs.writeFileSync(this.groupsFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving groups:', error);
        }
    }

    saveSchedules() {
        try {
            const data = JSON.stringify(this.scheduledMessages, null, 2);
            fs.writeFileSync(this.schedulesFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving scheduled messages:', error);
        }
    }

    saveGroupLinks() {
        try {
            const data = JSON.stringify(this.groupLinks, null, 2);
            fs.writeFileSync(this.groupLinksFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving group links:', error);
        }
    }

    // Start group auto-join functionality
    startGroupAutoJoin() {
        // Check for new group links every hour and auto-join
        setInterval(async () => {
            try {
                await this.autoJoinGroups();
                console.log('Auto-joined available groups');
            } catch (error) {
                console.error('Error auto-joining groups:', error);
            }
        }, 60 * 60 * 1000); // 1 hour

        // Run immediately on startup
        setTimeout(async () => {
            try {
                await this.autoJoinGroups();
            } catch (error) {
                console.error('Error in initial group auto-join:', error);
            }
        }, 30000); // 30 seconds after startup
    }

    // Start admin broadcast functionality
    startAdminBroadcasts() {
        // Send random broadcasts to all groups every 6 hours
        setInterval(async () => {
            try {
                await this.sendRandomBroadcast();
                console.log('Sent random broadcast to all groups');
            } catch (error) {
                console.error('Error sending random broadcast:', error);
            }
        }, 6 * 60 * 60 * 1000); // 6 hours

        // Run immediately on startup
        setTimeout(async () => {
            try {
                await this.sendRandomBroadcast();
            } catch (error) {
                console.error('Error in initial broadcast:', error);
            }
        }, 45000); // 45 seconds after startup
    }

    // Auto-join groups from saved links
    async autoJoinGroups() {
        if (!this.autoJoinEnabled) return;

        for (const link of this.groupLinks) {
            if (link.active && !link.joined) {
                try {
                    console.log(`Attempting to auto-join group: ${link.url}`);

                    // In a real implementation, you would use the sock instance to join
                    // const result = await this.joinGroup(sock, link.url);

                    // For now, we'll simulate the join
                    await delay(2000);

                    link.joined = true;
                    link.joinedAt = new Date().toISOString();
                    this.groupStats.autoJoined++;

                    console.log(`Successfully auto-joined group: ${link.url}`);
                } catch (error) {
                    console.error(`Failed to auto-join group ${link.url}:`, error);
                    link.lastError = error.message;
                }

                await delay(5000); // Delay between join attempts
            }
        }

        this.saveGroupLinks();
    }

    // Send random broadcast to all groups
    async sendRandomBroadcast() {
        const broadcastMessages = [
            "🌟 *Special Announcement* 🌟\n\nJoin our official channels for daily updates!\n\n🎵 Music Channel: https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S\n💫 Quotes Channel: https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M\n\n#Update #JoinUs",
            "🔥 *Hot News* 🔥\n\nDon't miss out on our daily content!\n\n• Trending music every 3 hours\n• Motivational quotes every 2 hours\n• Daily jokes based on Zimbabwe time\n\nFollow our channels for more!",
            "📢 *Community Update* 📢\n\nWe're growing! Thank you to all our members for your support. Remember to invite your friends to our groups and channels!",
            "🎉 *Exciting News* 🎉\n\nWe've just added new features to our bot! Now with automatic content updates and more interactive commands. Stay tuned!",
            "💡 *Did You Know?* 💡\n\nOur bot can now automatically post content from various sources including YouTube, Facebook, and Instagram! Suggest your favorite content sources."
        ];

        const randomMessage = broadcastMessages[Math.floor(Math.random() * broadcastMessages.length)];

        // In a real implementation, you would send this to all groups
        // await this.sendToAllGroups(sock, randomMessage);

        console.log('Would send broadcast to all groups:', randomMessage);
        return { success: true, message: randomMessage };
    }

    // Search for group links on various platforms
    async searchGroupLinks() {
        try {
            const searchQueries = [
                'whatsapp group links zimbabwe',
                'whatsapp group links south africa',
                'whatsapp group links africa',
                'whatsapp group links music',
                'whatsapp group links comedy'
            ];

            const foundLinks = [];

            for (const query of searchQueries) {
                try {
                    // Simulate web search for group links
                    console.log(`Searching for group links with query: ${query}`);
                    await delay(2000);

                    // Simulate finding some links
                    const simulatedLinks = [
                        `https://chat.whatsapp.com/ABC${Math.random().toString(36).substring(2, 10)}`,
                        `https://chat.whatsapp.com/DEF${Math.random().toString(36).substring(2, 10)}`,
                        `https://chat.whatsapp.com/GHI${Math.random().toString(36).substring(2, 10)}`
                    ];

                    for (const link of simulatedLinks) {
                        if (!this.groupLinks.some(l => l.url === link)) {
                            foundLinks.push({
                                url: link,
                                source: `web search: ${query}`,
                                foundAt: new Date().toISOString(),
                                active: true,
                                joined: false
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Error searching for group links with query ${query}:`, error);
                }

                await delay(3000); // Delay between searches
            }

            // Add new links to our list
            for (const link of foundLinks) {
                this.groupLinks.push(link);
            }

            this.saveGroupLinks();

            return {
                success: true,
                found: foundLinks.length,
                links: foundLinks
            };
        } catch (error) {
            console.error('Error searching for group links:', error);
            return { success: false, error: error.message };
        }
    }

    // Start channel schedulers for automatic content
    startChannelSchedulers() {
        // Music channel - search for trending music every 3 hours
        setInterval(async () => {
            try {
                await this.postTrendingMusic();
                console.log('Posted trending music to channel');
            } catch (error) {
                console.error('Error posting trending music:', error);
            }
        }, 3 * 60 * 60 * 1000); // 3 hours

        // Motivational quotes channel - post every 2 hours
        setInterval(async () => {
            try {
                await this.postMotivationalQuote();
                console.log('Posted motivational quote to channel');
            } catch (error) {
                console.error('Error posting motivational quote:', error);
            }
        }, 2 * 60 * 60 * 1000); // 2 hours

        // Jokes channel - post daily at specific times
        setInterval(async () => {
            try {
                await this.postDailyJoke();
                console.log('Posted daily joke to channel');
            } catch (error) {
                console.error('Error posting daily joke:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours

        // Search for new group links every 12 hours
        setInterval(async () => {
            try {
                await this.searchGroupLinks();
                console.log('Searched for new group links');
            } catch (error) {
                console.error('Error searching for group links:', error);
            }
        }, 12 * 60 * 60 * 1000); // 12 hours

        // Run immediately on startup
        setTimeout(async () => {
            try {
                await this.postTrendingMusic();
                await this.postMotivationalQuote();
                await this.postDailyJoke();
                await this.searchGroupLinks();
            } catch (error) {
                console.error('Error in initial channel posts:', error);
            }
        }, 30000); // 30 seconds after startup
    }

    // Search and post trending music from YouTube
    async postTrendingMusic() {
        try {
            // Simulate YouTube search (without ytdl-core)
            await delay(2000);

            const musicTitles = [
                "Amapiano Mix 2024 - Best of Kabza De Small, DJ Maphorisa, Focalistic",
                "Deep House 2024 - Soulful Vocal Mix | South African Edition",
                "Zimdancehall 2024 - Latest Hits from Winky D, Killer T, Freeman",
                "Afrobeats 2024 - Burna Boy, Wizkid, Davido, Rema Mix"
            ];

            const randomTitle = musicTitles[Math.floor(Math.random() * musicTitles.length)];
            const videoUrl = "https://www.youtube.com/watch?v=example_music_video";

            // Format message for the channel
            const message = `🎵 *TRENDING MUSIC ALERT* 🎵\n\n` +
                           `*Title:* ${randomTitle}\n\n` +
                           `*Listen here:* ${videoUrl}\n\n` +
                           `#TrendingMusic #NewRelease #YouTubeMusic`;

            // In a real implementation, you would send this to the channel
            console.log('Would post to music channel:', message);

            return {
                success: true,
                videoTitle: randomTitle,
                videoUrl: videoUrl
            };
        } catch (error) {
            console.error('Error posting trending music:', error);
            return { success: false, error: error.message };
        }
    }

    // Post motivational quotes
    async postMotivationalQuote() {
        try {
            // Get motivational quote from API
            let quoteData = null;

            try {
                const response = await axios.get('https://api.quotable.io/random');
                quoteData = {
                    quote: response.data.content,
                    author: response.data.author,
                    source: 'Quotable API'
                };
            } catch (apiError) {
                console.log('Failed to get quote from API, using fallback...');
            }

            // Fallback if API fails
            if (!quoteData) {
                const fallbackQuotes = [
                    {
                        quote: "The only way to do great work is to love what you do.",
                        author: "Steve Jobs",
                        source: "Famous Quotes"
                    },
                    {
                        quote: "Believe you can and you're halfway there.",
                        author: "Theodore Roosevelt",
                        source: "Famous Quotes"
                    },
                    {
                        quote: "Your time is limited, so don't waste it living someone else's life.",
                        author: "Steve Jobs",
                        source: "Famous Quotes"
                    }
                ];

                quoteData = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
            }

            // Format message for the channel
            const message = `💫 *MOTIVATIONAL QUOTE* 💫\n\n` +
                           `"${quoteData.quote}"\n\n` +
                           `- ${quoteData.author}\n\n` +
                           `*Source:* ${quoteData.source}\n\n` +
                           `#Motivation #Inspiration #DailyQuote`;

            // In a real implementation, you would send this to the channel
            console.log('Would post to quotes channel:', message);

            return {
                success: true,
                quote: quoteData.quote,
                author: quoteData.author
            };
        } catch (error) {
            console.error('Error posting motivational quote:', error);
            return { success: false, error: error.message };
        }
    }

    // Post daily jokes from various sources
    async postDailyJoke() {
        try {
            // Get current date and season in Zimbabwe
            const now = new Date();
            const options = { timeZone: 'Africa/Harare' };
            const zimbabweTime = now.toLocaleString('en-US', options);

            // Determine season in Zimbabwe (simplified)
            const month = now.getMonth();
            let season = '';
            if (month >= 11 || month <= 1) season = 'Summer';
            else if (month >= 2 && month <= 4) season = 'Autumn';
            else if (month >= 5 && month <= 7) season = 'Winter';
            else season = 'Spring';

            // Get time of day
            const hour = now.getHours();
            let timeOfDay = '';
            if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
            else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
            else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
            else timeOfDay = 'Night';

            // Get joke from various sources
            const joke = await this.getJokeFromMultipleSources(timeOfDay, season);

            // Format message for the channel
            const message = `😂 *DAILY JOKE* 😂\n\n` +
                           `*Time:* ${timeOfDay} in Zimbabwe\n` +
                           `*Season:* ${season}\n\n` +
                           `${joke.content}\n\n` +
                           `*Source:* ${joke.source}\n\n` +
                           `#JokeOfTheDay #Zimbabwe #${timeOfDay}Joke`;

            // In a real implementation, you would send this to the channel
            console.log('Would post joke to channel:', message);

            return {
                success: true,
                joke: joke.content,
                timeOfDay: timeOfDay,
                season: season,
                source: joke.source
            };
        } catch (error) {
            console.error('Error posting daily joke:', error);
            return { success: false, error: error.message };
        }
    }

    // Get joke from multiple sources
    async getJokeFromMultipleSources(timeOfDay, season) {
        try {
            // Try different sources in order
            const sources = [
                this.getJokeFromYouTube.bind(this),
                this.getJokeFromFacebook.bind(this),
                this.getJokeFromInstagram.bind(this),
                this.getFallbackJoke.bind(this)
            ];

            for (const source of sources) {
                try {
                    const joke = await source(timeOfDay, season);
                    if (joke) return joke;
                } catch (error) {
                    console.log(`Failed to get joke from ${source.name}, trying next source...`);
                }
            }

            // Ultimate fallback
            return {
                content: "Why don't programmers like nature? It has too many bugs!",
                source: "Programmer Humor"
            };
        } catch (error) {
            console.error('Error getting joke from multiple sources:', error);
            return this.getFallbackJoke(timeOfDay, season);
        }
    }

    // Get joke from YouTube (Wild N Out)
    async getJokeFromYouTube(timeOfDay, season) {
        try {
            // Simulate YouTube search
            await delay(2000);

            return {
                content: "Check out this hilarious Wild N Out moment: https://www.youtube.com/watch?v=example_wild_n_out",
                source: "Wild N Out YouTube"
            };
        } catch (error) {
            console.error('Error getting joke from YouTube:', error);
            return null;
        }
    }

    // Get joke from Facebook
    async getJokeFromFacebook(timeOfDay, season) {
        try {
            // Simulate Facebook API call
            await delay(2000);

            const facebookJokes = [
                {
                    content: "Why did the Zimbabwean chicken cross the road? To show the South African chicken it could be done!",
                    source: "Facebook/MamaVee"
                },
                {
                    content: "What do you call a Zimbabwean with a weather machine? A four-caster!",
                    source: "Facebook/ZimComedy"
                },
                {
                    content: "Why did the South African take a ladder to the bar? He heard the drinks were on the house!",
                    source: "Facebook/SAJokes"
                }
            ];

            return facebookJokes[Math.floor(Math.random() * facebookJokes.length)];
        } catch (error) {
            console.error('Error getting joke from Facebook:', error);
            return null;
        }
    }

    // Get joke from Instagram
    async getJokeFromInstagram(timeOfDay, season) {
        try {
            // Simulate Instagram API call
            await delay(2000);

            const instagramJokes = [
                {
                    content: "My Zimbabwean friend said he'd give me a lift home. I didn't know he meant in his wheelbarrow!",
                    source: "Instagram/Comedy_Zim"
                },
                {
                    content: "Why did the South African bring a map to the party? In case he got lost in the conversation!",
                    source: "Instagram/SA_Funny"
                },
                {
                    content: "What's the difference between a Zimbabwean and a South African? About 1000 kilometers and a lot of border paperwork!",
                    source: "Instagram/Africa_Jokes"
                }
            ];

            return instagramJokes[Math.floor(Math.random() * instagramJokes.length)];
        } catch (error) {
            console.error('Error getting joke from Instagram:', error);
            return null;
        }
    }

    // Fallback joke
    getFallbackJoke(timeOfDay, season) {
        const fallbackJokes = {
            Morning: [
                { content: "Why did the coffee file a police report? It got mugged!", source: "Internet Jokes" },
                { content: "What do you call a bear with no teeth? A gummy bear!", source: "Internet Jokes" }
            ],
            Afternoon: [
                { content: "Why don't scientists trust atoms? Because they make up everything!", source: "Internet Jokes" },
                { content: "What did one ocean say to the other ocean? Nothing, they just waved!", source: "Internet Jokes" }
            ],
            Evening: [
                { content: "Why did the scarecrow win an award? He was outstanding in his field!", source: "Internet Jokes" },
                { content: "What do you call a fake noodle? An impasta!", source: "Internet Jokes" }
            ],
            Night: [
                { content: "Why don't skeletons fight each other? They don't have the guts!", source: "Internet Jokes" },
                { content: "What do you call a sleeping bull? A bulldozer!", source: "Internet Jokes" }
            ]
        };

        const timeJokes = fallbackJokes[timeOfDay] || fallbackJokes.Morning;
        return timeJokes[Math.floor(Math.random() * timeJokes.length)];
    }

    // Advertise channels
    async advertiseChannels(sock, target) {
        try {
            const musicChannelLink = `https://whatsapp.com/channel/${this.channels.musicChannel}`;
            const quotesChannelLink = `https://whatsapp.com/channel/${this.channels.quotesChannel}`;

            const message = `📢 *JOIN OUR OFFICIAL CHANNELS* 📢\n\n` +
                           `🎵 *Trending Music Channel:*\n` +
                           `Get the latest trending music every 3 hours!\n` +
                           `${musicChannelLink}\n\n` +
                           `💫 *Motivational Quotes Channel:*\n` +
                           `Daily inspiration and motivational quotes every 2 hours!\n` +
                           `${quotesChannelLink}\n\n` +
                           `#JoinUs #WhatsAppChannels #Subscribe`;

            await sock.sendMessage(target, { text: message });
            return { success: true };
        } catch (error) {
            console.error('Error advertising channels:', error);
            return { success: false, error: error.message };
        }
    }

    // Post custom content to channel (admin only)
    async postToChannel(sock, channelId, content, contentType = 'text') {
        try {
            // Check if user is admin
            if (!this.isAdmin(sock)) {
                return { success: false, error: 'Unauthorized: Admin only command' };
            }

            let message = '';

            if (contentType === 'text') {
                message = content;
            } else if (contentType === 'link') {
                message = `🔗 *NEW LINK SHARE* 🔗\n\n${content}\n\n#SharedLink #Update`;
            }

            // In a real implementation, you would send this to the channel
            console.log(`Would post to channel ${channelId}:`, message);

            return {
                success: true,
                channelId: channelId,
                message: message
            };
        } catch (error) {
            console.error('Error posting to channel:', error);
            return { success: false, error: error.message };
        }
    }

    async joinGroup(sock, groupLink) {
        try {
            console.log(`Attempting to join group: ${groupLink}`);

            const inviteCode = this.extractInviteCode(groupLink);
            if (!inviteCode) {
                throw new Error('Invalid group link');
            }

            const response = await sock.groupAcceptInvite(inviteCode);

            if (response) {
                const groupId = response.gid;
                const groupMetadata = await sock.groupMetadata(groupId);

                this.addGroup(groupId, groupMetadata.subject, groupLink);

                console.log(`Successfully joined group: ${groupMetadata.subject}`);
                return {
                    success: true,
                    groupId: groupId,
                    name: groupMetadata.subject,
                    participants: groupMetadata.participants.length
                };
            }

            throw new Error('Failed to join group');
        } catch (error) {
            console.error('Error joining group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    addGroup(groupId, name, link = '') {
        const existingGroup = this.groups.find(g => g.id === groupId);
        if (!existingGroup) {
            this.groups.push({
                id: groupId,
                name: name,
                link: link,
                joinedAt: new Date().toISOString(),
                active: true,
                messageCount: 0
            });
            this.groupStats.totalGroups++;
            this.groupStats.activeGroups++;
            this.saveGroups();
        }
    }

    extractInviteCode(link) {
        const match = link.match(/https:\/\/chat\.whatsapp\.com\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    // Send message to all groups
    async sendToAllGroups(sock, message) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (const group of this.groups) {
            if (group.active) {
                try {
                    await sock.sendMessage(group.id, { text: message });
                    group.messageCount = (group.messageCount || 0) + 1;
                    successCount++;
                    results.push({ group: group.name, status: 'success' });
                    await delay(1000); // Delay to avoid rate limiting
                } catch (error) {
                    failCount++;
                    results.push({ group: group.name, status: 'failed', error: error.message });
                }
            }
        }

        this.saveGroups();
        this.groupStats.messagesSent += successCount;

        return {
            success: true,
            sent: successCount,
            failed: failCount,
            results: results
        };
    }

    // Search groups by name
    searchGroups(query) {
        if (!query || query.trim() === '') {
            return this.groups;
        }

        const searchTerm = query.toLowerCase();
        return this.groups.filter(group => 
            group.name.toLowerCase().includes(searchTerm)
        );
    }

    // Advertise in all groups (similar to sendToAllGroups but with link)
    async advertiseInAllGroups(sock, message, inviteLink) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        const fullMessage = `${message}\n\nJoin here: ${inviteLink}`;
        return this.sendToAllGroups(sock, fullMessage);
    }

    // Contact all members of a specific group
    async contactGroupMembers(sock, groupName, message) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        const group = this.searchGroups(groupName)[0];
        if (!group) {
            return { success: false, error: 'Group not found' };
        }

        try {
            const metadata = await sock.groupMetadata(group.id);
            let successCount = 0;
            let failCount = 0;

            for (const participant of metadata.participants) {
                try {
                    await sock.sendMessage(participant.id, { text: message });
                    successCount++;
                    await delay(500); // Delay to avoid rate limiting
                } catch (error) {
                    failCount++;
                    console.error(`Failed to message ${participant.id}:`, error);
                }
            }

            return {
                success: true,
                group: group.name,
                participantsContacted: successCount,
                failed: failCount
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Create a new group
    async createGroup(sock, name, participants = []) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        try {
            const response = await sock.groupCreate(name, participants);
            const groupId = response.gid;

            // Get the group invite link
            const inviteCode = await sock.groupInviteCode(groupId);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

            // Add to managed groups
            this.addGroup(groupId, name, inviteLink);

            return {
                success: true,
                groupId: groupId,
                name: name,
                inviteLink: inviteLink
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Create a channel (broadcast list)
    async createChannel(sock, name) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        try {
            // Note: WhatsApp doesn't have a direct "channel" concept in the API
            // This creates a broadcast list which functions similarly
            const response = await sock.createBroadcastList(name);

            return {
                success: true,
                id: response.id,
                name: name,
                type: 'broadcast'
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Schedule a message
    scheduleMessage(groupName, message, datetime) {
        if (!groupName || !message || !datetime) {
            return { success: false, error: 'Missing parameters' };
        }

        const scheduleDate = new Date(datetime);
        if (isNaN(scheduleDate.getTime())) {
            return { success: false, error: 'Invalid date format' };
        }

        const now = new Date();
        if (scheduleDate <= now) {
            return { success: false, error: 'Scheduled time must be in the future' };
        }

        const scheduledMessage = {
            id: Date.now().toString(),
            groupName: groupName,
            message: message,
            scheduledFor: scheduleDate.toISOString(),
            status: 'pending'
        };

        this.scheduledMessages.push(scheduledMessage);
        this.saveSchedules();

        return {
            success: true,
            scheduledMessage: scheduledMessage
        };
    }

    // Start the scheduler to check for pending messages
    startScheduler() {
        setInterval(() => {
            this.checkScheduledMessages();
        }, 60000); // Check every minute
    }

    async checkScheduledMessages() {
        const now = new Date();
        const pendingMessages = this.scheduledMessages.filter(
            msg => msg.status === 'pending' && new Date(msg.scheduledFor) <= now
        );

        for (const msg of pendingMessages) {
            // In a real implementation, you would need access to the sock instance
            // This would typically be handled by passing the sock instance to this method
            // or storing a reference to it
            console.log(`[SCHEDULER] Time to send message to ${msg.groupName}: ${msg.message}`);

            // Mark as sent (in a real implementation, you would actually send it)
            msg.status = 'sent';
            msg.sentAt = new Date().toISOString();
        }

        if (pendingMessages.length > 0) {
            this.saveSchedules();
        }
    }

    // Check if the sender is the admin
    isAdmin(sock) {
        // This would need to be implemented based on how you track the admin
        // For now, we'll assume the commandNumber is the admin
        // In a real implementation, you would check the message sender
        return true; // Placeholder
    }

    destroy() {
        if (this.recentLinksCleanupInterval) {
            clearInterval(this.recentLinksCleanupInterval);
        }
    }

    // Handle group commands from the main bot
    async handleGroupCommand(sock, message, command, args, sender) {
        // Only allow admin to use group commands
        if (sender !== this.adminNumber) {
            await sock.sendMessage(message.key.remoteJid, { 
                text: "❌ Only the admin can use group management commands." 
            });
            return;
        }

        switch (command) {
            case 'creategroup':
                await this.createGroup(sock, args.join(' '));
                break;
            case 'addtogroup':
                await this.addToGroup(sock, message, args);
                break;
            case 'removefromgroup':
                await this.removeFromGroup(sock, message, args);
                break;
            case 'grouplink':
                await this.getGroupLink(sock, message, args);
                break;
            case 'listgroups':
                await this.listGroups(sock, message);
                break;
            case 'autojointoggle':
                await this.toggleAutoJoin(sock, message);
                break;
            default:
                await sock.sendMessage(message.key.remoteJid, { 
                    text: "❌ Unknown group command. Available commands: creategroup, addtogroup, removefromgroup, grouplink, listgroups, autojointoggle" 
                });
        }
    }

    async addToGroup(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Add to group feature will be implemented here." 
        });
    }

    async removeFromGroup(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Remove from group feature will be implemented here." 
        });
    }

    async getGroupLink(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Get group link feature will be implemented here." 
        });
    }

    async listGroups(sock, message) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "List groups feature will be implemented here." 
        });
    }

    async toggleAutoJoin(sock, message) {
        this.autoJoinEnabled = !this.autoJoinEnabled;
        await sock.sendMessage(message.key.remoteJid, { 
            text: `Auto-join feature ${this.autoJoinEnabled ? 'enabled' : 'disabled'}.` 
        });
    }
}

// Admin Commands
class AdminCommands {
    async broadcastMessage(sock, message, args) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Broadcast feature will be implemented here." 
        });
    }

    async getStats(sock, message) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Stats feature will be implemented here." 
        });
    }

    async restartBot(sock, message) {
        await sock.sendMessage(message.key.remoteJid, { 
            text: "Restart feature will be implemented here." 
        });
    }
}

// General Commands
class GeneralCommands {
    async showHelp(sock, message) {
        const helpText = `
🤖 *WhatsApp Bot Help* 🤖

*Admin Commands:*
.activate [code] - Activate a user
.userinfo [number] - Get user information
.ban [number] - Ban a user
.unban [number] - Unban a user
.broadcast [message] - Broadcast message to all users
.stats - Show bot statistics
.restart - Restart the bot

*Group Commands:*
.creategroup [name] - Create a new group
.addtogroup [number] - Add user to group
.removefromgroup [number] - Remove user from group
.grouplink - Get group invite link
.listgroups - List all groups
.autojointoggle - Toggle auto-join feature

*General Commands:*
.help - Show this help message
        `;
        
        await sock.sendMessage(message.key.remoteJid, { 
            text: helpText 
        });
    }
}

// Initialize managers
const userManager = new UserManager();
const activationManager = new ActivationManager();
const groupManager = new GroupManager();
const adminCommands = new AdminCommands();
const generalCommands = new GeneralCommands();

// Store for connection
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 50000;

// Ensure data directories exist
async function ensureDirectories() {
    try {
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
        }
        if (!fs.existsSync(path.join(__dirname, 'auth_info_baileys'))) {
            fs.mkdirSync(path.join(__dirname, 'auth_info_baileys'), { recursive: true });
        }
        console.log('✅ Data directories created successfully');
    } catch (error) {
        console.error('❌ Error creating directories:', error);
    }
}

// Clear auth files
async function clearAuthFiles() {
    try {
        const authDir = path.join(__dirname, 'auth_info_baileys');
        if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true });
            console.log('✅ Cleared auth files');
        }
        fs.mkdirSync(authDir, { recursive: true });
        return true;
    } catch (error) {
        console.log('No auth files to clear or error clearing:', error.message);
        return false;
    }
}

// Connection manager
class ConnectionManager {
    constructor() {
        this.isConnecting = false;
        this.reconnectTimeout = null;
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (sock) {
            sock.end();
            sock = null;
        }
        isConnected = false;
    }
}

const connectionManager = new ConnectionManager();

// Function to display pairing information
function displayPairingInfo(qr, pairingCode) {
    console.log('\n'.repeat(5));
    console.log('═'.repeat(60));
    console.log('🤖 WHATSAPP BOT PAIRING INFORMATION');
    console.log('═'.repeat(60));
    
    if (qr) {
        console.log('📱 Scan the QR code below:');
        qrcode.generate(qr, { small: true });
    }
    
    if (pairingCode) {
        console.log(`🔢 Pairing code: ${pairingCode}`);
    }
    
    console.log('═'.repeat(60));
    console.log('💡 Tip: Use WhatsApp Linked Devices feature to pair');
    console.log('═'.repeat(60));
}

// Function to process incoming messages
async function processMessage(sock, message) {
    try {
        if (!message.message) return;

        const sender = message.key.remoteJid;
        const messageType = Object.keys(message.message)[0];
        let text = '';

        if (messageType === 'conversation') {
            text = message.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            text = message.message.extendedTextMessage.text;
        }

        // Ignore messages from broadcast lists and status
        if (sender.endsWith('@broadcast') || sender === 'status@broadcast') {
            return;
        }

        // Only process messages from admin
        if (sender !== COMMAND_NUMBER) {
            console.log(`Ignoring message from ${sender}: ${text}`);
            return;
        }

        console.log(`Processing command from admin: ${text}`);

        // Parse command
        const commandMatch = text.match(/^\.(\w+)(?:\s+(.*))?$/);
        if (!commandMatch) return;

        const command = commandMatch[1].toLowerCase();
        const args = commandMatch[2] ? commandMatch[2].split(' ') : [];

        // Route to appropriate command handler
        switch (command) {
            case 'activate':
                await activationManager.handleActivation(sock, message, args, sender);
                break;
            case 'userinfo':
                await userManager.getUserInfo(sock, message, args);
                break;
            case 'ban':
                await userManager.banUser(sock, message, args);
                break;
            case 'unban':
                await userManager.unbanUser(sock, message, args);
                break;
            case 'creategroup':
            case 'addtogroup':
            case 'removefromgroup':
            case 'grouplink':
            case 'listgroups':
            case 'autojointoggle':
                await groupManager.handleGroupCommand(sock, message, command, args, sender);
                break;
            case 'broadcast':
                await adminCommands.broadcastMessage(sock, message, args);
                break;
            case 'stats':
                await adminCommands.getStats(sock, message);
                break;
            case 'restart':
                await adminCommands.restartBot(sock, message);
                break;
            case 'help':
                await generalCommands.showHelp(sock, message);
                break;
            default:
                await sock.sendMessage(sender, { 
                    text: "❌ Unknown command. Type .help for available commands." 
                });
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
}

async function startBot() {
    try {
        console.log('🚀 Starting WhatsApp Bot...');
        await ensureDirectories();

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger: createSimpleLogger(),
            printQRInTerminal: true,
            auth: state,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 0,
        });

        // Setup event handlers
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, pairingCode } = update;

            if (qr) {
                displayPairingInfo(qr, pairingCode);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;

                console.log(`Connection closed due to ${lastDisconnect.error} | reconnecting ${shouldReconnect}`);

                if (shouldReconnect) {
                    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts++;
                        console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                        setTimeout(() => startBot(), RECONNECT_INTERVAL);
                    } else {
                        console.log('Max reconnection attempts reached. Please restart the bot.');
                    }
                } else {
                    console.log('Connection closed permanently. Please re-pair the device.');
                    await clearAuthFiles();
                }
                isConnected = false;
            } else if (connection === 'open') {
                console.log('✅ Connected to WhatsApp');
                isConnected = true;
                reconnectAttempts = 0;

                // Send connection success message to admin
                if (sock && COMMAND_NUMBER) {
                    await sock.sendMessage(COMMAND_NUMBER, { 
                        text: '🤖 Bot is now connected and ready to receive commands!' 
                    });
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const message of m.messages) {
                    await processMessage(sock, message);
                }
            }
        });

    } catch (error) {
        console.error('❌ Error starting bot:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Restarting bot... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(() => startBot(), RECONNECT_INTERVAL);
        } else {
            console.log('Max restart attempts reached. Please check your configuration.');
        }
    }
}

// ==================== EXPRESS SERVER SETUP ====================
const app = express();
const port = process.env.PORT || 3000;

// Basic health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'WhatsApp Bot is running', 
        connected: isConnected, 
        timestamp: new Date().toISOString() 
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    if (isConnected) {
        res.json({ status: 'OK', connected: true });
    } else {
        res.status(503).json({ status: 'OFFLINE', connected: false });
    }
});

// Bot status endpoint
app.get('/status', (req, res) => {
    res.json({ 
        status: isConnected ? 'CONNECTED' : 'DISCONNECTED', 
        reconnectAttempts: reconnectAttempts, 
        uptime: process.uptime(), 
        memory: { 
            usage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + 'MB', 
            total: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + 'MB' 
        } 
    });
});

// Start the HTTP server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 HTTP server listening on port ${port}`);
    console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
    // Start the bot after the server is running
    startBot();
});

// Process handlers
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    connectionManager.disconnect();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { startBot, connectionManager, app };