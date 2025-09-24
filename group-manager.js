const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const instagramGetUrl = require('instagram-url-direct');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class GroupManager {
    constructor(sock) {
        this.sock = sock;
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
        
        // Admins
        this.constantAdmins = [
            '0775156210@s.whatsapp.net',
            '27614159817@s.whatsapp.net', 
            '263717457592@s.whatsapp.net',
            '263777627210@s.whatsapp.net'
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
        console.log('🚀 Starting Group Manager...');

        this.startScheduledTasks();
        this.setupMessageHandlers();
        
        console.log('✅ Group Manager started successfully!');
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
        // Track group joins
        this.sock.ev.on('group-participants.update', async (update) => {
            if (update.action === 'add' && update.participants.includes(this.sock.user.id)) {
                this.joinedGroups.add(update.id);
                console.log(`✅ Bot added to group: ${update.id}`);
                await this.sendWelcomeMessage(update.id);
            }
        });

        // Handle broadcast commands
        this.sock.ev.on('messages.upsert', async ({ messages }) => {
            const message = messages[0];
            if (!message.message) return;

            const text = message.message.conversation || 
                         message.message.extendedTextMessage?.text || '';
            
            if (text.startsWith('.broadcast')) {
                await this.handleBroadcastCommand(message);
            }
        });
    }

    async handleBroadcastCommand(message) {
        const sender = message.key.remoteJid;
        if (!this.constantAdmins.includes(sender)) {
            await this.sock.sendMessage(sender, { text: '❌ Admin only command.' });
            return;
        }

        const text = message.message.conversation || message.message.extendedTextMessage.text;
        const content = text.replace('.broadcast', '').trim();

        if (!content) {
            await this.sock.sendMessage(sender, { text: '❌ Usage: .broadcast [message]' });
            return;
        }

        try {
            const groups = Array.from(this.joinedGroups);
            let successCount = 0;
            
            for (const groupJid of groups) {
                try {
                    await this.delay(2000);
                    await this.sock.sendMessage(groupJid, { 
                        text: `📢 *BROADCAST*\n\n${content}\n\n*Our Channels:*\n🎵 Music: ${this.channelLinks.music}\n🎭 Entertainment: ${this.channelLinks.entertainment}`
                    });
                    successCount++;
                } catch (error) {
                    console.log(`❌ Failed broadcast to ${groupJid}`);
                }
            }
            
            await this.sock.sendMessage(sender, { 
                text: `✅ Broadcast sent to ${successCount}/${groups.length} groups`
            });
            
        } catch (error) {
            await this.sock.sendMessage(sender, { text: '❌ Broadcast error' });
        }
    }

    async sendWelcomeMessage(groupJid) {
        const welcome = `🤖 *Welcome!* I'll share daily entertainment & music updates!\n\n*Channels:*\n🎵 ${this.channelLinks.music}\n🎭 ${this.channelLinks.entertainment}`;
        await this.sock.sendMessage(groupJid, { text: welcome });
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
        
        // Download and send comedy content
        await this.downloadAndSendComedyContent(zimComedian, saComedian);
    }

    async downloadAndSendComedyContent(zimComedian, saComedian) {
        try {
            // Try Instagram reel first, then YouTube
            const instagramUrl = await this.searchInstagramReel(zimComedian.instagram);
            if (instagramUrl) {
                const videoPath = await this.downloadInstagramVideo(instagramUrl);
                if (videoPath) {
                    await this.sendVideoToChannel('entertainment', videoPath, 
                        `🎬 Comedy clip from @${zimComedian.instagram}\nCredits: ${zimComedian.name} - Instagram`);
                    return;
                }
            }
            
            // Fallback to YouTube
            const youtubeUrl = await this.searchYouTubeComedy(zimComedian.name);
            if (youtubeUrl) {
                const videoPath = await this.downloadYouTubeVideo(youtubeUrl);
                if (videoPath) {
                    await this.sendVideoToChannel('entertainment', videoPath,
                        `🎬 Comedy clip from ${zimComedian.name}\nCredits: ${zimComedian.youtube} - YouTube`);
                }
            }
        } catch (error) {
            console.log('❌ Comedy content error:', error);
        }
    }

    async promoteSaturdayShows() {
        const show = this.saturdayShows[Math.floor(Math.random() * this.saturdayShows.length)];
        const message = `📺 *SATURDAY NIGHT PREVIEW* 📺\n\n` +
                       `This Saturday: *${show}*\n` +
                       `Don't miss the amazing performances!\n\n` +
                       `#SaturdayShows #${show.replace(/\s+/g, '')}`;
        
        await this.sendToChannel('entertainment', message);
    }

    async sendNewsUpdate() {
        const source = this.newsSources[Math.floor(Math.random() * this.newsSources.length)];
        const message = `📰 *LATEST NEWS UPDATE* 📰\n\n` +
                       `Source: *${source.name}*\n` +
                       `Stay informed with current headlines!\n` +
                       `Read more: ${source.url}\n\n` +
                       `#News #${source.name.replace(/\s+/g, '')}`;
        
        await this.sendToChannel('entertainment', message);
    }

    async sendHypingQuote() {
        const quote = this.hypingQuotes[Math.floor(Math.random() * this.hypingQuotes.length)];
        const message = `💫 *DAILY MOTIVATION* 💫\n\n${quote}\n\nKeep shining! ✨`;
        await this.sendToChannel('entertainment', message);
    }

    // MUSIC CHANNEL FUNCTIONS
    async updateMusicSchedule() {
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
            
            if (currentGenre) {
                await this.downloadAndSendMusic(currentGenre);
            }
        }
    }

    async downloadAndSendMusic(genre) {
        try {
            const queries = this.genreQueries[genre] || [genre + ' music'];
            const query = queries[Math.floor(Math.random() * queries.length)];
            
            console.log(`🎵 Searching for ${genre} music: ${query}`);
            
            const youtubeUrl = await this.searchYouTubeMusic(query);
            if (youtubeUrl) {
                // Download MP3
                const audioPath = await this.downloadYouTubeAudio(youtubeUrl);
                if (audioPath) {
                    await this.sendAudioToChannel('music', audioPath, 
                        `🎵 ${genre} Track\nQuery: ${query}\n\n*Copyright Disclaimer:* This content is shared for entertainment purposes only. All rights belong to the respective artists and copyright holders.`);
                
                    // Download video (50% chance)
                    if (Math.random() > 0.5) {
                        const videoPath = await this.downloadYouTubeVideo(youtubeUrl);
                        if (videoPath) {
                            await this.sendVideoToChannel('music', videoPath,
                                `🎬 ${genre} Music Video\nQuery: ${query}\n\n*Copyright Disclaimer:* This content is shared for entertainment purposes only. All rights belong to the respective artists and copyright holders.`);
                        }
                    }
                }
            }
        } catch (error) {
            console.log('❌ Music download error:', error);
        }
    }

    async postChartToppers() {
        const chart = this.musicCharts[Math.floor(Math.random() * this.musicCharts.length)];
        const message = `🏆 *TONIGHT'S CHART TOPPERS* 🏆\n\n` +
                       `Chart: *${chart}*\n` +
                       `Here are the hottest tracks right now! 🔥\n\n` +
                       `#Charts #${chart.replace(/\s+/g, '')}`;
        
        await this.sendToChannel('music', message);
        
        await this.downloadAndSendChartMusic(chart);
    }

    async downloadAndSendChartMusic(chart) {
        try {
            const query = `${chart} top 10 2024`;
            const youtubeUrl = await this.searchYouTubeMusic(query);
            if (youtubeUrl) {
                const audioPath = await this.downloadYouTubeAudio(youtubeUrl);
                if (audioPath) {
                    await this.sendAudioToChannel('music', audioPath,
                        `🏆 ${chart} Hit\n\n*Copyright Disclaimer:* This content is shared for entertainment purposes only. All rights belong to the respective artists, labels, and copyright holders.`);
                }
            }
        } catch (error) {
            console.log('❌ Chart music error:', error);
        }
    }

    // DOWNLOAD METHODS
    async searchYouTubeMusic(query) {
        try {
            // Simulate YouTube search (you'd use youtube-search-api in real implementation)
            return `https://youtube.com/watch?v=simulated_${Date.now()}`;
        } catch (error) {
            return null;
        }
    }

    async searchYouTubeComedy(query) {
        try {
            return `https://youtube.com/watch?v=comedy_${Date.now()}`;
        } catch (error) {
            return null;
        }
    }

    async searchInstagramReel(username) {
        try {
            // Simulate Instagram search
            return `https://instagram.com/reel/simulated_${Date.now()}`;
        } catch (error) {
            return null;
        }
    }

    async downloadYouTubeAudio(url) {
        try {
            const filename = `music_${Date.now()}.mp3`;
            const filepath = path.join(this.downloadDir, filename);
            
            // Simulate download (replace with ytdl-core)
            console.log(`⬇️ Downloading audio: ${filename}`);
            await this.delay(2000);
            
            // In real implementation:
            // const stream = ytdl(url, { filter: 'audioonly' });
            // stream.pipe(fs.createWriteStream(filepath));
            
            return filepath;
        } catch (error) {
            return null;
        }
    }

    async downloadYouTubeVideo(url) {
        try {
            const filename = `video_${Date.now()}.mp4`;
            const filepath = path.join(this.downloadDir, filename);
            
            console.log(`⬇️ Downloading video: ${filename}`);
            await this.delay(3000);
            
            return filepath;
        } catch (error) {
            return null;
        }
    }

    async downloadInstagramVideo(url) {
        try {
            const filename = `reel_${Date.now()}.mp4`;
            const filepath = path.join(this.downloadDir, filename);
            
            console.log(`⬇️ Downloading Instagram reel: ${filename}`);
            await this.delay(2000);
            
            return filepath;
        } catch (error) {
            return null;
        }
    }

    // SEND METHODS
    async sendToChannel(channel, message) {
        try {
            const channelJid = this.channels[channel];
            if (channelJid) {
                await this.sock.sendMessage(channelJid, { text: message });
                console.log(`✅ Sent to ${channel} channel`);
            }
        } catch (error) {
            console.log(`❌ Error sending to ${channel}:`, error);
        }
    }

    async sendVideoToChannel(channel, videoPath, caption) {
        try {
            const channelJid = this.channels[channel];
            if (channelJid) {
                // Simulate video send
                await this.sock.sendMessage(channelJid, {
                    text: caption
                });
                console.log(`✅ Sent video to ${channel} channel`);
            }
        } catch (error) {
            console.log(`❌ Error sending video to ${channel}:`, error);
        }
    }

    async sendAudioToChannel(channel, audioPath, caption) {
        try {
            const channelJid = this.channels[channel];
            if (channelJid) {
                // Simulate audio send
                await this.sock.sendMessage(channelJid, {
                    text: caption
                });
                console.log(`✅ Sent audio to ${channel} channel`);
            }
        } catch (error) {
            console.log(`❌ Error sending audio to ${channel}:`, error);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    addGroup(groupJid) {
        this.joinedGroups.add(groupJid);
    }

    getStats() {
        return {
            joinedGroups: this.joinedGroups.size,
            isRunning: this.isRunning,
            intervals: this.intervals.length,
            timeouts: this.timeouts.length
        };
    }
}

module.exports = GroupManager;