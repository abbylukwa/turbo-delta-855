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
                duration: 14 * 24 * 60 * 60 * 1000,
                price: 0.75,
                currency: 'USD',
                description: 'Unlimited downloads for 2 weeks'
            },
            '1week': {
                duration: 7 * 24 * 60 * 60 * 1000,
                price: 0.50,
                currency: 'USD',
                description: 'Unlimited downloads for 1 week'
            }
        };

        this.loadData();
    }

    // ... (previous methods remain the same until canDownload method)

    // Check if user can download - Admin has unlimited access
    canDownload(phoneNumber, type) {
        const user = this.users.get(phoneNumber);
        if (!user || !user.usage) return false;

        // Admin users have unlimited downloads
        if (user.role === 'admin_user') {
            return true;
        }

        this.checkAndResetUsage(phoneNumber);
        
        // Check if user has active subscription
        const subscription = this.subscriptions.get(phoneNumber);
        if (subscription && subscription.isActive && new Date() < subscription.expiresAt) {
            return true;
        }

        return user.usage[type].used < user.usage[type].limit;
    }

    // Get remaining downloads - Admin shows "Unlimited"
    getRemainingDownloads(phoneNumber, type) {
        const user = this.users.get(phoneNumber);
        if (!user || !user.usage) return 0;

        // Admin has unlimited downloads
        if (user.role === 'admin_user') {
            return 'Unlimited';
        }

        this.checkAndResetUsage(phoneNumber);
        return Math.max(0, user.usage[type].limit - user.usage[type].used);
    }

    // Get user info with admin detection
    getUserInfo(phoneNumber) {
        const user = this.users.get(phoneNumber);
        if (!user) return null;

        const subscription = this.getSubscriptionStatus(phoneNumber);
        const usage = user.usage ? {
            videos: user.usage.videos,
            images: user.usage.images,
            isAdmin: user.role === 'admin_user'
        } : null;

        return {
            phoneNumber: phoneNumber,
            role: user.role,
            activatedAt: user.activatedAt,
            subscription: subscription,
            usage: usage,
            permissions: user.permissions,
            isAdmin: user.role === 'admin_user'
        };
    }

    // Get permissions for role - Admin gets all permissions
    getPermissionsForRole(role) {
        const basePermissions = {
            [this.roles.ABBY]: ['download_website_media', 'search_website', 'list_downloads', 'check_subscription'],
            [this.roles.ADMIN]: [
                'download_website_media', 'search_website', 'list_downloads', 'check_subscription',
                'search_web', 'download_any_media', 'advanced_search', 'manage_subscriptions',
                'view_all_users', 'generate_otp', 'modify_limits', 'system_stats'
            ],
            [this.roles.NICCI]: ['manage_groups', 'moderate_messages', 'group_announcements']
        };
        return basePermissions[role] || [];
    }

    // Get welcome message for admin
    getWelcomeMessage(role, username = 'User') {
        const messages = {
            [this.roles.ABBY]: `👋 Welcome ${username}! 🤖\n\n📊 Your Download Limits:\n• 🎥 Videos: 5/13 hours\n• 🖼️ Images: 10/13 hours\n\n💎 Subscription Plans:\n• 1 Week: 50¢ (Unlimited)\n• 2 Weeks: 75¢ (Unlimited)\n\n💡 Commands:\n• !search <query> - Find media\n• !download <number> - Download\n• !mystats - Your usage\n• !subscribe - Get premium\n• !help - Show help`,
            
            [this.roles.ADMIN]: `👑 Welcome Admin ${username}! 🌟\n\n⚡ ADMIN PRIVILEGES ACTIVATED ⚡\n\n🎯 Unlimited Downloads\n📊 Access to All Users\n🔧 System Management\n💰 OTP Generation\n\n💡 Admin Commands:\n• !search <query> - Search website media\n• !websearch <query> - Search entire web\n• !download <number> - Download any media\n• !users - View all users\n• !genotp <phone> <plan> <days> - Generate OTP\n• !userinfo <phone> - User details\n• !sysinfo - System statistics\n• !help - Show help`,
            
            [this.roles.NICCI]: `🛡️ Welcome Nicci ${username}! ⚡\n\nGroup management privileges activated.\n\nCommands:\n• !groupinfo - Group details\n• !promote @user - Promote user\n• !demote @user - Demote user\n• !kick @user - Remove user\n• !help - Show help`
        };
        
        return messages[role] || `Welcome ${username}! Use !help for commands.`;
    }

    // Get all users for admin view
    getAllUsers() {
        const users = [];
        this.users.forEach((user, phoneNumber) => {
            const subscription = this.getSubscriptionStatus(phoneNumber);
            users.push({
                phoneNumber: phoneNumber,
                role: user.role,
                activatedAt: user.activatedAt,
                subscription: subscription,
                usage: user.usage
            });
        });
        return users;
    }

    // Get system statistics
    getSystemStats() {
        const totalUsers = this.users.size;
        const activeSubscriptions = Array.from(this.subscriptions.values())
            .filter(sub => sub.isActive && new Date() < sub.expiresAt).length;
        
        const usersByRole = {
            abby: Array.from(this.users.values()).filter(u => u.role === 'abby_user').length,
            admin: Array.from(this.users.values()).filter(u => u.role === 'admin_user').length,
            nicci: Array.from(this.users.values()).filter(u => u.role === 'nicci_user').length
        };

        return {
            totalUsers,
            activeSubscriptions,
            usersByRole,
            totalDownloads: this.calculateTotalDownloads()
        };
    }

    // Calculate total downloads across all users
    calculateTotalDownloads() {
        let total = 0;
        this.users.forEach(user => {
            if (user.usage) {
                total += (user.usage.videos?.used || 0) + (user.usage.images?.used || 0);
            }
        });
        return total;
    }

    // Modify user limits (admin only)
    modifyUserLimits(phoneNumber, newLimits) {
        const user = this.users.get(phoneNumber);
        if (!user || !user.usage) return false;

        if (newLimits.videos !== undefined) {
            user.usage.videos.limit = newLimits.videos;
        }
        if (newLimits.images !== undefined) {
            user.usage.images.limit = newLimits.images;
        }

        this.saveData();
        return true;
    }
}

module.exports = UserManager;
