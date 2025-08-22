const fs = require('fs');
const path = require('path');

class UserManager {
    constructor() {
        this.usersFile = path.join(__dirname, 'data', 'users.json');
        this.ensureDataDirectoryExists();
        this.users = this.loadUsers();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.usersFile)) {
            fs.writeFileSync(this.usersFile, JSON.stringify({}));
        }
    }

    loadUsers() {
        try {
            const data = fs.readFileSync(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error);
            return {};
        }
    }

    saveUsers() {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    activateUser(phoneNumber, username) {
        this.users[phoneNumber] = {
            username,
            activated: true,
            activationDate: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        this.saveUsers();
    }

    isUserActivated(phoneNumber) {
        return this.users[phoneNumber] && this.users[phoneNumber].activated === true;
    }

    getUser(phoneNumber) {
        return this.users[phoneNumber];
    }

    updateLastActive(phoneNumber) {
        if (this.users[phoneNumber]) {
            this.users[phoneNumber].lastActive = new Date().toISOString();
            this.saveUsers();
        }
    }

    getAllUsers() {
        return this.users;
    }

    // State management methods
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
        return this.users[phoneNumber] && this.users[phoneNumber].state 
               ? this.users[phoneNumber].state.current : null;
    }

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
        return this.users[phoneNumber] && this.users[phoneNumber].data 
               ? this.users[phoneNumber].data : {};
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

    // Additional helper methods
    getUserCount() {
        return Object.keys(this.users).length;
    }

    getActiveUserCount() {
        return Object.values(this.users).filter(user => user.activated).length;
    }

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

    // Get users by activation status
    getUsersByStatus(activated = true) {
        return Object.entries(this.users)
            .filter(([_, user]) => user.activated === activated)
            .reduce((acc, [phone, user]) => {
                acc[phone] = user;
                return acc;
            }, {});
    }

    // Search users by username
    searchUsers(query) {
        return Object.entries(this.users)
            .filter(([_, user]) => 
                user.username && user.username.toLowerCase().includes(query.toLowerCase()))
            .reduce((acc, [phone, user]) => {
                acc[phone] = user;
                return acc;
            }, {});
    }

    // Clean up old inactive users (older than 30 days)
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

module.exports = UserManager;        }
    }

    loadUsers() {
        try {
            const data = fs.readFileSync(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error);
            return {};
        }
    }

    saveUsers() {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    activateUser(phoneNumber, username) {
        this.users[phoneNumber] = {
            username,
            activated: true,
            activationDate: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };
        this.saveUsers();
    }

    isUserActivated(phoneNumber) {
        return this.users[phoneNumber] && this.users[phoneNumber].activated === true;
    }

    getUser(phoneNumber) {
        return this.users[phoneNumber];
    }

    updateLastActive(phoneNumber) {
        if (this.users[phoneNumber]) {
            this.users[phoneNumber].lastActive = new Date().toISOString();
            this.saveUsers();
        }
    }

    getAllUsers() {
        return this.users;
    }
}

module.exports = UserManager;console.log('Starting WhatsApp Bot...');
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    process.exit(0);
});console.log('Starting WhatsApp Bot...');
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    process.exit(0);
});
