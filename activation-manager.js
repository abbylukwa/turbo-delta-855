const fs = require('fs').promises;
const path = require('path');

class UserManager {
    constructor() {
        this.usersFile = path.join(__dirname, 'data', 'users.json');
        this.activationCodes = {
            admin: 'Pretty0121',
            groupManager: 'Abner0121',
            general: 'Abbie0121'
        };
        this.userRoles = {
            admin: 'admin',
            groupManager: 'group-manager',
            user: 'user'
        };
        this.welcomeMessages = {
            admin: (username) => `👑 Welcome Admin ${username}! 🌟\n\n⚡ ADMIN PRIVILEGES ACTIVATED ⚡\n\n🎯 Unlimited Downloads\n📊 Access to All Users\n🔧 System Management\n💰 OTP Generation\n\n💡 Admin Commands:\n• !search <query> - Search website media\n• !websearch <query> - Search entire web\n• !download <number> - Download any media\n• !users - View all users\n• !genotp <phone> <plan> <days> - Generate OTP\n• !userinfo <phone> - User details\n• !sysinfo - System statistics\n• !help - Show help`,
            
            groupManager: (username) => `🛡️ Welcome Group Manager ${username}! ⚡\n\n🌐 GROUP MANAGEMENT MODE ACTIVATED 🌐\n\n🤖 Auto-join group links\n📤 Send messages to all groups\n📊 Group statistics tracking\n🔗 Group link management\n👥 Member management\n\n💡 Group Manager Commands:\n• !joingroup <link> - Join group from link\n• !creategroup <name> - Create new group\n• !createchannel <name> - Create channel\n• !groupstats - Group statistics\n• !grouplinks - Export group links\n• !sendall <message> - Send to all groups\n• !help - Show help\n\n⚡ Controlled by: +263717457592`,
            
            user: (username) => `👋 Welcome ${username}! 🤖\n\n📊 Your Download Limits:\n• 🎥 Videos: 5/13 hours\n• 🖼️ Images: 10/13 hours\n\n💎 Subscription Plans:\n• 1 Week: 50¢ (Unlimited)\n• 2 Weeks: 75¢ (Unlimited)\n\n💡 Commands:\n• !search <query> - Find media\n• !download <number> - Download\n• !mystats - Your usage\n• !subscribe - Get premium\n• !help - Show help`
        };
        this.initialize();
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
            
            // Check if users file exists, create if it doesn't
            try {
                await fs.access(this.usersFile);
            } catch (error) {
                await this.saveUsers({});
            }
        } catch (error) {
            console.error('Error initializing UserManager:', error);
        }
    }

    async loadUsers() {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error);
            return {};
        }
    }

    async saveUsers(users) {
        try {
            await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    validateActivationCode(code, role) {
        return code === this.activationCodes[role];
    }

    getRoleFromActivationCode(code) {
        for (const [role, activationCode] of Object.entries(this.activationCodes)) {
            if (code === activationCode) {
                return role;
            }
        }
        return null;
    }

    getWelcomeMessage(role, username) {
        const messageFunction = this.welcomeMessages[role] || this.welcomeMessages.user;
        return messageFunction(username);
    }

    async registerUser(phoneNumber, username, activationCode, referredBy = null) {
        try {
            const users = await this.loadUsers();
            
            // Check if user already exists
            if (users[phoneNumber]) {
                return { success: false, message: 'User already registered' };
            }
            
            // Determine user role based on activation code
            const role = this.getRoleFromActivationCode(activationCode) || this.userRoles.user;
            
            // Create new user
            users[phoneNumber] = {
                username: username,
                phoneNumber: phoneNumber,
                role: role,
                isActivated: false,
                activationCodeUsed: activationCode,
                registrationDate: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                referredBy: referredBy,
                referrals: [],
                profile: {
                    age: null,
                    gender: null,
                    location: null,
                    interests: [],
                    bio: null,
                    profilePicture: null
                },
                subscription: {
                    isActive: false,
                    type: null,
                    startDate: null,
                    endDate: null
                },
                datingProfile: {
                    isActive: false,
                    preferences: {
                        minAge: 18,
                        maxAge: 99,
                        gender: 'any',
                        location: null
                    },
                    matches: [],
                    likes: [],
                    dislikes: []
                },
                stats: {
                    messagesSent: 0,
                    commandsUsed: 0,
                    mediaDownloaded: 0
                },
                permissions: this.getDefaultPermissions(role)
            };
            
            // Add referral to referrer if applicable
            if (referredBy && users[referredBy]) {
                users[referredBy].referrals.push(phoneNumber);
            }
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error registering user:', error);
            return { success: false, message: 'Registration failed' };
        }
    }

    getDefaultPermissions(role) {
        const basePermissions = {
            canUseBasicCommands: true,
            canDownloadMedia: true,
            canCreateDatingProfile: true
        };
        
        switch(role) {
            case this.userRoles.admin:
                return {
                    ...basePermissions,
                    canManageUsers: true,
                    canManageGroups: true,
                    canActivateSubscriptions: true,
                    canBroadcastMessages: true,
                    canViewStatistics: true,
                    canUseAdminCommands: true
                };
            case this.userRoles.groupManager:
                return {
                    ...basePermissions,
                    canManageGroups: true,
                    canJoinGroups: true,
                    canInviteToGroups: true
                };
            default:
                return basePermissions;
        }
    }

    async getUser(phoneNumber) {
        try {
            const users = await this.loadUsers();
            return users[phoneNumber] || null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    async updateUser(phoneNumber, updates) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            // Update user properties
            users[phoneNumber] = { ...users[phoneNumber], ...updates };
            users[phoneNumber].lastSeen = new Date().toISOString();
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, message: 'Update failed' };
        }
    }

    async activateUser(phoneNumber) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            users[phoneNumber].isActivated = true;
            users[phoneNumber].activationDate = new Date().toISOString();
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error activating user:', error);
            return { success: false, message: 'Activation failed' };
        }
    }

    isUserActivated(phoneNumber) {
        return this.getUser(phoneNumber).then(user => {
            return user ? user.isActivated : false;
        }).catch(() => false);
    }

    isAdmin(phoneNumber) {
        return this.getUser(phoneNumber).then(user => {
            return user ? user.role === this.userRoles.admin : false;
        }).catch(() => false);
    }

    isGroupManager(phoneNumber) {
        return this.getUser(phoneNumber).then(user => {
            return user ? user.role === this.userRoles.groupManager : false;
        }).catch(() => false);
    }

    async updateUserProfile(phoneNumber, profileUpdates) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            // Update profile properties
            users[phoneNumber].profile = { 
                ...users[phoneNumber].profile, 
                ...profileUpdates 
            };
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error updating user profile:', error);
            return { success: false, message: 'Profile update failed' };
        }
    }

    async incrementUserStat(phoneNumber, statName) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return false;
            }
            
            if (users[phoneNumber].stats[statName] !== undefined) {
                users[phoneNumber].stats[statName] += 1;
                await this.saveUsers(users);
            }
            
            return true;
        } catch (error) {
            console.error('Error incrementing user stat:', error);
            return false;
        }
    }

    async getAllUsers() {
        try {
            return await this.loadUsers();
        } catch (error) {
            console.error('Error getting all users:', error);
            return {};
        }
    }

    async getUsersByRole(role) {
        try {
            const users = await this.loadUsers();
            const filteredUsers = {};
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                if (user.role === role) {
                    filteredUsers[phoneNumber] = user;
                }
            }
            
            return filteredUsers;
        } catch (error) {
            console.error('Error getting users by role:', error);
            return {};
        }
    }

    async getActiveUsers(days = 7) {
        try {
            const users = await this.loadUsers();
            const activeUsers = {};
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                const lastSeen = new Date(user.lastSeen);
                if (lastSeen >= cutoffDate && user.isActivated) {
                    activeUsers[phoneNumber] = user;
                }
            }
            
            return activeUsers;
        } catch (error) {
            console.error('Error getting active users:', error);
            return {};
        }
    }

    async searchUsers(criteria) {
        try {
            const users = await this.loadUsers();
            const results = {};
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                let matches = true;
                
                for (const [key, value] of Object.entries(criteria)) {
                    if (key.includes('.')) {
                        // Handle nested properties (e.g., 'profile.age')
                        const keys = key.split('.');
                        let nestedValue = user;
                        for (const k of keys) {
                            nestedValue = nestedValue[k];
                            if (nestedValue === undefined) break;
                        }
                        
                        if (nestedValue !== value) {
                            matches = false;
                            break;
                        }
                    } else if (user[key] !== value) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches) {
                    results[phoneNumber] = user;
                }
            }
            
            return results;
        } catch (error) {
            console.error('Error searching users:', error);
            return {};
        }
    }

    async deleteUser(phoneNumber) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            // Remove user from their referrer's referrals
            const referredBy = users[phoneNumber].referredBy;
            if (referredBy && users[referredBy]) {
                users[referredBy].referrals = users[referredBy].referrals.filter(
                    ref => ref !== phoneNumber
                );
            }
            
            // Remove user
            delete users[phoneNumber];
            
            await this.saveUsers(users);
            return { success: true, message: 'User deleted successfully' };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, message: 'Deletion failed' };
        }
    }

    async getUsersCount() {
        try {
            const users = await this.loadUsers();
            return Object.keys(users).length;
        } catch (error) {
            console.error('Error getting users count:', error);
            return 0;
        }
    }

    async getActivatedUsersCount() {
        try {
            const users = await this.loadUsers();
            return Object.values(users).filter(user => user.isActivated).length;
        } catch (error) {
            console.error('Error getting activated users count:', error);
            return 0;
        }
    }

    async changeUserRole(phoneNumber, newRole) {
        try {
            const users = await this.loadUsers();
            
            if (!users[phoneNumber]) {
                return { success: false, message: 'User not found' };
            }
            
            if (!Object.values(this.userRoles).includes(newRole)) {
                return { success: false, message: 'Invalid role' };
            }
            
            users[phoneNumber].role = newRole;
            users[phoneNumber].permissions = this.getDefaultPermissions(newRole);
            
            await this.saveUsers(users);
            return { success: true, user: users[phoneNumber] };
        } catch (error) {
            console.error('Error changing user role:', error);
            return { success: false, message: 'Role change failed' };
        }
    }

    getActivationCodes() {
        return this.activationCodes;
    }

    getUserRoles() {
        return this.userRoles;
    }
}

module.exports = UserManager;
