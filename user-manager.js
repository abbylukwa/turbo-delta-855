const fs = require('fs-extra');
const path = require('path');

class UserManager {
    constructor() {
        this.users = new Map();
        this.subscriptions = new Map();
        this.otpCodes = new Map();
        this.adminNumbers = ['+263717457592', '+27614159817'];
        this.paymentNumbers = ['+263777627210', '+27614159817'];
        
        this.roles = {
            ABBY: 'abby_user',
            ADMIN: 'admin_user', 
            NICCI: 'nicci_user'
        };
        
        this.activationKeys = {
            'Abby0121': this.roles.ABBY,
            'Admin0121': this.roles.ADMIN,
            'Nicci0121': this.roles.NICCI
        };

        this.subscriptionPlans = {
            '2weeks': {
                duration: 14 * 24 * 60 * 60 * 1000, // 2 weeks in milliseconds
                price: 0.75,
                currency: 'USD',
                description: 'Unlimited downloads for 2 weeks'
            },
            '1week': {
                duration: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
                price: 0.50, 
                currency: 'USD',
                description: 'Unlimited downloads for 1 week'
            }
        };

        this.loadData();
    }

    // Load data from files
    async loadData() {
        try {
            const usersData = await fs.readJson('./data/users.json');
            const subsData = await fs.readJson('./data/subscriptions.json');
            
            this.users = new Map(usersData);
            this.subscriptions = new Map(subsData);
        } catch (error) {
            console.log('No existing data found, starting fresh');
            await this.ensureDataDirectory();
        }
    }

