const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const mime = require('mime-types');
const cheerio = require('cheerio');
// REMOVE THIS LINE: const { JSDOM } = require('jsdom');

class GeneralCommands {
    constructor(userManager, downloadManager, subscriptionManager) {
        this.userManager = userManager;
        this.downloadManager = downloadManager;
        this.subscriptionManager = subscriptionManager;
        this.activationCode = "Abbie0121";
        this.downloadsDir = path.join(__dirname, 'downloads');
        this.userSearches = new Map(); // Store user search results
        
        // Ensure downloads directory exists
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    // ... (rest of your code remains the same) ...

    async searchGoogleImages(query) {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 15000
            });
            
            const $ = cheerio.load(response.data);
            const results = [];
            
            // Extract image results from Google search
            // Note: Google's HTML structure changes frequently, this might need adjustment
            $('img').each((i, element) => {
                if (results.length >= 6) return false; // Limit to 6 results
                
                const src = $(element).attr('src');
                const alt = $(element).attr('alt') || 'Image';
                
                // Filter out placeholder images and data URIs
                if (src && src.startsWith('http') && !src.includes('gstatic.com')) {
                    results.push({
                        title: alt.substring(0, 50) + (alt.length > 50 ? '...' : ''),
                        type: 'image',
                        source: 'Google Images',
                        url: src
                    });
                }
            });
            
            // If no results found with img tags, try a different approach
            if (results.length === 0) {
                // Alternative parsing method
                response.data.split('["https://').forEach(part => {
                    if (results.length >= 6) return;
                    if (part.includes('.jpg"') || part.includes('.png"') || part.includes('.jpeg"')) {
                        const url = 'https://' + part.split('"')[0];
                        if (url.includes('google.com') || url.includes('gstatic.com')) return;
                        
                        results.push({
                            title: `Image ${results.length + 1}`,
                            type: 'image',
                            source: 'Google Images',
                            url: url
                        });
                    }
                });
            }
            
            return results.slice(0, 6); // Ensure max 6 results
        } catch (error) {
            console.error('Google search error:', error.message);
            return [];
        }
    }

    // ... (rest of your code remains the same) ...
}

module.exports = GeneralCommands;
