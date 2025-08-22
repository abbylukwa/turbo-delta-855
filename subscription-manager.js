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
            console.error('Error loading subscriptions:', error);
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
                subscriptionActive: false,
                subscriptionExpiry: null,
                paymentPending: false
            };
            this.saveSubscriptions();
        }
    }

    recordDownload(phoneNumber) {
        this.initializeUser(phoneNumber);
        this.subscriptions[phoneNumber].downloadCount++;
        this.saveSubscriptions();
    }

    canUserDownload(phoneNumber) {
        this.initializeUser(phoneNumber);
        const user = this.subscriptions[phoneNumber];
        
        // If user has active subscription, always allow
        if (user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date()) {
            return true;
        }
        
        // Allow up to 4 free downloads
        return user.downloadCount < 4;
    }

    getDownloadCount(phoneNumber) {
        this.initializeUser(phoneNumber);
        return this.subscriptions[phoneNumber].downloadCount;
    }

    getDownloadsLeft(phoneNumber) {
        this.initializeUser(phoneNumber);
        const user = this.subscriptions[phoneNumber];
        
        if (user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date()) {
            return 'Unlimited';
        }
        
        return Math.max(0, 4 - user.downloadCount);
    }

    hasActiveSubscription(phoneNumber) {
        this.initializeUser(phoneNumber);
        const user = this.subscriptions[phoneNumber];
        return user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date();
    }

    activateSubscription(phoneNumber, durationWeeks = 2) {
        this.initializeUser(phoneNumber);
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (durationWeeks * 7));
        
        this.subscriptions[phoneNumber] = {
            ...this.subscriptions[phoneNumber],
            subscriptionActive: true,
            subscriptionExpiry: expiryDate.toISOString(),
            paymentPending: false
        };
        
        this.saveSubscriptions();
    }

    setPaymentPending(phoneNumber) {
        this.initializeUser(phoneNumber);
        this.subscriptions[phoneNumber].paymentPending = true;
        this.saveSubscriptions();
    }

    isPaymentPending(phoneNumber) {
        this.initializeUser(phoneNumber);
        return this.subscriptions[phoneNumber].paymentPending === true;
    }
}

module.exports = SubscriptionManager;    }

    activateSubscription(phoneNumber, durationWeeks = 2) {
        this.initializeUser(phoneNumber);
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (durationWeeks * 7));
        
        this.subscriptions[phoneNumber] = {
            ...this.subscriptions[phoneNumber],
            subscriptionActive: true,
            subscriptionExpiry: expiryDate.toISOString(),
            paymentPending: false
        };
        
        this.saveSubscriptions();
    }

    setPaymentPending(phoneNumber) {
        this.initializeUser(phoneNumber);
        this.subscriptions[phoneNumber].paymentPending = true;
        this.saveSubscriptions();
    }

    isPaymentPending(phoneNumber) {
        this.initializeUser(phoneNumber);
        return this.subscriptions[phoneNumber].paymentPending === true;
    }
}

module.exports = SubscriptionManager;
