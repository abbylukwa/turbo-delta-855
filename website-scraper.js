const axios = require('axios');
const cheerio = require('cheerio');

class WebsiteScraper {
    constructor() {
        this.websiteUrl = process.env.WEBSITE_URL || 'https://your-website.com/images';
    }

    // Scan website for available images
    async scanWebsiteForImages() {
        try {
            console.log(`Scanning website for images: ${this.websiteUrl}`);
            
            const response = await axios.get(this.websiteUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const images = [];

            // Find all image elements
            $('img').each((index, element) => {
                const src = $(element).attr('src');
                const alt = $(element).attr('alt') || 'No description';
                
                if (src && this.isImageFile(src)) {
                    const fullUrl = this.getAbsoluteUrl(src);
                    images.push({
                        filename: this.extractFilename(src),
                        url: fullUrl,
                        alt: alt,
                        index: index + 1
                    });
                }
            });

            // Also check for anchor links to images
            $('a').each((index, element) => {
                const href = $(element).attr('href');
                if (href && this.isImageFile(href)) {
                    const fullUrl = this.getAbsoluteUrl(href);
                    const alt = $(element).attr('title') || $(element).text() || 'No description';
                    
                    images.push({
                        filename: this.extractFilename(href),
                        url: fullUrl,
                        alt: alt,
                        index: images.length + 1
                    });
                }
            });

            console.log(`Found ${images.length} images on website`);
            return images;

        } catch (error) {
            console.error('Error scanning website:', error.message);
            
            // Fallback: return some sample images if scraping fails
            return this.getFallbackImages();
        }
    }

    // Check if URL points to an image file
    isImageFile(url) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        return imageExtensions.some(ext => url.toLowerCase().includes(ext));
    }

    // Convert relative URL to absolute URL
    getAbsoluteUrl(url) {
        if (url.startsWith('http')) {
            return url;
        }
        if (url.startsWith('/')) {
            const baseUrl = new URL(this.websiteUrl);
            return `${baseUrl.origin}${url}`;
        }
        return `${this.websiteUrl}/${url}`;
    }

    // Extract filename from URL
    extractFilename(url) {
        return url.split('/').pop().split('?')[0];
    }

    // Fallback method if scraping fails
    getFallbackImages() {
        console.log('Using fallback images list');
        return [
            { filename: 'image1.jpg', url: `${this.websiteUrl}/image1.jpg`, alt: 'Sample Image 1', index: 1 },
            { filename: 'image2.jpg', url: `${this.websiteUrl}/image2.jpg`, alt: 'Sample Image 2', index: 2 },
            { filename: 'image3.png', url: `${this.websiteUrl}/image3.png`, alt: 'Sample Image 3', index: 3 },
            { filename: 'photo1.webp', url: `${this.websiteUrl}/photo1.webp`, alt: 'Sample Photo 1', index: 4 },
            { filename: 'photo2.jpeg', url: `${this.websiteUrl}/photo2.jpeg`, alt: 'Sample Photo 2', index: 5 }
        ];
    }

    // Get images by category (optional)
    async getImagesByCategory(category) {
        const allImages = await this.scanWebsiteForImages();
        return allImages.filter(image => 
            image.filename.toLowerCase().includes(category.toLowerCase()) ||
            image.alt.toLowerCase().includes(category.toLowerCase())
        );
    }
}

module.exports = WebsiteScraper;
