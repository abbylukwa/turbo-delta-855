const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class GroupManager {
    constructor() {
        this.channels = {
            music: 'https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S',
            entertainment: 'https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M'
        };

        this.entertainmentShows = [
            {
                name: "Wild N Out",
                searchTerms: ["wild n out best moments", "wild n out comedy", "wild n out battles"],
                type: "comedy"
            },
            {
                name: "That's My Jam",
                searchTerms: ["that's my jam jimmy fallon", "that's my jam highlights", "celeb music games"],
                type: "music_comedy"
            },
            {
                name: "Bring the Funny",
                searchTerms: ["bring the funny stand up", "bring the funny comedy", "bring the funny highlights"],
                type: "comedy"
            },
            {
                name: "The Voice Global",
                searchTerms: ["the voice global auditions", "the voice best performances", "the voice highlights"],
                type: "music"
            },
            {
                name: "Gordon Ramsay's 24 Hours",
                searchTerms: ["gordon ramsay 24 hours", "kitchen nightmares", "restaurant makeover"],
                type: "reality"
            },
            {
                name: "Dude Perfect",
                searchTerms: ["dude perfect trick shots", "dude perfect challenges", "dude perfect overtime"],
                type: "sports_comedy"
            },
            {
                name: "America's Got Talent",
                searchTerms: ["america's got talent best auditions", "agt golden buzzers", "agt funny auditions"],
                type: "variety"
            }
        ];

        this.comedians = {
            zimbabwe: [
                { name: 'Carl Joshua Ncube', username: '@carljoshuancube' },
                { name: 'Learnmore Jonasi', username: '@learnmorejonasi' },
                { name: 'Samantha Sam T', username: '@samanthasamt' },
                { name: 'Hama Michael Kudakwashe', username: '@hamamichael' },
                { name: 'Denzel Ratuva', username: '@denzelratuva' },
                { name: 'Tendayi Nyeke', username: '@tendayinyeke' }
            ],
            southAfrica: [
                { name: 'Trevor Noah', username: '@trevornoah' },
                { name: 'Loyiso Gola', username: '@loyisogola' },
                { name: 'Riaad Moosa', username: '@riaadmoosa' },
                { name: 'Nik Rabinowitz', username: '@nikrabinowitz' },
                { name: 'John Vlismas', username: '@johnvlismas' },
                { name: 'Barry Hilton', username: '@barryhilton' },
                { name: 'Bahumi Mhlongo', username: '@bahumimhlongo' },
                { name: 'Khabonina Qubeka', username: '@khaboninaqubeka' },
                { name: 'Tumi Morake', username: '@tumimorake' }
            ],
            international: [
                { name: 'Jeff Ross', username: '@jeffross' },
                { name: 'Hannibal Buress', username: '@hannibalburess' },
                { name: 'Aries Spears', username: '@ariesspears' },
                { name: 'Basketmouth', username: '@basketmouth' }
            ]
        };

        this.downloadsDir = path.join(__dirname, 'downloads');
        this.ensureDirectoriesExist();
        this.startAllSchedulers();
    }

    ensureDirectoriesExist() {
        const directories = [
            this.downloadsDir,
            path.join(this.downloadsDir, 'music'),
            path.join(this.downloadsDir, 'videos'),
            path.join(this.downloadsDir, 'reels'),
            path.join(this.downloadsDir, 'comedy')
        ];
        
        directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    startAllSchedulers() {
        console.log('🚀 Starting all content schedulers...');

        // Music channel - every 3 hours
        setInterval(() => this.postToMusicChannel(), 3 * 60 * 60 * 1000);
        
        // Entertainment channel - every 2 hours
        setInterval(() => this.postToEntertainmentChannel(), 2 * 60 * 60 * 1000);
        
        // Reels channel - every 6 hours
        setInterval(() => this.postReelsContent(), 6 * 60 * 60 * 1000);
        
        // News and shows - specific times
        setInterval(() => this.postNewsAndShows(), 60 * 60 * 1000);

        // Run immediately
        setTimeout(() => {
            this.postToMusicChannel();
            this.postToEntertainmentChannel();
            this.postReelsContent();
            this.postNewsAndShows();
        }, 15000);

        // Cleanup every 24 hours
        setInterval(() => this.cleanupOldFiles(24), 24 * 60 * 60 * 1000);
    }

    async postToMusicChannel() {
        try {
            console.log('🎵 Searching for new music...');
            
            const searchTerms = [
                'new amapiano 2024',
                'latest afrobeats',
                'new dancehall',
                'trending hip hop',
                'new house music',
                'latest zimbabwean music',
                'new south african music'
            ];

            const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
            const video = await this.searchYouTube(randomTerm);
            
            if (video) {
                const downloadedVideo = await this.downloadYouTubeVideo(video.url, 'music');
                
                if (downloadedVideo) {
                    const message = `🎵 *NEW MUSIC ALERT* 🎵\n\n` +
                                   `*Title:* ${video.title}\n` +
                                   `*Channel:* ${video.channel}\n` +
                                   `*Duration:* ${video.duration}\n\n` +
                                   `#NewMusic #Trending #${randomTerm.replace(/\s/g, '')}`;

                    console.log('✅ Downloaded music video:', downloadedVideo.filePath);
                    console.log('📤 Ready to post to music channel:', message);
                    
                    return { 
                        success: true, 
                        video: downloadedVideo, 
                        message, 
                        channel: 'music',
                        filePath: downloadedVideo.filePath 
                    };
                }
            }
        } catch (error) {
            console.error('Error in music channel:', error);
        }
        return { success: false };
    }

    async postToEntertainmentChannel() {
        try {
            console.log('🎭 Preparing entertainment content...');
            
            // Alternate between different content types
            const contentTypes = ['comedy', 'talent_show', 'reality_show'];
            const selectedType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
            
            let content;
            
            switch (selectedType) {
                case 'comedy':
                    content = await this.getComedianContent();
                    break;
                case 'talent_show':
                    content = await this.getTalentShowContent();
                    break;
                case 'reality_show':
                    content = await this.getRealityShowContent();
                    break;
            }
            
            if (content && content.video) {
                const message = `🎬 *ENTERTAINMENT TIME* 🎬\n\n` +
                               `*Title:* ${content.title}\n` +
                               `*Type:* ${content.type}\n` +
                               `*Source:* ${content.source}\n\n` +
                               `#Entertainment #${content.type} #${content.source.replace(/\s/g, '')}`;

                console.log('✅ Downloaded entertainment video:', content.video.filePath);
                console.log('📤 Ready to post to entertainment channel:', message);
                
                return { 
                    success: true, 
                    content: content.video, 
                    message, 
                    channel: 'entertainment',
                    filePath: content.video.filePath 
                };
            }
        } catch (error) {
            console.error('Error in entertainment channel:', error);
        }
        return { success: false };
    }

    async getComedianContent() {
        try {
            // Get random comedian from any region
            const regions = ['zimbabwe', 'southAfrica', 'international'];
            const region = regions[Math.floor(Math.random() * regions.length)];
            const comedian = this.comedians[region][Math.floor(Math.random() * this.comedians[region].length)];
            
            // Search for comedian content
            const searchTerms = [
                `${comedian.name} comedy`,
                `${comedian.name} stand up`,
                `${comedian.name} funny`,
                comedian.username
            ];
            
            const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
            const video = await this.searchYouTube(randomTerm);
            
            if (video) {
                const downloadedVideo = await this.downloadYouTubeVideo(video.url, 'comedy');
                
                return {
                    title: video.title,
                    type: 'Comedy',
                    source: comedian.name,
                    video: downloadedVideo
                };
            }
        } catch (error) {
            console.error('Error getting comedian content:', error);
        }
        return null;
    }

    async getTalentShowContent() {
        try {
            const talentShows = [
                "America's Got Talent",
                "The Voice Global",
                "That's My Jam",
                "Bring the Funny"
            ];
            
            const show = talentShows[Math.floor(Math.random() * talentShows.length)];
            const video = await this.searchYouTube(`${show} best moments`);
            
            if (video) {
                const downloadedVideo = await this.downloadYouTubeVideo(video.url, 'talent');
                
                return {
                    title: video.title,
                    type: 'Talent Show',
                    source: show,
                    video: downloadedVideo
                };
            }
        } catch (error) {
            console.error('Error getting talent show content:', error);
        }
        return null;
    }

    async getRealityShowContent() {
        try {
            const realityShows = [
                "Gordon Ramsay's 24 Hours",
                "Dude Perfect",
                "Wild N Out"
            ];
            
            const show = realityShows[Math.floor(Math.random() * realityShows.length)];
            const video = await this.searchYouTube(`${show} best moments`);
            
            if (video) {
                const downloadedVideo = await this.downloadYouTubeVideo(video.url, 'reality');
                
                return {
                    title: video.title,
                    type: 'Reality Show',
                    source: show,
                    video: downloadedVideo
                };
            }
        } catch (error) {
            console.error('Error getting reality show content:', error);
        }
        return null;
    }

    async postReelsContent() {
        try {
            console.log('📱 Searching for reels content...');
            
            // Get reels from various sources
            const reelSources = [
                'instagram comedian reels',
                'tiktok comedy videos',
                'short funny videos',
                'viral reels 2024'
            ];
            
            const randomSource = reelSources[Math.floor(Math.random() * reelSources.length)];
            const video = await this.searchYouTube(randomSource);
            
            if (video) {
                const downloadedVideo = await this.downloadYouTubeVideo(video.url, 'reels');
                
                const message = `📱 *VIRAL REELS* 📱\n\n` +
                               `*Title:* ${video.title}\n` +
                               `*Source:* ${video.channel}\n\n` +
                               `#Reels #Viral #Trending`;

                console.log('✅ Downloaded reel:', downloadedVideo.filePath);
                console.log('📤 Ready to post to entertainment channel:', message);
                
                return { 
                    success: true, 
                    video: downloadedVideo, 
                    message, 
                    channel: 'entertainment',
                    filePath: downloadedVideo.filePath 
                };
            }
        } catch (error) {
            console.error('Error getting reels content:', error);
        }
        return { success: false };
    }

    async postNewsAndShows() {
        try {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            
            // News from 7pm to 9pm
            if (hour >= 19 && hour < 21) {
                return await this.postNews();
            }
            
            // Entertainment shows at various times
            if ((day === 0 || day === 6) && hour >= 10 && hour < 19 || hour >= 21) {
                return await this.postEntertainmentShow();
            }
        } catch (error) {
            console.error('Error posting news/shows:', error);
        }
        return { success: false };
    }

    async downloadYouTubeVideo(videoUrl, category) {
        try {
            console.log(`📥 Downloading YouTube video: ${videoUrl}`);
            
            const videoInfo = await ytdl.getInfo(videoUrl);
            const videoTitle = videoInfo.videoDetails.title.replace(/[^\w\s]/gi, '');
            const videoId = videoInfo.videoDetails.videoId;
            
            const outputPath = path.join(this.downloadsDir, category, `${videoTitle}_${videoId}.mp4`);
            
            // Check if file already exists
            try {
                await fs.access(outputPath);
                console.log('✅ Video already exists:', outputPath);
                return {
                    filePath: outputPath,
                    title: videoTitle,
                    duration: videoInfo.videoDetails.lengthSeconds,
                    videoId: videoId
                };
            } catch (error) {
                // File doesn't exist, proceed with download
            }
            
            // Download video
            const videoStream = ytdl(videoUrl, { 
                quality: 'highest',
                filter: format => format.container === 'mp4'
            });
            
            const writeStream = require('fs').createWriteStream(outputPath);
            
            return new Promise((resolve, reject) => {
                videoStream.pipe(writeStream);
                
                writeStream.on('finish', () => {
                    console.log(`✅ Download completed: ${outputPath}`);
                    resolve({
                        filePath: outputPath,
                        title: videoTitle,
                        duration: videoInfo.videoDetails.lengthSeconds,
                        videoId: videoId
                    });
                });
                
                writeStream.on('error', (error) => {
                    console.error('Download error:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('Error downloading YouTube video:', error);
            throw error;
        }
    }

    async searchYouTube(query) {
        try {
            // This is a simplified search - in production, use YouTube API
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            
            // Parse HTML to find videos
            const $ = cheerio.load(response.data);
            const videoElements = $('ytd-video-renderer');
            
            if (videoElements.length > 0) {
                // Get a random video from first 5 results
                const randomIndex = Math.floor(Math.random() * Math.min(5, videoElements.length));
                const videoElement = $(videoElements[randomIndex]);
                
                const title = videoElement.find('#video-title').text().trim();
                const channel = videoElement.find('.ytd-channel-name a').text().trim();
                const duration = videoElement.find('.ytd-thumbnail-overlay-time-status-renderer').text().trim();
                const videoUrl = videoElement.find('#video-title').attr('href');
                
                if (title && videoUrl && videoUrl.includes('watch?v=')) {
                    const videoId = videoUrl.split('v=')[1].split('&')[0];
                    
                    return {
                        title,
                        channel,
                        duration,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        videoId
                    };
                }
            }
        } catch (error) {
            console.error('YouTube search error:', error);
        }
        return null;
    }

    async postNews() {
        const newsItems = [
            "Economic developments in Zimbabwe and South Africa",
            "Political updates from the region", 
            "Sports news: Football, Cricket, Rugby",
            "Entertainment and cultural events",
            "Business and investment opportunities"
        ];
        
        const randomNews = newsItems[Math.floor(Math.random() * newsItems.length)];
        const message = `📰 *REGIONAL NEWS UPDATE* 📰\n\n${randomNews}\n\n#News #Update #Zimbabwe #SouthAfrica`;
        
        console.log('📤 Posting news:', message);
        return { success: true, message };
    }

    async postEntertainmentShow() {
        try {
            // Select a random show
            const show = this.entertainmentShows[Math.floor(Math.random() * this.entertainmentShows.length)];
            const searchTerm = show.searchTerms[Math.floor(Math.random() * show.searchTerms.length)];
            
            const video = await this.searchYouTube(searchTerm);
            
            if (video) {
                const downloadedVideo = await this.downloadYouTubeVideo(video.url, 'shows');
                
                const message = `🎪 *${show.name.toUpperCase()}* 🎪\n\n` +
                               `*Title:* ${video.title}\n` +
                               `*Channel:* ${video.channel}\n\n` +
                               `#${show.name.replace(/\s/g, '')} #Entertainment #TVShow`;

                console.log('✅ Downloaded show video:', downloadedVideo.filePath);
                console.log('📤 Ready to post to entertainment channel:', message);
                
                return { 
                    success: true, 
                    video: downloadedVideo, 
                    message, 
                    channel: 'entertainment',
                    filePath: downloadedVideo.filePath 
                };
            }
        } catch (error) {
            console.error('Error posting entertainment show:', error);
        }
        return { success: false };
    }

    // Admin commands
    async advertiseChannels(sock, message) {
        try {
            const channelList = `📢 *OUR OFFICIAL CHANNELS* 📢\n\n` +
                               `🎵 *Music Channel:*\n` +
                               `Get the latest trending music every 3 hours!\n` +
                               `${this.channels.music}\n\n` +
                               `🎬 *Entertainment Channel:*\n` +
                               `Comedy, talent shows, and viral content!\n` +
                               `${this.channels.entertainment}\n\n` +
                               `#JoinUs #WhatsAppChannels #Subscribe`;

            await sock.sendMessage(message.key.remoteJid, { text: channelList });
            return { success: true };
        } catch (error) {
            console.error('Error advertising channels:', error);
            return { success: false, error: error.message };
        }
    }

    async postCustomToChannel(sock, message, args) {
        try {
            if (args.length < 2) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: "Usage: .posttochannel [music|entertainment] [message]\nExample: .posttochannel music Check out this new song!"
                });
                return;
            }

            const channelType = args[0].toLowerCase();
            const content = args.slice(1).join(' ');

            if (!this.channels[channelType]) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: "❌ Invalid channel type. Use 'music' or 'entertainment'."
                });
                return;
            }

            const formattedMessage = `📢 *ADMIN ANNOUNCEMENT* 📢\n\n${content}\n\n#AdminUpdate`;

            console.log(`Would post to ${channelType} channel:`, formattedMessage);
            
            await sock.sendMessage(message.key.remoteJid, {
                text: `✅ Message prepared for ${channelType} channel:\n\n${formattedMessage}`
            });

            return { success: true, channel: channelType, message: formattedMessage };
        } catch (error) {
            console.error('Error posting to channel:', error);
            await sock.sendMessage(message.key.remoteJid, {
                text: '❌ Error preparing channel message.'
            });
            return { success: false, error: error.message };
        }
    }

    async forceDownload(sock, message, args) {
        try {
            if (args.length < 2) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: "Usage: .forcedownload [youtube_url] [category]\nExample: .forcedownload https://youtube.com/watch?v=abc123 music"
                });
                return;
            }

            const youtubeUrl = args[0];
            const category = args[1];

            if (!ytdl.validateURL(youtubeUrl)) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: "❌ Invalid YouTube URL"
                });
                return;
            }

            await sock.sendMessage(message.key.remoteJid, {
                text: "⏳ Downloading video, please wait..."
            });

            const downloadedVideo = await this.downloadYouTubeVideo(youtubeUrl, category);
            
            if (downloadedVideo) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: `✅ Download completed!\n\n` +
                          `Title: ${downloadedVideo.title}\n` +
                          `Saved to: ${downloadedVideo.filePath}\n\n` +
                          `Use .posttochannel to post this video.`
                });
                
                return { success: true, video: downloadedVideo };
            }
        } catch (error) {
            console.error('Error force downloading:', error);
            await sock.sendMessage(message.key.remoteJid, {
                text: `❌ Download failed: ${error.message}`
            });
            return { success: false, error: error.message };
        }
    }

    getChannelStats() {
        return {
            music: {
                lastPosted: new Date().toISOString(),
                nextPost: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
            },
            entertainment: {
                lastPosted: new Date().toISOString(),
                nextPost: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            },
            reels: {
                lastPosted: new Date().toISOString(),
                nextPost: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
            }
        };
    }

    async cleanupOldFiles(maxAgeHours = 24) {
        try {
            const now = Date.now();
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
            let deletedCount = 0;

            const categories = ['music', 'videos', 'reels', 'comedy', 'talent', 'reality', 'shows'];
            
            for (const category of categories) {
                const dir = path.join(this.downloadsDir, category);
                try {
                    const files = await fs.readdir(dir);
                    for (const file of files) {
                        const filePath = path.join(dir, file);
                        const stats = await fs.stat(filePath);
                        if (now - stats.mtimeMs > maxAgeMs) {
                            await fs.unlink(filePath);
                            deletedCount++;
                            console.log(`🧹 Deleted old file: ${filePath}`);
                        }
                    }
                } catch (error) {
                    // Directory might not exist, skip
                }
            }

            console.log(`🧹 Cleanup completed: ${deletedCount} files deleted`);
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up files:', error);
            return 0;
        }
    }

    // Function to actually send to WhatsApp (to be implemented with your WhatsApp library)
    async sendToWhatsAppChannel(channelType, filePath, caption) {
        try {
            console.log(`Sending ${filePath} to ${channelType} channel with caption: ${caption}`);
            
            // This is where you would implement the actual WhatsApp sending logic
            // The implementation depends on which WhatsApp library you're using
            
            /* Example with baileys:
            const jid = this.getChannelJid(channelType); // You need to map channel URLs to JIDs
            await sock.sendMessage(jid, {
                video: { url: filePath },
                caption: caption,
                mimetype: 'video/mp4'
            });
            */
            
            return { success: true };
        } catch (error) {
            console.error('Error sending to WhatsApp channel:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = GroupManager;