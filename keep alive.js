const axios = require('axios');

class KeepAlive {
    constructor() {
        this.pingInterval = null;
    }

    startPinging(url, interval = 300000) { // 5 minutes
        this.pingInterval = setInterval(async () => {
            try {
                await axios.get(url);
                console.log('✅ Keep-alive ping successful');
            } catch (error) {
                console.error('❌ Keep-alive ping failed:', error.message);
            }
        }, interval);
    }

    stopPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
    }
}

module.exports = KeepAlive;