    // Save data to files
    async saveData() {
        try {
            await fs.ensureDir('./data');
            await fs.writeJson('./data/users.json', Array.from(this.users.entries()));
            await fs.writeJson('./data/subscriptions.json', Array.from(this.subscriptions.entries()));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    async ensureDataDirectory() {
        await fs.ensureDir('./data');
    }

    // Authenticate user
    authenticateUser(phoneNumber, activationKey) {
        const role = this.activationKeys[activationKey];
        if (role) {
            this.users.set(phoneNumber, {
                role: role,
                activatedAt: new Date(),
                permissions: this.getPermissionsForRole(role),
                usage: this.getDefaultUsage()
            });
            this.saveData();
            return true;
        }
        return false;
    }

    // Get default usage limits
    getDefaultUsage() {
        return {
            videos: { used: 0, limit: 5, resetTime: new Date(Date.now() + 13 * 60 * 60 * 1000) },
            images: { used: 0, limit: 10, resetTime: new Date(Date.now() + 13 * 60 * 60 * 1000) }
        };
    }

    // Check and reset usage limits
    checkAndResetUsage(phoneNumber) {
        const user = this.users.get(phoneNumber);
        if (user && user.usage) {
            const now = new Date();
            
            if (now > user.usage.videos.resetTime) {
                user.usage.videos.used = 0;
                user.usage.videos.resetTime = new Date(now.getTime() + 13 * 60 * 60 * 1000);
            }
            
            if (now > user.usage.images.resetTime) {
                user.usage.images.used = 0;
                user.usage.images.resetTime = new Date(now.getTime() + 13 * 60 * 60 * 1000);
            }
            
            this.saveData();
        }
    }

    // Increment usage count
    incrementUsage(phoneNumber, type) {
        const user = this.users.get(phoneNumber);
        if (user && user.usage && user.usage[type]) {
            this.checkAndResetUsage(phoneNumber);
            user.usage[type].used++;
            this.saveData();
            return user.usage[type];
        }
        return null;
    }

    // Check if user can download
    canDownload(phoneNumber, type) {
        const user = this.users.get(phoneNumber);
        if (!user || !user.usage) return false;

        this.checkAndResetUsage(phoneNumber);
        
        // Check if user has active subscription
        const subscription = this.subscriptions.get(phoneNumber);
        if (subscription && subscription.isActive && new Date() < subscription.expiresAt) {
            return true; // Unlimited downloads for subscribed users
        }

        return user.usage[type].used < user.usage[type].limit;
    }

    // Get remaining downloads
    getRemainingDownloads(phoneNumber, type) {
        const user = this.users.get(phoneNumber);
        if (!user || !user.usage) return 0;

        this.checkAndResetUsage(phoneNumber);
        return Math.max(0, user.usage[type].limit - user.usage[type].used);
    }

    // Generate OTP code
    generateOTP(phoneNumber, plan, duration) {
        const otp = Math.random().toString(36).substring(2, 10).toUpperCase();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // OTP valid for 24 hours
        
        this.otpCodes.set(otp, {
            phoneNumber: phoneNumber,
            plan: plan,
            duration: duration,
            expiresAt: expiresAt,
            used: false
        });

        // Clean up expired OTPs after 24 hours
        setTimeout(() => {
            this.otpCodes.delete(otp);
        }, 24 * 60 * 60 * 1000);

        return otp;
    }

    // Validate OTP code
    validateOTP(otp, phoneNumber) {
        const otpData = this.otpCodes.get(otp);
        if (!otpData || otpData.used || new Date() > otpData.expiresAt) {
            return false;
        }

        if (otpData.phoneNumber !== phoneNumber) {
            return false;
        }

        otpData.used = true;
        return otpData;
    }

    // Activate subscription
    activateSubscription(phoneNumber, plan, duration) {
        const subscription = {
            phoneNumber: phoneNumber,
            plan: plan,
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + duration),
            isActive: true
        };

        this.subscriptions.set(phoneNumber, subscription);
        this.saveData();
        return subscription;
    }

    // Check subscription status
    getSubscriptionStatus(phoneNumber) {
        const subscription = this.subscriptions.get(phoneNumber);
        if (!subscription) return null;

        const now = new Date();
        const isActive = subscription.isActive && now < subscription.expiresAt;
        
        return {
            isActive: isActive,
            plan: subscription.plan,
            activatedAt: subscription.activatedAt,
            expiresAt: subscription.expiresAt,
            daysRemaining: isActive ? Math.ceil((subscription.expiresAt - now) / (24 * 60 * 60 * 1000)) : 0
        };
    }

    // Get payment information
    getPaymentInfo(plan) {
        const planInfo = this.subscriptionPlans[plan];
        if (!planInfo) return null;

        return {
            plan: plan,
            price: planInfo.price,
            currency: planInfo.currency,
            description: planInfo.description,
            ecoCash: '+263777627210',
            inBucks: '+263777627210', 
            southAfrica: '+27614159817',
            adminNumbers: this.adminNumbers
        };
    }

    // Get user info with subscription status
    getUserInfo(phoneNumber) {
        const user = this.users.get(phoneNumber);
        if (!user) return null;

        const subscription = this.getSubscriptionStatus(phoneNumber);
        const usage = user.usage ? {
            videos: user.usage.videos,
            images: user.usage.images
        } : null;

        return {
            phoneNumber: phoneNumber,
            role: user.role,
            activatedAt: user.activatedAt,
            subscription: subscription,
            usage: usage,
            permissions: user.permissions
        };
    }

    // Get permissions for role
    getPermissionsForRole(role) {
        const permissions = {
            [this.roles.ABBY]: ['download_website_media', 'search_website', 'list_downloads', 'check_subscription'],
            [this.roles.ADMIN]: ['search_web', 'download_any_media', 'advanced_search', 'manage_subscriptions'],
            [this.roles.NICCI]: ['manage_groups', 'moderate_messages', 'group_announcements']
        };
        return permissions[role] || [];
    }

    // Get welcome message with username
    getWelcomeMessage(role, username = 'User') {
        const messages = {
            [this.roles.ABBY]: `👋 Welcome ${username}! 🤖\n\n📊 Your Download Limits:\n• 🎥 Videos: 5/13 hours\n• 🖼️ Images: 10/13 hours\n\n💎 Subscription Plans:\n• 1 Week: 50¢ (Unlimited)\n• 2 Weeks: 75¢ (Unlimited)\n\n💡 Commands:\n• !search <query> - Find media\n• !download <number> - Download\n• !mystats - Your usage\n• !subscribe - Get premium\n• !help - Show help`,
            
            [this.roles.ADMIN]: `👑 Welcome Admin ${username}! 🌟\n\nYou have free access to search and download from any website.\n\nCommands:\n• !websearch <query> - Search media\n• !download <number> - Download\n• !advanced <query> - Advanced search\n• !help - Show help`,
            
            [this.roles.NICCI]: `🛡️ Welcome Nicci ${username}! ⚡\n\nGroup management privileges activated.\n\nCommands:\n• !groupinfo - Group details\n• !promote @user - Promote user\n• !demote @user - Demote user\n• !kick @user - Remove user\n• !help - Show help`
        };
        
        return messages[role] || `Welcome ${username}! Use !help for commands.`;
    }
}

module.exports = UserManager;
