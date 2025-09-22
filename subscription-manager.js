const fs = require('fs');
const path = require('path');
const axios = require('axios');

class SubscriptionManager {
    constructor() {
        this.subscriptionsFile = path.join(__dirname, 'data', 'subscriptions.json');
        this.exchangeRatesFile = path.join(__dirname, 'data', 'exchangeRates.json');
        this.ensureDataDirectoryExists();
        this.subscriptions = this.loadSubscriptions();
        this.exchangeRates = this.loadExchangeRates();

        // Base prices in USD
        this.basePrices = {
            '2days': 0.50,    // 50 cents for 2 days
            'weekly': 2.00,   // $2 for 7 days
            'monthly': 5.00,  // $5 for 30 days
            'quarterly': 12.00, // $12 for 90 days
            'yearly': 40.00   // $40 for 365 days
        };

        // Discount tiers (13% reduction for each tier)
        this.discountTiers = {
            '2days': 0,       // No discount for 2 days
            'weekly': 0.13,   // 13% discount for weekly
            'monthly': 0.26,  // 26% discount for monthly
            'quarterly': 0.39, // 39% discount for quarterly
            'yearly': 0.52    // 52% discount for yearly
        };

        // Initialize exchange rates if not set
        if (!this.exchangeRates.lastUpdated) {
            this.exchangeRates.USD_TO_ZWL = 322; // Default exchange rate
            this.exchangeRates.lastUpdated = new Date().toISOString();
            this.saveExchangeRates();
        }

        // Update exchange rates periodically (non-blocking)
        this.updateExchangeRates().catch(error => {
            console.error('Initial exchange rate update failed:', error.message);
        });
        
        // Update every 24 hours
        setInterval(() => {
            this.updateExchangeRates().catch(error => {
                console.error('Scheduled exchange rate update failed:', error.message);
            });
        }, 24 * 60 * 60 * 1000);
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.subscriptionsFile)) {
            fs.writeFileSync(this.subscriptionsFile, JSON.stringify({}));
        }
        if (!fs.existsSync(this.exchangeRatesFile)) {
            fs.writeFileSync(this.exchangeRatesFile, JSON.stringify({}));
        }
    }

    loadSubscriptions() {
        try {
            const data = fs.readFileSync(this.subscriptionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading subscriptions:', error.message);
            return {};
        }
    }

    loadExchangeRates() {
        try {
            const data = fs.readFileSync(this.exchangeRatesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading exchange rates:', error.message);
            return {};
        }
    }

    saveSubscriptions() {
        try {
            fs.writeFileSync(this.subscriptionsFile, JSON.stringify(this.subscriptions, null, 2));
        } catch (error) {
            console.error('Error saving subscriptions:', error.message);
        }
    }

    saveExchangeRates() {
        try {
            fs.writeFileSync(this.exchangeRatesFile, JSON.stringify(this.exchangeRates, null, 2));
        } catch (error) {
            console.error('Error saving exchange rates:', error.message);
        }
    }

    async updateExchangeRates() {
        console.log('🔄 Updating exchange rates...');
        
        // Try RBZ API first with timeout
        try {
            const response = await axios.get('https://api.rbz.co.zw/exchange-rates', {
                timeout: 15000, // 15 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.rates && response.data.rates.USD) {
                this.exchangeRates.USD_TO_ZWL = response.data.rates.USD;
                this.exchangeRates.lastUpdated = new Date().toISOString();
                this.exchangeRates.source = 'RBZ API';
                this.saveExchangeRates();
                console.log('✅ Exchange rates updated successfully from RBZ API');
                return;
            }
        } catch (error) {
            console.log('❌ RBZ API failed:', error.message);
        }

        // Fallback 1: ExchangeRate-API
        try {
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
                timeout: 10000
            });
            
            if (response.data && response.data.rates && response.data.rates.ZWL) {
                this.exchangeRates.USD_TO_ZWL = response.data.rates.ZWL;
                this.exchangeRates.lastUpdated = new Date().toISOString();
                this.exchangeRates.source = 'ExchangeRate-API';
                this.saveExchangeRates();
                console.log('✅ Exchange rates updated from ExchangeRate-API');
                return;
            }
        } catch (error) {
            console.log('❌ ExchangeRate-API failed:', error.message);
        }

        // Fallback 2: Fixer API (free tier)
        try {
            const response = await axios.get('http://data.fixer.io/api/latest?access_key=YOUR_API_KEY&base=USD&symbols=ZWL', {
                timeout: 10000
            });
            
            if (response.data && response.data.success && response.data.rates && response.data.rates.ZWL) {
                this.exchangeRates.USD_TO_ZWL = response.data.rates.ZWL;
                this.exchangeRates.lastUpdated = new Date().toISOString();
                this.exchangeRates.source = 'Fixer API';
                this.saveExchangeRates();
                console.log('✅ Exchange rates updated from Fixer API');
                return;
            }
        } catch (error) {
            console.log('❌ Fixer API failed:', error.message);
        }

        // Final fallback: Use cached rate or default
        const hoursSinceUpdate = this.exchangeRates.lastUpdated ? 
            (new Date() - new Date(this.exchangeRates.lastUpdated)) / (1000 * 60 * 60) : 24;
            
        if (hoursSinceUpdate > 24 || !this.exchangeRates.USD_TO_ZWL) {
            this.exchangeRates.USD_TO_ZWL = 322; // Default fallback
            this.exchangeRates.lastUpdated = new Date().toISOString();
            this.exchangeRates.source = 'Default';
            this.saveExchangeRates();
            console.log('🔄 Using default exchange rate');
        } else {
            console.log('🔄 Using cached exchange rate from', this.exchangeRates.source);
        }
    }

    getCurrentExchangeRate() {
        return this.exchangeRates.USD_TO_ZWL || 322;
    }

    calculatePrice(planKey, currency = 'USD') {
        if (!this.basePrices[planKey]) {
            throw new Error(`Invalid plan: ${planKey}`);
        }

        const basePrice = this.basePrices[planKey];
        const discount = this.discountTiers[planKey];
        const discountedPriceUSD = basePrice * (1 - discount);

        if (currency === 'USD') {
            return {
                price: discountedPriceUSD,
                currency: 'USD',
                originalPrice: basePrice,
                discount: discount * 100,
                discountAmount: basePrice - discountedPriceUSD
            };
        } else if (currency === 'ZWL') {
            const exchangeRate = this.getCurrentExchangeRate();
            const priceZWL = discountedPriceUSD * exchangeRate;
            const originalPriceZWL = basePrice * exchangeRate;

            return {
                price: Math.round(priceZWL),
                currency: 'ZWL',
                originalPrice: Math.round(originalPriceZWL),
                discount: discount * 100,
                discountAmount: Math.round(originalPriceZWL - priceZWL),
                exchangeRate: exchangeRate
            };
        } else {
            throw new Error(`Unsupported currency: ${currency}`);
        }
    }

    getSubscriptionPlans(currency = 'USD') {
        const plans = {
            '2days': { 
                duration: 2, 
                name: '2 Days',
                features: ['Basic downloads', 'Limited dating features']
            },
            'weekly': { 
                duration: 7, 
                name: 'Weekly',
                features: ['Unlimited downloads', 'Full dating features', 'Priority support']
            },
            'monthly': { 
                duration: 30, 
                name: 'Monthly',
                features: ['Unlimited downloads', 'Full dating features', 'Priority support', 'Extra bonuses']
            },
            'quarterly': { 
                duration: 90, 
                name: 'Quarterly',
                features: ['Unlimited downloads', 'Full dating features', 'Priority support', 'Extra bonuses', 'Discount rate']
            },
            'yearly': { 
                duration: 365, 
                name: 'Yearly',
                features: ['Unlimited downloads', 'Full dating features', 'Priority support', 'Extra bonuses', 'Maximum discount', 'VIP status']
            },
            'demo': { 
                duration: 2, 
                name: 'Demo',
                price: 0,
                demo: true,
                features: ['2 demo downloads', 'Basic dating features']
            }
        };

        // Calculate prices for each plan
        Object.keys(plans).forEach(planKey => {
            if (planKey !== 'demo') {
                const priceInfo = this.calculatePrice(planKey, currency);
                plans[planKey].price = priceInfo.price;
                plans[planKey].currency = priceInfo.currency;
                plans[planKey].originalPrice = priceInfo.originalPrice;
                plans[planKey].discount = priceInfo.discount;
                plans[planKey].discountAmount = priceInfo.discountAmount;

                if (currency === 'ZWL') {
                    plans[planKey].exchangeRate = priceInfo.exchangeRate;
                }
            }
        });

        return plans;
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
                createdAt: new Date().toISOString(),
                subscriptionHistory: []
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

    isUserSubscribed(phoneNumber) {
        return this.hasActiveSubscription(phoneNumber);
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
            datingEnabled: user.datingEnabled,
            history: user.subscriptionHistory || []
        };
    }

    activateSubscription(phoneNumber, durationDays, type = 'premium', pricePaid = null, currency = 'USD') {
        const user = this.initializeUser(phoneNumber);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        user.subscriptionActive = true;
        user.subscriptionType = type;
        user.subscriptionExpiry = expiryDate.toISOString();
        user.paymentPending = false;
        user.datingEnabled = true;

        // Record subscription history
        user.subscriptionHistory = user.subscriptionHistory || [];
        user.subscriptionHistory.push({
            type: type,
            duration: durationDays,
            activated: new Date().toISOString(),
            expiry: expiryDate.toISOString(),
            pricePaid: pricePaid,
            currency: currency
        });

        // Keep only last 10 history entries
        if (user.subscriptionHistory.length > 10) {
            user.subscriptionHistory = user.subscriptionHistory.slice(-10);
        }

        this.saveSubscriptions();
        
        console.log(`✅ Subscription activated for ${phoneNumber}: ${type} for ${durationDays} days`);
    }

    activateDemo(phoneNumber) {
        const user = this.initializeUser(phoneNumber);

        user.subscriptionActive = true;
        user.subscriptionType = 'demo';
        user.subscriptionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        user.datingEnabled = true;
        user.demoUsage = (user.demoUsage || 0) + 1;

        this.saveSubscriptions();
        console.log(`✅ Demo activated for ${phoneNumber}`);
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
            console.log(`✅ Cleaned up ${cleaned} expired subscriptions`);
        }

        return cleaned;
    }

    // Get revenue statistics
    getRevenueStats() {
        let totalRevenueUSD = 0;
        let totalRevenueZWL = 0;
        let subscriptionCount = 0;

        Object.values(this.subscriptions).forEach(user => {
            if (user.subscriptionHistory) {
                user.subscriptionHistory.forEach(sub => {
                    if (sub.pricePaid) {
                        if (sub.currency === 'USD') {
                            totalRevenueUSD += sub.pricePaid;
                        } else if (sub.currency === 'ZWL') {
                            totalRevenueZWL += sub.pricePaid;
                        }
                        subscriptionCount++;
                    }
                });
            }
        });

        return {
            totalRevenueUSD: Math.round(totalRevenueUSD * 100) / 100,
            totalRevenueZWL: Math.round(totalRevenueZWL),
            subscriptionCount,
            exchangeRate: this.getCurrentExchangeRate(),
            totalRevenueConverted: Math.round((totalRevenueUSD + (totalRevenueZWL / this.getCurrentExchangeRate())) * 100) / 100
        };
    }

    // Reset user data (for testing)
    resetUser(phoneNumber) {
        if (this.subscriptions[phoneNumber]) {
            delete this.subscriptions[phoneNumber];
            this.saveSubscriptions();
            console.log(`✅ Reset subscription data for ${phoneNumber}`);
            return true;
        }
        return false;
    }

    // Get system status
    getSystemStatus() {
        const now = new Date();
        const activeSubs = this.getActiveSubscriptions();
        const expiringSubs = this.getExpiringSubscriptions(7);
        const revenueStats = this.getRevenueStats();

        return {
            totalUsers: Object.keys(this.subscriptions).length,
            activeSubscriptions: activeSubs.length,
            expiringSubscriptions: expiringSubs.length,
            exchangeRate: this.exchangeRates.USD_TO_ZWL,
            exchangeRateSource: this.exchangeRates.source || 'Unknown',
            lastExchangeRateUpdate: this.exchangeRates.lastUpdated,
            revenueStats: revenueStats,
            serverTime: now.toISOString()
        };
    }
}

module.exports = SubscriptionManager;