// group-manager-web.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const instagramGetUrl = require('instagram-url-direct');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class GroupManager {
    constructor(client) {
        this.client = client;
        this.isRunning = false;
        this.intervals = [];
        this.timeouts = [];
        this.downloadDir = path.join(__dirname, 'downloads');

        // Your WhatsApp Channels
        this.channels = {
            music: '0029VbBn8li3LdQQcJbvwm2S@g.us', // Music channel ID
            entertainment: '0029Vb6GzqcId7nWURAdJv0M@g.us' // Entertainment channel ID
        };

        this.channelLinks = {
            music: 'https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S',
            entertainment: 'https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M'
        };

        // Store all joined groups
        this.joinedGroups = new Set();

        // Admins (updated for WhatsApp Web.js format - @c.us)
        this.constantAdmins = [
            '263775156210@c.us', // 0775156210
            '27614159817@c.us', 
            '263717457592@c.us',
            '263777627210@c.us'
        ];

        this.ensureDownloadDir();

        // Comedians databases with social media handles
        this.zimComedians = [
            { name: 'Carl Joshua Ncube', instagram: 'carljoshuancube', youtube: '@carljoshuancube' },
            { name: 'Doc Vikela', instagram: 'docvikela', youtube: '@docvikela' },
            { name: 'Long John', instagram: 'longjohncomedian', youtube: '@longjohn' },
            { name: 'Clive Chigubu', instagram: 'clivechigubu', youtube: '@clivechigubu' },
            { name: 'Q Dube', instagram: 'qudube', youtube: '@qudube' },
            { name: 'Mai Titi', instagram: 'maititi', youtube: '@maititi' },
            { name: 'Madam Boss', instagram: 'madamboss', youtube: '@madamboss' },
            { name: 'Comic Pastor', instagram: 'comicpastor', youtube: '@comicpastor' },
            { name: 'King Kandoro', instagram: 'kingkandoro', youtube: '@kingkandoro' },
            { name: 'Bhutisi', instagram: 'bhutisi', youtube: '@bhutisi' }
        ];

        this.saComedians = [
            { name: 'Trevor Noah', instagram: 'trevornoah', youtube: '@trevornoah' },
            { name: 'Loyiso Gola', instagram: 'loyisogola', youtube: '@loyisogola' },
            { name: 'Skhumba Hlophe', instagram: 'skhumbahlophe', youtube: '@skhumbahlophe' },
            { name: 'Tumi Morake', instagram: 'tumi_morake', youtube: '@tumimorake' },
            { name: 'David Kau', instagram: 'davidkau', youtube: '@davidkau' },
            { name: 'Riaad Moosa', instagram: 'riaadmoosa', youtube: '@riaadmoosa' },
            { name: 'Kagiso Lediga', instagram: 'kagisolediga', youtube: '@kagisolediga' },
            { name: 'Celeste Ntuli', instagram: 'celestentuli', youtube: '@celestentuli' },
            { name: 'Nik Rabinowitz', instagram: 'nikrabinowitz', youtube: '@nikrabinowitz' },
            { name: 'Marc Lottering', instagram: 'marclottering', youtube: '@marclottering' }
        ];

        this.saturdayShows = [
            'Wild N Out', 'America\'s Got Talent', 'The Masked Singer',
            'Lip Sync Battle', 'So You Think You Can Dance', 'World of Dance', 'The Voice'
        ];

        this.newsSources = [
            { name: 'BBC News Africa', url: 'https://www.bbc.com/africa' },
            { name: 'Al Jazeera English', url: 'https://www.aljazeera.com' },
            { name: 'SABC News', url: 'https://www.sabcnews.com' },
            { name: 'NTV Kenya', url: 'https://www.ntv.co.ke' },
            { name: 'Channels Television', url: 'https://www.channelstv.com' },
            { name: 'eNCA', url: 'https://www.enca.com' },
            { name: 'Africanews', url: 'https://www.africanews.com' }
        ];

        this.musicCharts = [
            'Billboard', 'Spotify Charts', 'Apple Music Top 100',
            'Shazam Global Top 200', 'YouTube Music Trending'
        ];

        this.musicSchedule = {
            'Monday': [
                ['06:00-09:00', 'Acoustic'],
                ['09:00-12:00', 'Pop'],
                ['12:00-15:00', 'Afrobeat'],
                ['15:00-18:00', 'R&B/Soul'],
                ['18:00-22:00', 'Chill/Lo-fi']
            ],
            'Tuesday': [
                ['06:00-09:00', 'Jazz'],
                ['09:00-12:00', 'Dancehall'],
                ['12:00-15:00', 'Amapiano'],
                ['15:00-18:00', 'Hip-Hop'],
                ['18:00-22:00', 'Classical']
            ],
            'Wednesday': [
                ['06:00-09:00', 'Gospel'],
                ['09:00-12:00', 'Country'],
                ['12:00-15:00', 'Pop'],
                ['15:00-18:00', 'Trap'],
                ['18:00-22:00', 'Afro-soul']
            ],
            'Thursday': [
                ['06:00-09:00', 'Lo-fi'],
                ['09:00-12:00', 'K-Pop'],
                ['12:00-15:00', 'Afrobeat'],
                ['15:00-18:00', 'EDM'],
                ['18:00-22:00', 'R&B']
            ],
            'Friday': [
                ['06:00-09:00', 'House'],
                ['09:00-12:00', 'Hip-Hop'],
                ['12:00-15:00', 'Reggae'],
                ['15:00-18:00', 'Amapiano'],
                ['18:00-22:00', 'Party Mix']
            ],
            'Saturday': [
                ['06:00-09:00', 'Chillhop'],
                ['09:00-12:00', 'Afro-fusion'],
                ['12:00-15:00', 'ZimDancehall'],
                ['15:00-18:00', 'Gqom'],
                ['18:00-22:00', 'Dance/Electronic']
            ],
            'Sunday': [
                ['06:00-09:00', 'Worship'],
                ['09:00-12:00', 'Soft Rock'],
                ['12:00-15:00', 'Instrumentals'],
                ['15:00-18:00', 'Jazz'],
                ['18:00-22:00', 'Soul/Neo-Soul']
            ]
        };

        this.hypingQuotes = [
            "🔥 Stay focused and never give up! 🔥",
            "💪 Your potential is endless! Keep pushing! 💪",
            "🚀 Great things never come from comfort zones! 🚀",
            "🌟 Believe you can and you're halfway there! 🌟",
            "🎯 Success is walking from failure to failure with no loss of enthusiasm! 🎯"
        ];

        // YouTube search queries for each genre
        this.genreQueries = {
            'Acoustic': ['acoustic cover 2024', 'acoustic songs', 'unplugged music'],
            'Pop': ['pop hits 2024', 'top 40 pop', 'billboard pop'],
            'Afrobeat': ['afrobeat 2024', 'burna boy', 'wizkid', 'davido'],
            'R&B/Soul': ['r&b 2024', 'soul music', 'rnb hits'],
            'Chill/Lo-fi': ['lofi hip hop', 'chill beats', 'study music'],
            'Jazz': ['jazz music', 'smooth jazz', 'jazz instrumental'],
            'Dancehall': ['dancehall 2024', 'shatta wale', 'stonebwoy'],
            'Amapiano': ['amapiano 2024', 'kabza de small', 'djmaphorisa'],
            'Hip-Hop': ['hip hop 2024', 'rap music', 'new rap'],
            'Classical': ['classical music', 'mozart', 'beethoven'],
            'Gospel': ['gospel music 2024', 'worship songs', 'christian music'],
            'Country': ['country music 2024', 'country hits', 'nashville'],
            'Trap': ['trap music 2024', 'trap beats', 'trap hiphop'],
            'Afro-soul': ['afro soul', 'soulful afro', 'afro r&b'],
            'K-Pop': ['kpop 2024', 'bts', 'blackpink'],
            'EDM': ['edm 2024', 'electronic dance', 'festival music'],
            'Reggae': ['reggae 2024', 'bob marley', 'reggae hits'],
            'Party Mix': ['party music', 'dance mix', 'club hits'],
            'Chillhop': ['chillhop', 'jazz hop', 'lofi jazz'],
            'Afro-fusion': ['afro fusion', 'afro pop', 'african fusion'],
            'ZimDancehall': ['zimbabwe dancehall', 'winky d', 'sniper storm'],
            'Gqom': ['gqom music', 'south african house', 'gqom beats'],
            'Dance/Electronic': ['dance music', 'electronic 2024', 'edm hits'],
            'Worship': ['worship music', 'hillsong', 'worship 2024'],
            'Soft Rock': ['soft rock', 'rock ballads', 'classic rock'],
            'Instrumentals': ['instrumental music', 'background music', 'no vocals'],
            'Soul/Neo-Soul': ['neo soul', 'soul music', 'erykah badu']
        };
    }

    ensureDownloadDir() {
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🚀 Starting Group Manager (WhatsApp Web.js)...');

        this.startScheduledTasks();
        this.setupMessageHandlers();

        console.log('✅ Group Manager started successfully!');
        console.log('📋 Features: Scheduled posts, Admin-only commands, Auto-group management');
    }

    stop() {
        this.isRunning = false;
        this.intervals.forEach(clearInterval);
        this.timeouts.forEach(clearTimeout);
        this.intervals = [];
        this.timeouts = [];
        console.log('🛑 Group Manager stopped');
    }

    setupMessageHandlers() {
        // Handle group messages - ONLY RESPOND TO ADMINS
        this.client.on('message', async (message) => {
            try {
                // Ignore if not a group message
                if (!message.from.endsWith('@g.us')) return;

                const sender = message.author || message.from;
                const body = message.body || '';

                console.log(`👥 Group message from ${sender}: ${body}`);

                // Check if sender is admin
                if (!this.isAdmin(sender)) {
                    console.log(`🚫 Ignoring non-admin message from ${sender}`);
                    return; // IGNORE NON-ADMIN MESSAGES
                }

                // Process admin commands
                if (body.startsWith('!broadcast')) {
                    await this.handleBroadcastCommand(message, sender, body);
                }
                else if (body.startsWith('!schedule')) {
                    await this.handleScheduleCommand(message, sender, body);
                }
                else if (body.startsWith('!stats')) {
                    await this.handleStatsCommand(message, sender);
                }
                else if (body.startsWith('!bot')) {
                    await this.handleBotCommand(message, sender);
                }

            } catch (error) {
                console.error('Group message handling error:', error);
            }
        });

        // Track when bot is added to groups
        this.client.on('group_join', async (notification) => {
            try {
                this.joinedGroups.add(notification.chatId);
                console.log(`✅ Bot added to group: ${notification.chatId}`);
                await this.sendWelcomeMessage(notification.chatId);
            } catch (error) {
                console.error('Group join error:', error);
            }
        });

        // Track when bot is removed from groups
        this.client.on('group_leave', async (notification) => {
            try {
                this.joinedGroups.delete(notification.chatId);
                console.log(`🚪 Bot removed from group: ${notification.chatId}`);
            } catch (error) {
                console.error('Group leave error:', error);
            }
        });
    }

    isAdmin(sender) {
        return this.constantAdmins.includes(sender);
    }

    async handleBroadcastCommand(message, sender, body) {
        if (!this.isAdmin(sender)) {
            await message.reply('❌ Admin only command.');
            return;
        }

        const content = body.replace('!broadcast', '').trim();
        if (!content) {
            await message.reply('❌ Usage: !broadcast [message]');
            return;
        }

        try {
            const groups = Array.from(this.joinedGroups);
            let successCount = 0;

            for (const groupJid of groups) {
                try {
                    await this.delay(2000); // Avoid rate limiting
                    await this.client.sendMessage(groupJid, 
                        `📢 *ADMIN BROADCAST*\n\n${content}\n\n*Our Channels:*\n🎵 Music: ${this.channelLinks.music}\n🎭 Entertainment: ${this.channelLinks.entertainment}`
                    );
                    successCount++;
                    console.log(`✅ Broadcast sent to ${groupJid}`);
                } catch (error) {
                    console.log(`❌ Failed broadcast to ${groupJid}:`, error.message);
                }
            }

            await message.reply(`✅ Broadcast sent to ${successCount}/${groups.length} groups`);

        } catch (error) {
            await message.reply('❌ Broadcast error: ' + error.message);
        }
    }

    async handleScheduleCommand(message, sender, body) {
        if (!this.isAdmin(sender)) {
            await message.reply('❌ Admin only command.');
            return;
        }

        const args = body.split(' ').slice(1);
        if (args.length === 0) {
            const schedule = this.getTodaysSchedule();
            await message.reply(schedule);
            return;
        }

        // Handle specific schedule commands
        await message.reply('📅 Schedule management commands coming soon...');
    }

    async handleStatsCommand(message, sender) {
        if (!this.isAdmin(sender)) {
            await message.reply('❌ Admin only command.');
            return;
        }

        const stats = this.getStats();
        const statsText = `📊 *GROUP MANAGER STATS*\n\n` +
                         `• Joined Groups: ${stats.joinedGroups}\n` +
                         `• Status: ${stats.isRunning ? 'Running' : 'Stopped'}\n` +
                         `• Active Tasks: ${stats.intervals + stats.timeouts}\n` +
                         `• Next Post: ${this.getNextScheduledPost()}`;

        await message.reply(statsText);
    }

    async handleBotCommand(message, sender) {
        // Basic bot response - available to everyone but only admins can trigger via group messages
        await message.reply(
            `🤖 *Download Bot Active*\n\n` +
            `I manage entertainment & music updates in this group!\n\n` +
            `*Admin Commands:*\n` +
            `!broadcast [msg] - Send to all groups\n` +
            `!schedule - Show today's schedule\n` +
            `!stats - Bot statistics\n\n` +
            `*Channels:*\n` +
            `🎵 ${this.channelLinks.music}\n` +
            `🎭 ${this.channelLinks.entertainment}`
        );
    }

    async sendWelcomeMessage(groupJid) {
        try {
            const welcome = `🤖 *Welcome!* I'll share daily entertainment & music updates!\n\n` +
                           `*I only respond to admin commands.*\n\n` +
                           `*Our Channels:*\n` +
                           `🎵 Music: ${this.channelLinks.music}\n` +
                           `🎭 Entertainment: ${this.channelLinks.entertainment}\n\n` +
                           `Type !bot for more info.`;

            await this.client.sendMessage(groupJid, welcome);
            console.log(`✅ Welcome message sent to ${groupJid}`);
        } catch (error) {
            console.error('Welcome message error:', error);
        }
    }

    startScheduledTasks() {
        // ENTERTAINMENT CHANNEL SCHEDULE
        this.scheduleDailyTask(12, 30, () => this.postComedianContent('lunch')); // 12:30 PM
        this.scheduleDailyTask(16, 0, () => this.postComedianContent('break')); // 4:00 PM
        this.scheduleDailyTask(20, 0, () => this.postComedianContent('night')); // 8:00 PM
        this.scheduleDailyTask(19, 0, () => this.sendNewsUpdate()); // 7:00 PM
        this.scheduleDailyTask(21, 0, () => this.sendNewsUpdate()); // 9:00 PM

        // Hyping quotes every 30 minutes
        this.scheduleInterval(() => this.sendHypingQuote(), 30 * 60 * 1000);

        // MUSIC CHANNEL SCHEDULE
        this.scheduleDailyTask(6, 0, () => this.updateMusicSchedule()); // 6:00 AM
        this.scheduleDailyTask(12, 0, () => this.updateMusicSchedule()); // 12:00 PM
        this.scheduleDailyTask(18, 0, () => this.updateMusicSchedule()); // 6:00 PM
        this.scheduleDailyTask(21, 0, () => this.postChartToppers()); // 9:00 PM

        // Saturday shows (Friday 5 PM)
        this.scheduleWeeklyTask(5, 17, 0, () => this.promoteSaturdayShows());

        console.log('📅 All entertainment & music tasks scheduled');
    }

    scheduleDailyTask(hour, minute, task) {
        const now = new Date();
        const target = new Date();
        target.setHours(hour, minute, 0, 0);

        if (target <= now) target.setDate(target.getDate() + 1);

        const delay = target.getTime() - now.getTime();
        const timeout = setTimeout(() => {
            task();
            this.scheduleDailyTask(hour, minute, task);
        }, delay);

        this.timeouts.push(timeout);
    }

    scheduleWeeklyTask(dayOfWeek, hour, minute, task) {
        const now = new Date();
        const target = new Date();
        target.setHours(hour, minute, 0, 0);

        let daysUntilTarget = dayOfWeek - now.getDay();
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && target <= now)) {
            daysUntilTarget += 7;
        }

        target.setDate(now.getDate() + daysUntilTarget);
        const delay = target.getTime() - now.getTime();

        const timeout = setTimeout(() => {
            task();
            this.scheduleWeeklyTask(dayOfWeek, hour, minute, task);
        }, delay);

        this.timeouts.push(timeout);
    }

    scheduleInterval(task, interval) {
        task();
        const intervalId = setInterval(task, interval);
        this.intervals.push(intervalId);
    }

    // ENTERTAINMENT CHANNEL FUNCTIONS
    async postComedianContent(timeOfDay) {
        try {
            const zimComedian = this.zimComedians[Math.floor(Math.random() * this.zimComedians.length)];
            const saComedian = this.saComedians[Math.floor(Math.random() * this.saComedians.length)];

            const timeLabels = {
                'lunch': 'LUNCH BREAK COMEDY',
                'break': 'AFTERNOON COMEDY BREAK', 
                'night': 'EVENING COMEDY SPECIAL'
            };

            const message = `🎭 *${timeLabels[timeOfDay]}* 🎭\n\n` +
                           `🇿🇼 *Zimbabwean Comedian:* ${zimComedian.name}\n` +
                           `🇿🇦 *South African Comedian:* ${saComedian.name}\n\n` +
                           `*Credits:*\n` +
                           `Instagram: @${zimComedian.instagram} & @${saComedian.instagram}\n` +
                           `YouTube: ${zimComedian.youtube} & ${saComedian.youtube}\n\n` +
                           `#Comedy #${zimComedian.name.replace(/\s+/g, '')} #${saComedian.name.replace(/\s+/g, '')}`;

            await this.sendToChannel('entertainment', message);
            console.log(`✅ Posted comedian content: ${timeOfDay}`);

        } catch (error) {
            console.error('Comedian content error:', error);
        }
    }

    async promoteSaturdayShows() {
        try {
            const show = this.saturdayShows[Math.floor(Math.random() * this.saturdayShows.length)];
            const message = `📺 *SATURDAY NIGHT PREVIEW* 📺\n\n` +
                           `This Saturday: *${show}*\n` +
                           `Don't miss the amazing performances!\n\n` +
                           `#SaturdayShows #${show.replace(/\s+/g, '')}`;

            await this.sendToChannel('entertainment', message);
        } catch (error) {
            console.error('Saturday shows error:', error);
        }
    }

    async sendNewsUpdate() {
        try {
            const source = this.newsSources[Math.floor(Math.random() * this.newsSources.length)];
            const message = `📰 *LATEST NEWS UPDATE* 📰\n\n` +
                           `Source: *${source.name}*\n` +
                           `Stay informed with current headlines!\n` +
                           `Read more: ${source.url}\n\n` +
                           `#News #${source.name.replace(/\s+/g, '')}`;

            await this.sendToChannel('entertainment', message);
        } catch (error) {
            console.error('News update error:', error);
        }
    }

    async sendHypingQuote() {
        try {
            const quote = this.hypingQuotes[Math.floor(Math.random() * this.hypingQuotes.length)];
            const message = `💫 *DAILY MOTIVATION* 💫\n\n${quote}\n\nKeep shining! ✨`;
            await this.sendToChannel('entertainment', message);
        } catch (error) {
            console.error('Hyping quote error:', error);
        }
    }

    // MUSIC CHANNEL FUNCTIONS
    async updateMusicSchedule() {
        try {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const schedule = this.musicSchedule[today];

            if (schedule) {
                const currentTime = new Date();
                const currentHour = currentTime.getHours();
                let currentGenre = '';

                for (const [timeRange, genre] of schedule) {
                    const [start, end] = timeRange.split('-').map(t => parseInt(t.split(':')[0]));
                    if (currentHour >= start && currentHour < end) {
                        currentGenre = genre;
                        break;
                    }
                }

                const scheduleText = schedule.map(([time, genre]) => 
                    `⏰ ${time} - ${genre}${genre === currentGenre ? ' 🎧 NOW PLAYING' : ''}`
                ).join('\n');

                const message = `🎵 *${today.toUpperCase()} MUSIC SCHEDULE* 🎵\n\n${scheduleText}\n\nEnjoy the music! 🎶`;
                await this.sendToChannel('music', message);

                console.log(`✅ Updated music schedule for ${today}`);
            }
        } catch (error) {
            console.error('Music schedule error:', error);
        }
    }

    async postChartToppers() {
        try {
            const chart = this.musicCharts[Math.floor(Math.random() * this.musicCharts.length)];
            const message = `🏆 *TONIGHT'S CHART TOPPERS* 🏆\n\n` +
                           `Chart: *${chart}*\n` +
                           `Here are the hottest tracks right now! 🔥\n\n` +
                           `#Charts #${chart.replace(/\s+/g, '')}`;

            await this.sendToChannel('music', message);
        } catch (error) {
            console.error('Chart toppers error:', error);
        }
    }

    // UTILITY METHODS
    async sendToChannel(channel, message) {
        try {
            const channelJid = this.channels[channel];
            if (channelJid) {
                await this.client.sendMessage(channelJid, message);
                console.log(`✅ Sent to ${channel} channel`);
            }
        } catch (error) {
            console.error(`Error sending to ${channel}:`, error);
        }
    }

    getTodaysSchedule() {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const schedule = this.musicSchedule[today] || [];
        
        const scheduleText = schedule.map(([time, genre]) => 
            `⏰ ${time} - ${genre}`
        ).join('\n');

        return `📅 *${today.toUpperCase()} SCHEDULE*\n\n${scheduleText || 'No schedule for today'}`;
    }

    getNextScheduledPost() {
        // Simple implementation - returns next hour
        const nextHour = new Date().getHours() + 1;
        return `${nextHour}:00`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            joinedGroups: this.joinedGroups.size,
            isRunning: this.isRunning,
            intervals: this.intervals.length,
            timeouts: this.timeouts.length,
            admins: this.constantAdmins.length
        };
    }
}

module.exports = GroupManager;