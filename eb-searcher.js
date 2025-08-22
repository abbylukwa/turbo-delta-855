const axios = require('axios');
const cheerio = require('cheerio');
const yts = require('yt-search');
const googleIt = require('google-it');

class WebSearcher {
    constructor() {
        this.searchEngines = ['google', 'youtube', 'bing'];
    }

    // Search YouTube videos
    async searchYouTube(query, limit = 5) {
        try {
            const searchResults = await yts(query);
            return searchResults.videos.slice(0, limit).map((video, index) => ({
                index: index + 1,
                title: video.title,
                url: video.url,
                duration: video.duration,
                thumbnail: video.thumbnail,
                type: 'video',
                source: 'youtube'
            }));
        } catch (error) {
            console.error('YouTube search error:', error);
            return [];
        }
    }

    // Search Google images
    async searchGoogleImages(query, limit = 5) {
        try {
            const results = await googleIt({
                query: query + ' images',
                disableConsole: true
            });

            return results.slice(0, limit).map((result, index) => ({
                index: index + 1,
                title: result.title,
                url: result.link,
                type: 'image',
                source: 'google'
            }));
        } catch (error) {
            console.error('Google search error:', error);
            return [];
        }
    }

    // General web search
    async searchWeb(query, type = 'all', limit = 5) {
        try {
            let results = [];

            if (type === 'all' || type === 'video') {
                const youtubeResults = await this.searchYouTube(query, limit);
                results = [...results, ...youtubeResults];
            }

            if (type === 'all' || type === 'image') {
                const googleResults = await this.searchGoogleImages(query, limit);
                results = [...results, ...googleResults];
            }

            return results.slice(0, limit);
        } catch (error) {
            console.error('Web search error:', error);
            return [];
        }
    }

    // Advanced search with filters
    async advancedSearch(query, options = {}) {
        const {
            type = 'all',
            limit = 5,
            minDuration,
            maxDuration,
            resolution
        } = options;

        let results = await this.searchWeb(query, type, limit * 2);

        // Apply filters
        if (minDuration) {
            results = results.filter(item => 
                !item.duration || this.parseDuration(item.duration) >= minDuration
            );
        }

        if (maxDuration) {
            results = results.filter(item => 
                !item.duration || this.parseDuration(item.duration) <= maxDuration
            );
        }

        return results.slice(0, limit);
    }

    // Parse duration string to seconds
    parseDuration(duration) {
        if (!duration) return 0;
        const parts = duration.split(':').map(part => parseInt(part) || 0);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
        return parts[0] || 0;
    }
}

module.exports = WebSearcher;
