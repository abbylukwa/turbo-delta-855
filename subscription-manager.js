const fs = require('fs');
const path = require('path');

class SubscriptionManager {
    constructor() {
        this.subscriptionsFile = path.join(__dirname, 'data', 'subscriptions.json');
        this.ensureDataDirectoryExists();
        this.subscriptions = this.loadSubscriptions();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.subscriptionsFile)) {
            fs.writeFileSync(this.subscriptionsFile, JSON.stringify({}));
        }
    }

    loadSubscriptions() {
        try {
            const data = fs.readFileSync(this.subscriptionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    saveSubscriptions() {
        try {
            fs.writeFileSync(this.subscriptionsFile, JSON.stringify(this.subscriptions, null, 2));
        } catch (error) {
            console.error('Error saving subscriptions:', error);
        }
    }

    initializeUser(phoneNumber) {
        if (!this.subscriptions[phoneNumber]) {
            this.subscriptions[phoneNumber] = {
                downloadCount: 0,
                demoUsage: 0,
                subscriptionActive: false,
                subscriptionType: 'none',
                subscriptionExpiry: null,
                paymentPending: false,
                datingEnabled: false,
                createdAt: new Date().toISOString()
            };
            this.saveSubscriptions();
        }
        return this.subscriptions[phoneNumber];
    }

    recordDownload(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        user.downloadCount++;
        this.saveSubscriptions();
    }

    canUserDownload(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        
        // Check if subscription is active
        if (user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date()) {
            return true;
        }
        
        // Check demo access
        if (user.subscriptionType === 'demo' && user.demoUsage < 2) {
            return true;
        }
        
        // Free tier: 4 downloads
        return user.downloadCount < 4;
    }

    getDownloadCount(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        return user.downloadCount;
    }

    getDownloadsLeft(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        
        if (user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date()) {
            return 'Unlimited';
        }
        
        if (user.subscriptionType === 'demo') {
            return Math.max(0, 2 - user.demoUsage);
        }
        
        return Math.max(0, 4 - user.downloadCount);
    }

    hasActiveSubscription(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        return user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date();
    }

    getSubscriptionType(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        return user.subscriptionType;
    }

    getSubscriptionInfo(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        const now = new Date();
        const expiry = new Date(user.subscriptionExpiry);
        
        return {
            active: user.subscriptionActive && expiry > now,
            type: user.subscriptionType,
            expiry: user.subscriptionExpiry,
            daysLeft: expiry > now ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : 0,
            downloadCount: user.downloadCount,
            demoUsage: user.demoUsage,
            datingEnabled: user.datingEnabled
        };
    }

    activateSubscription(phoneNumber, durationDays, type = 'premium') {
        const user = this.initializeUser(phoneNumber);
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationDays);
        
        user.subscriptionActive = true;
        user.subscriptionType = type;
        user.subscriptionExpiry = expiryDate.toISOString();
        user.paymentPending = false;
        user.datingEnabled = true; // Enable dating features
        
        this.saveSubscriptions();
    }

    activateDemo(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        
        user.subscriptionActive = true;
        user.subscriptionType = 'demo';
        user.subscriptionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        user.datingEnabled = true;
        user.demoUsage = (user.demoUsage || 0) + 1;
        
        this.saveSubscriptions();
    }

    getDemoUsage(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        return user.demoUsage || 0;
    }

    setPaymentPending(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        user.paymentPending = true;
        this.saveSubscriptions();
    }

    isPaymentPending(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        return user.paymentPending === true;
    }

    enableDatingFeatures(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        user.datingEnabled = true;
        this.saveSubscriptions();
    }

    disableDatingFeatures(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        user.datingEnabled = false;
        this.saveSubscriptions();
    }

    canUseDating(phoneNumber) {
        const user = this.initializeUser(phoneNumber);
        return user.datingEnabled && this.hasActiveSubscription(phoneNumber);
    }

    // Admin functions
    getAllSubscriptions() {
        return this.subscriptions;
    }

    getActiveSubscriptions() {
        const now = new Date();
        return Object.entries(this.subscriptions)
            .filter(([phone, data]) => data.subscriptionActive && new Date(data.subscriptionExpiry) > now)
            .map(([phone, data]) => ({
                phone,
                type: data.subscriptionType,
                expiry: data.subscriptionExpiry,
                downloads: data.downloadCount
            }));
    }

    getExpiringSubscriptions(days = 7) {
        const now = new Date();
        const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        
        return Object.entries(this.subscriptions)
            .filter(([phone, data]) => {
                if (!data.subscriptionActive) return false;
                const expiry = new Date(data.subscriptionExpiry);
                return expiry > now && expiry <= threshold;
            })
            .map(([phone, data]) => ({
                phone,
                type: data.subscriptionType,
                expiry: data.subscriptionExpiry,
                daysLeft: Math.ceil((new Date(data.subscriptionExpiry) - now) / (1000 * 60 * 60 * 24))
            }));
    }

    // Cleanup expired subscriptions
    cleanupExpiredSubscriptions() {
        const now = new Date();
        let cleaned = 0;
        
        Object.entries(this.subscriptions).forEach(([phone, data]) => {
            if (data.subscriptionActive && new Date(data.subscriptionExpiry) <= now) {
                data.subscriptionActive = false;
                data.subscriptionType = 'expired';
                data.datingEnabled = false;
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            this.saveSubscriptions();
        }
        
        return cleaned;
    }
}

module.exports = SubscriptionManager;
