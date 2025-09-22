const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs'); // Changed from fs.promises to regular fs
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
                console.log(`✅ Created directory: ${dir}`);
            }
        });
    }

    // ... rest of your code remains the same ...

    async downloadYouTubeVideo(videoUrl, category) {
        try {
            console.log(`📥 Downloading YouTube video: ${videoUrl}`);

            const videoInfo = await ytdl.getInfo(videoUrl);
            const videoTitle = videoInfo.videoDetails.title.replace(/[^\w\s]/gi, '');
            const videoId = videoInfo.videoDetails.videoId;

            const outputPath = path.join(this.downloadsDir, category, `${videoTitle}_${videoId}.mp4`);

            // Check if file already exists using fs.existsSync
            if (fs.existsSync(outputPath)) {
                console.log('✅ Video already exists:', outputPath);
                return {
                    filePath: outputPath,
                    title: videoTitle,
                    duration: videoInfo.videoDetails.lengthSeconds,
                    videoId: videoId
                };
            }

            // Download video
            const videoStream = ytdl(videoUrl, { 
                quality: 'highest',
                filter: format => format.container === 'mp4'
            });

            const writeStream = fs.createWriteStream(outputPath);

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

    // ... rest of your code remains the same ...

    async cleanupOldFiles(maxAgeHours = 24) {
        try {
            const now = Date.now();
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
            let deletedCount = 0;

            const categories = ['music', 'videos', 'reels', 'comedy', 'talent', 'reality', 'shows'];

            for (const category of categories) {
                const dir = path.join(this.downloadsDir, category);
                try {
                    // Use fs.readdirSync instead of fs.promises.readdir
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const filePath = path.join(dir, file);
                        const stats = fs.statSync(filePath);
                        if (now - stats.mtimeMs > maxAgeMs) {
                            fs.unlinkSync(filePath);
                            deletedCount++;
                            console.log(`🧹 Deleted old file: ${filePath}`);
                        }
                    }
                } catch (error) {
                    // Directory might not exist, skip
                    if (error.code !== 'ENOENT') {
                        console.error(`Error reading directory ${dir}:`, error);
                    }
                }
            }

            console.log(`🧹 Cleanup completed: ${deletedCount} files deleted`);
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning up files:', error);
            return 0;
        }
    }

    // ... rest of your code remains the same ...
}

module.exports = GroupManager;