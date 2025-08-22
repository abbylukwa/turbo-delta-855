const fs = require('fs');
const path = require('path');

class DatingManager {
    constructor(userManager, subscriptionManager) {
        this.userManager = userManager;
        this.subscriptionManager = subscriptionManager;
        this.profilesFile = path.join(__dirname, 'data', 'dating_profiles.json');
        this.connectionsFile = path.join(__dirname, 'data', 'dating_connections.json');
        this.requestsFile = path.join(__dirname, 'data', 'dating_requests.json');
        this.ensureDataDirectoryExists();
        this.profiles = this.loadData(this.profilesFile);
        this.connections = this.loadData(this.connectionsFile);
        this.requests = this.loadData(this.requestsFile);
        this.userStates = {};
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Initialize files if they don't exist
        if (!fs.existsSync(this.profilesFile)) {
            fs.writeFileSync(this.profilesFile, JSON.stringify({}));
        }
        if (!fs.existsSync(this.connectionsFile)) {
            fs.writeFileSync(this.connectionsFile, JSON.stringify({}));
        }
        if (!fs.existsSync(this.requestsFile)) {
            fs.writeFileSync(this.requestsFile, JSON.stringify({}));
        }
    }

    loadData(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error loading data from ${filePath}:`, error);
            return {};
        }
    }

    saveData(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error saving data to ${filePath}:`, error);
        }
    }

    saveProfiles() {
        this.saveData(this.profilesFile, this.profiles);
    }

    saveConnections() {
        this.saveData(this.connectionsFile, this.connections);
    }

    saveRequests() {
        this.saveData(this.requestsFile, this.requests);
    }

    async handleDatingCommand(sock, sender, phoneNumber, username, text, message) {
        const lowerText = text.toLowerCase();
        
        if (lowerText === 'dating' || lowerText === 'date' || lowerText === 'match') {
            await this.showDatingMenu(sock, sender, username);
            return true;
        }
        
        if (lowerText === 'create profile' || lowerText === 'create dating profile') {
            await this.startProfileCreation(sock, sender, phoneNumber, username);
            return true;
        }
        
        if (lowerText === 'dating stats' || lowerText === 'my dating stats') {
            await this.showDatingStats(sock, sender, phoneNumber, username);
            return true;
        }
        
        if (lowerText === 'find matches' || lowerText === 'search matches') {
            await this.findMatches(sock, sender, phoneNumber, username);
            return true;
        }
        
        return false;
    }

    async showDatingMenu(sock, sender, username) {
        await sock.sendMessage(sender, {
            text: `👥 Dating Features for ${username}:\n\n` +
                  `1. 📝 Create Profile - *create profile*\n` +
                  `2. 🔍 Find Matches - *find matches*\n` +
                  `3. 💬 My Connections - *my connections*\n` +
                  `4. 📊 Dating Stats - *dating stats*\n\n` +
                  `*Note:* Premium feature for subscribed users only.`
        });
    }

    async startProfileCreation(sock, sender, phoneNumber, username) {
        // Check if user has active subscription
        if (!this.subscriptionManager.hasActiveSubscription(phoneNumber)) {
            await sock.sendMessage(sender, {
                text: `❌ Premium Feature\n\n` +
                      `Dating features require an active subscription. Please subscribe first using the *!subscribe* command.`
            });
            return;
        }

        // Set user state to profile creation
        this.userStates[phoneNumber] = { creatingProfile: true };
        
        await sock.sendMessage(sender, {
            text: `📝 Let's create your dating profile!\n\n` +
                  `Please send your information in this format:\n\n` +
                  `*Name:* Your Name\n` +
                  `*Age:* Your Age\n` +
                  `*Gender:* Male/Female\n` +
                  `*Location:* Your City\n` +
                  `*Interested In:* Male/Female/Both\n` +
                  `*Bio:* Short description about yourself\n\n` +
                  `Example:\n` +
                  `Name: John Doe\n` +
                  `Age: 25\n` +
                  `Gender: Male\n` +
                  `Location: Harare\n` +
                  `Interested In: Female\n` +
                  `Bio: Friendly and outgoing person looking for meaningful connections`
        });
    }

    async handleProfileCreation(sock, sender, phoneNumber, username, text, message) {
        // Check if user is in the middle of profile creation
        if (this.userStates[phoneNumber]?.creatingProfile) {
            try {
                const profileData = this.parseProfileData(text);
                this.createProfile(phoneNumber, profileData);
                
                // Clear user state
                delete this.userStates[phoneNumber];
                
                await sock.sendMessage(sender, {
                    text: `✅ Profile Created Successfully!\n\n` +
                          `Your dating profile is now active. Use *find matches* to discover people near you!`
                });
                
                return true;
            } catch (error) {
                console.error('Error creating profile:', error);
            }
        }
        
        return false;
    }

    parseProfileData(text) {
        const lines = text.split('\n');
        const data = {};
        
        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':').map(part => part.trim());
                if (key && value) {
                    data[key.toLowerCase()] = value;
                }
            }
        });
        
        return data;
    }

    createProfile(phoneNumber, profileData) {
        this.profiles[phoneNumber] = {
            ...profileData,
            phoneNumber: phoneNumber,
            createdAt: new Date().toISOString(),
            isActive: true,
            profileViews: 0,
            matches: 0
        };
        
        this.saveProfiles();
        return this.profiles[phoneNumber];
    }

    getProfile(phoneNumber) {
        return this.profiles[phoneNumber];
    }

    async showDatingStats(sock, sender, phoneNumber, username) {
        const profile = this.getProfile(phoneNumber);
        
        if (!profile) {
            await sock.sendMessage(sender, {
                text: `❌ No dating profile found.\n\n` +
                      `Create your profile first using *create profile*`
            });
            return;
        }
        
        await sock.sendMessage(sender, {
            text: `📊 Dating Stats for ${username}:\n\n` +
                  `👀 Profile Views: ${profile.profileViews || 0}\n` +
                  `💝 Matches: ${profile.matches || 0}\n` +
                  `📅 Member Since: ${new Date(profile.createdAt).toLocaleDateString()}\n` +
                  `📍 Location: ${profile.location || 'Not set'}\n` +
                  `🎯 Interested In: ${profile['interested in'] || 'Not set'}`
        });
    }

    async findMatches(sock, sender, phoneNumber, username) {
        const userProfile = this.getProfile(phoneNumber);
        
        if (!userProfile) {
            await sock.sendMessage(sender, {
                text: `❌ No dating profile found.\n\n` +
                      `Create your profile first using *create profile*`
            });
            return;
        }
        
        // Simple matching logic - just show some sample matches
        const sampleMatches = [
            "👩‍💼 Sarah, 26, Harare - Loves hiking and music",
            "👩‍🎨 Lisa, 28, Bulawayo - Artist and traveler",
            "👩‍🍳 Maria, 25, Mutare - Chef and food lover"
        ];
        
        await sock.sendMessage(sender, {
            text: `💝 Potential Matches for ${username}:\n\n` +
                  sampleMatches.join('\n') + 
                  `\n\n*Note:* This is a demo feature. Full matching system coming soon!`
        });
    }

    async handleConnectCommand(sock, sender, phoneNumber, username, text) {
        return false;
    }
}

module.exports = DatingManager;            if (line.includes(':')) {
                const [key, value] = line.split(':').map(part => part.trim());
                data[key.toLowerCase()] = value;
            }
        });
        
        return data;
    }

    createProfile(phoneNumber, profileData) {
        this.profiles[phoneNumber] = {
            ...profileData,
            phoneNumber: phoneNumber,
            createdAt: new Date().toISOString(),
            isActive: true,
            profileViews: 0,
            matches: 0
        };
        
        this.saveProfiles();
        return this.profiles[phoneNumber];
    }

    getProfile(phoneNumber) {
        return this.profiles[phoneNumber];
    }

    async handleConnectCommand(sock, sender, phoneNumber, username, text) {
        // Implement connection handling logic here
        return false;
    }
}

module.exports = DatingManager;
