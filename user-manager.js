const fs = require('fs');
const path = require('path');

class UserManager {
    constructor() {
        // User roles and permissions
        this.roles = {
            ABBY: 'abby',
            ADMIN: 'admin',
            NICCI: 'nicci'
        };
        
        // File storage setup
        this.usersFile = path.join(__dirname, 'data', 'users.json');
        this.ensureDataDirectoryExists();
        this.users = this.loadUsers();
    }

    // ✅ Data directory and file management
    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.usersFile)) {
            fs.writeFileSync(this.usersFile, JSON.stringify({}));
        }
    }

    // ✅ Load users from file
    loadUsers() {
        try {
            const data = fs.readFileSync(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error);
            return {};
        }
    }

    // ✅ Save users to file
    saveUsers() {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    // ✅ Add user with role
    addUser(phoneNumber, username, role) {
        this.users[phoneNumber] = {
            phoneNumber,
            username,
            role,
            activated: true,
            joinDate: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        this.saveUsers();
        console.log(`✅ User added: ${phoneNumber} as ${role}`);
        return true;
    }

    // ✅ Activate user (legacy method)
    activateUser(phoneNumber, username) {
        if (!this.users[phoneNumber]) {
            this.addUser(phoneNumber, username, this.roles.ABBY); // Default role
        } else {
            this.users[phoneNumber].activated = true;
            this.users[phoneNumber].username = username;
            this.users[phoneNumber].lastActive = new Date().toISOString();
            this.saveUsers();
        }
    }

    // ✅ Check if user exists
    userExists(phoneNumber) {
        return this.users.hasOwnProperty(phoneNumber);
    }

    // ✅ Check if user is activated
    isUserActivated(phoneNumber) {
        return this.users[phoneNumber] && this.users[phoneNumber].activated === true;
    }

    // ✅ Get user info
    getUser(phoneNumber) {
        return this.users[phoneNumber];
    }

    // ✅ Update user last active
    updateLastActive(phoneNumber) {
        if (this.users[phoneNumber]) {
            this.users[phoneNumber].lastActive = new Date().toISOString();
            this.saveUsers();
            return true;
        }
        return false;
    }

    // ✅ Get all users (for admin)
    getAllUsers() {
        return this.users;
    }

    // ✅ Remove user
    removeUser(phoneNumber) {
        if (this.users[phoneNumber]) {
            delete this.users[phoneNumber];
            this.saveUsers();
            return true;
        }
        return false;
    }

    // ✅ Check if user has permission
    hasPermission(phoneNumber, permission) {
        const user = this.users[phoneNumber];
        if (!user || !user.activated) return false;
        
        const permissions = this.getPermissionsForRole(user.role);
        return permissions.includes(permission);
    }

    // ✅ Get permissions for a role
    getPermissionsForRole(role) {
        const permissions = {
            [this.roles.ABBY]: ['download_website_media', 'search_website', 'list_downloads', 'check_subscription'],
            [this.roles.ADMIN]: [
                'download_website_media', 'search_website', 'list_downloads', 'check_subscription',
                'search_web', 'download_any_media', 'advanced_search', 'manage_subscriptions',
                'view_all_users', 'generate_otp', 'modify_limits', 'system_stats'
            ],
            [this.roles.NICCI]: [
                'manage_groups', 'moderate_messages', 'group_announcements',
                'join_groups', 'create_groups', 'send_group_messages',
                'export_group_links', 'view_group_stats'
            ]
        };
        return permissions[role] || [];
    }

    // ✅ Get welcome message based on role
    getWelcomeMessage(role, username = 'User') {
        const messages = {
            [this.roles.ABBY]: `👋 Welcome ${username}! 🤖\n\n📊 Your Download Limits:\n• 🎥 Videos: 5/13 hours\n• 🖼️ Images: 10/13 hours\n\n💎 Subscription Plans:\n• 1 Week: 50¢ (Unlimited)\n• 2 Weeks: 75¢ (Unlimited)\n\n💡 Commands:\n• !search <query> - Find media\n• !download <number> - Download\n• !mystats - Your usage\n• !subscribe - Get premium\n• !help - Show help`,
            
            [this.roles.ADMIN]: `👑 Welcome Admin ${username}! 🌟\n\n⚡ ADMIN PRIVILEGES ACTIVATED ⚡\n\n🎯 Unlimited Downloads\n📊 Access to All Users\n🔧 System Management\n💰 OTP Generation\n\n💡 Admin Commands:\n• !search <query> - Search website media\n• !websearch <query> - Search entire web\n• !download <number> - Download any media\n• !users - View all users\n• !genotp <phone> <plan> <days> - Generate OTP\n• !userinfo <phone> - User details\n• !sysinfo - System statistics\n• !help - Show help`,
            
            [this.roles.NICCI]: `🛡️ Welcome Nicci ${username}! ⚡\n\n🌐 GROUP MANAGEMENT MODE ACTIVATED 🌐\n\n🤖 Auto-join group links\n📤 Send messages to all groups\n📊 Group statistics tracking\n🔗 Group link management\n👥 Member management\n\n💡 Nicci Commands:\n• !joingroup <link> - Join group from link\n• !creategroup <name> - Create new group\n• !createchannel <name> - Create channel\n• !groupstats - Group statistics\n• !grouplinks - Export group links\n• !sendall <message> - Send to all groups\n• !help - Show help\n\n⚡ Controlled by: +263717457592`
        };
        
        return messages[role] || `Welcome ${username}! Use !help for commands.`;
    }

    // ✅ State management methods
    setUserState(phoneNumber, state) {
        if (this.users[phoneNumber]) {
            if (!this.users[phoneNumber].state) {
                this.users[phoneNumber].state = {};
            }
            this.users[phoneNumber].state.current = state;
            this.saveUsers();
        }
    }

    getUserState(phoneNumber) {
        return this.users[phoneNumber] && this.users[phoneNumber].state ? this.users[phoneNumber].state.current : null;
    }

    // ✅ Data management methods
    setUserData(phoneNumber, key, value) {
        if (this.users[phoneNumber]) {
            if (!this.users[phoneNumber].data) {
                this.users[phoneNumber].data = {};
            }
            this.users[phoneNumber].data[key] = value;
            this.saveUsers();
        }
    }

    getUserData(phoneNumber) {
        return this.users[phoneNumber] && this.users[phoneNumber].data ? this.users[phoneNumber].data : {};
    }

    clearUserState(phoneNumber) {
        if (this.users[phoneNumber] && this.users[phoneNumber].state) {
            delete this.users[phoneNumber].state.current;
            this.saveUsers();
        }
    }

    clearUserData(phoneNumber, prefix = '') {
        if (this.users[phoneNumber] && this.users[phoneNumber].data) {
            Object.keys(this.users[phoneNumber].data).forEach(key => {
                if (key.startsWith(prefix)) {
                    delete this.users[phoneNumber].data[key];
                }
            });
            this.saveUsers();
        }
    }

    // ✅ User statistics
    getUserCount() {
        return Object.keys(this.users).length;
    }

    getActiveUserCount() {
        return Object.values(this.users).filter(user => user.activated).length;
    }

    // ✅ User management
    deactivateUser(phoneNumber) {
        if (this.users[phoneNumber]) {
            this.users[phoneNumber].activated = false;
            this.saveUsers();
        }
    }

    updateUsername(phoneNumber, username) {
        if (this.users[phoneNumber]) {
            this.users[phoneNumber].username = username;
            this.saveUsers();
        }
    }

    getUsersByStatus(activated = true) {
        return Object.entries(this.users)
            .filter(([_, user]) => user.activated === activated)
            .reduce((acc, [phone, user]) => {
                acc[phone] = user;
                return acc;
            }, {});
    }

    searchUsers(query) {
        return Object.entries(this.users)
            .filter(([_, user]) => user.username && user.username.toLowerCase().includes(query.toLowerCase()))
            .reduce((acc, [phone, user]) => {
                acc[phone] = user;
                return acc;
            }, {});
    }

    // ✅ Cleanup inactive users
    cleanupInactiveUsers(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        let removedCount = 0;
        
        Object.keys(this.users).forEach(phoneNumber => {
            const user = this.users[phoneNumber];
            if (!user.activated && user.lastActive) {
                const lastActiveDate = new Date(user.lastActive);
                if (lastActiveDate < cutoffDate) {
                    delete this.users[phoneNumber];
                    removedCount++;
                }
            }
        });
        
        if (removedCount > 0) {
            this.saveUsers();
            console.log(`Cleaned up ${removedCount} inactive users older than ${days} days`);
        }
        
        return removedCount;
    }
}

module.exports = UserManager;            this.users[phoneNumber].activated = false;
            this.saveUsers();
        }
    }

    updateUsername(phoneNumber, username) {
        if (this.users[phoneNumber]) {
            this.users[phoneNumber].username = username;
            this.saveUsers();
        }
    }

    getUsersByStatus(activated = true) {
        return Object.entries(this.users)
            .filter(([_, user]) => user.activated === activated)
            .reduce((acc, [phone, user]) => {
                acc[phone] = user;
                return acc;
            }, {});
    }

    searchUsers(query) {
        return Object.entries(this.users)
            .filter(([_, user]) => user.username && user.username.toLowerCase().includes(query.toLowerCase()))
            .reduce((acc, [phone, user]) => {
                acc[phone] = user;
                return acc;
            }, {});
    }

    cleanupInactiveUsers(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        let removedCount = 0;
        
        Object.keys(this.users).forEach(phoneNumber => {
            const user = this.users[phoneNumber];
            if (!user.activated && user.lastActive) {
                const lastActiveDate = new Date(user.lastActive);
                if (lastActiveDate < cutoffDate) {
                    delete this.users[phoneNumber];
                    removedCount++;
                }
            }
        });
        
        if (removedCount > 0) {
            this.saveUsers();
            console.log(`Cleaned up ${removedCount} inactive users older than ${days} days`);
        }
        
        return removedCount;
    }
}

module.exports = UserManager;
