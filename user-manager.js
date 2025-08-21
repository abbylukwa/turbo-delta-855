class UserManager {
    constructor() {
        this.users = new Map();
        this.roles = {
            ABBY: 'abby_user',    // Website media downloader
            ADMIN: 'admin_user',  // Free web searcher
            NICCI: 'nicci_user'   // Group manager
        };
        
        this.activationKeys = {
            'Abby0121': this.roles.ABBY,
            'Admin0121': this.roles.ADMIN,
            'Nicci0121': this.roles.NICCI
        };
    }

    // Authenticate user with activation key
    authenticateUser(phoneNumber, activationKey) {
        const role = this.activationKeys[activationKey];
        if (role) {
            this.users.set(phoneNumber, {
                role: role,
                activatedAt: new Date(),
                permissions: this.getPermissionsForRole(role)
            });
            console.log(`User ${phoneNumber} authenticated as ${role}`);
            return true;
        }
        return false;
    }

    // Get user role
    getUserRole(phoneNumber) {
        const user = this.users.get(phoneNumber);
        return user ? user.role : null;
    }

    // Check if user has specific role
    hasRole(phoneNumber, role) {
        const userRole = this.getUserRole(phoneNumber);
        return userRole === role;
    }

    // Get permissions for role
    getPermissionsForRole(role) {
        const permissions = {
            [this.roles.ABBY]: ['download_website_media', 'search_website', 'list_downloads'],
            [this.roles.ADMIN]: ['search_web', 'download_any_media', 'advanced_search'],
            [this.roles.NICCI]: ['manage_groups', 'moderate_messages', 'group_announcements']
        };
        return permissions[role] || [];
    }

    // Check if user has permission
    hasPermission(phoneNumber, permission) {
        const user = this.users.get(phoneNumber);
        return user && user.permissions.includes(permission);
    }

    // Get user info
    getUserInfo(phoneNumber) {
        const user = this.users.get(phoneNumber);
        if (!user) return null;
        
        return {
            role: user.role,
            activatedAt: user.activatedAt,
            permissions: user.permissions
        };
    }

    // List all users
    listUsers() {
        const users = [];
        this.users.forEach((user, phoneNumber) => {
            users.push({
                phoneNumber: phoneNumber,
                role: user.role,
                activatedAt: user.activatedAt
            });
        });
        return users;
    }

    // Remove user
    removeUser(phoneNumber) {
        return this.users.delete(phoneNumber);
    }

    // Get welcome message based on role
    getWelcomeMessage(role) {
        const messages = {
            [this.roles.ABBY]: `🤖 Welcome Abby User!\nYou can download media from our website.\n\nCommands:\n• !search <query> - Search media on website\n• !download <number> - Download selected media\n• !mydownloads - View your downloads\n• !help - Show help`,
            
            [this.roles.ADMIN]: `👑 Welcome Admin User!\nYou have free access to search and download from any website.\n\nCommands:\n• !websearch <query> - Search media on web\n• !download <number> - Download selected media\n• !advanced <query> - Advanced search\n• !help - Show help`,
            
            [this.roles.NICCI]: `🛡️ Welcome Pro User!\nYou have group management privileges.\n\nCommands:\n• !groupinfo - Show group info\n• !promote @user - Promote user\n• !demote @user - Demote user\n• !kick @user - Remove user\n• !help - Show help`
        };
        
        return messages[role] || 'Welcome! Use !help for available commands.';
    }
}

module.exports = UserManager;
