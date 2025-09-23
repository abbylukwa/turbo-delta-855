// YouTube DL configuration equivalents using ytdl-core
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// YouTube download configuration
const getAudioDownloadOptions = (downloadDir) => {
    return {
        quality: 'highestaudio',
        filter: 'audioonly'
    };
};

const getVideoDownloadOptions = (downloadDir) => {
    return {
        quality: 'highest',
        filter: 'audioandvideo'
    };
};

// Data structures
const CHANNELS = {
    'music': 'https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S',
    'entertainment': 'https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M'
};

const ZIM_COMEDIANS = [
    "Carl Joshua Ncube", "Doc Vikela", "Long John", "Clive Chigubu",
    "Q Dube", "Mai Titi", "Madam Boss", "Comic Pastor", 
    "King Kandoro", "Bhutisi"
];

const SA_COMEDIANS = [
    "Trevor Noah", "Loyiso Gola", "Skhumba Hlophe", "Tumi Morake",
    "David Kau", "Riaad Moosa", "Kagiso Lediga", "Celeste Ntuli",
    "Nik Rabinowitz", "Marc Lottering"
];

const SATURDAY_SHOWS = [
    "Wild 'N Out", "America's Got Talent", "The Masked Singer",
    "Lip Sync Battle", "So You Think You Can Dance", 
    "World of Dance", "The Voice"
];

const NEWS_SOURCES = [
    "BBC News Africa", "Al Jazeera English", "SABC News",
    "NTV Kenya", "Channels Television", "eNCA", "Africanews"
];

const CHART_SOURCES = [
    "Billboard", "Spotify Charts", "Apple Music Top 100",
    "Shazam Global Top 200", "YouTube Music Trending"
];

const MUSIC_SCHEDULE = {
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

const HYPING_QUOTES = [
    "🎉 Keep the energy high! 🎉",
    "🔥 Your daily dose of entertainment! 🔥",
    "🌟 Stay tuned for more amazing content! 🌟",
    "💫 Amazing things are coming your way! 💫",
    "🚀 Get ready for the next big thing! 🚀"
];

module.exports = {
    getAudioDownloadOptions,
    getVideoDownloadOptions,
    CHANNELS,
    ZIM_COMEDIANS,
    SA_COMEDIANS,
    SATURDAY_SHOWS,
    NEWS_SOURCES,
    CHART_SOURCES,
    MUSIC_SCHEDULE,
    HYPING_QUOTES,
    ytdl,
    ffmpeg
};