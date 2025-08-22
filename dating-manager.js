const fs = require('fs');
const path = require('path');

class DatingManager {
    constructor(userManager, subscriptionManager) {
        this.userManager = userManager;
        this.subscriptionManager = subscriptionManager;
        this.profilesFile = path.join(__dirname, 'data', 'dating_profiles.json');
        this.ensureDataDirectoryExists();
        this.profiles = this.loadProfiles();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.profilesFile)) {
            fs.writeFileSync(this.profilesFile, JSON.stringify({}));
        }
    }

    loadProfiles() {
        try {
            const data = fs.readFileSync(this.profilesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading dating profiles:', error);
            return {};
        }
    }

    saveProfiles() {
        try {
            fs.writeFileSync(this.profilesFile, JSON.stringify(this.profiles, null, 2));
        } catch (error) {
            console.error('Error saving dating profiles:', error);
        }
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
        // This is a simplified version - you'd want to implement proper state management
        if (text.includes('Name:') && text.includes('Age:') && text.includes('Gender:')) {
            try {
                const profileData = this.parseProfileData(text);
                this.createProfile(phoneNumber, profileData);
                
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
