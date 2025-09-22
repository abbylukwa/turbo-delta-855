const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class KeepAlive {
    constructor() {
        this.pingInterval = null;
        this.statusFile = path.join(__dirname, 'data', 'bot_status.json');
        this.ensureStatusFile();
    }

    async ensureStatusFile() {
        try {
            await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
            try {
                await fs.access(this.statusFile);
            } catch {
                await fs.writeFile(this.statusFile, JSON.stringify({
                    lastPing: new Date().toISOString(),
                    totalPings: 0,
                    status: 'offline'
                }));
            }
        } catch (error) {
            console.error('Error ensuring status file:', error);
        }
    }

    async updateStatus(status) {
        try {
            const data = JSON.parse(await fs.readFile(this.statusFile, 'utf8'));
            data.status = status;
            data.lastUpdate = new Date().toISOString();
            await fs.writeFile(this.statusFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }

    async getStatus() {
        try {
            return JSON.parse(await fs.readFile(this.statusFile, 'utf8'));
        } catch (error) {
            return { status: 'offline', lastPing: null, totalPings: 0 };
        }
    }

    startPinging(url, interval = 300000) {
        console.log('🔄 Starting keep-alive pings...');
        this.updateStatus('online');

        this.pingInterval = setInterval(async () => {
            try {
                await axios.get(url, { timeout: 10000 });
                
                // Update status file
                const data = await this.getStatus();
                data.lastPing = new Date().toISOString();
                data.totalPings = (data.totalPings || 0) + 1;
                data.status = 'online';
                
                await fs.writeFile(this.statusFile, JSON.stringify(data, null, 2));
                
                console.log('✅ Keep-alive ping successful');
            } catch (error) {
                console.error('❌ Keep-alive ping failed:', error.message);
                this.updateStatus('offline');
            }
        }, interval);
    }

    stopPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.updateStatus('offline');
            console.log('🛑 Stopped keep-alive pings');
        }
    }

    async restartPinging(url, interval = 300000) {
        this.stopPinging();
        this.startPinging(url, interval);
    }
}

// Run if called directly
if (require.main === module) {
    const keepAlive = new KeepAlive();
    const url = process.env.APP_URL || 'http://localhost:3000/health';
    const interval = parseInt(process.env.PING_INTERVAL) || 300000;
    
    keepAlive.startPinging(url, interval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        keepAlive.stopPinging();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        keepAlive.stopPinging();
        process.exit(0);
    });
}

module.exports = KeepAlive;