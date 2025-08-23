const fs = require('fs');
const path = require('path');

class DatingManager {
    constructor(userManager, subscriptionManager) {
        this.userManager = userManager;
        this.subscriptionManager = subscriptionManager;
        this.profilesFile = path.join(__dirname, 'data', 'dating_profiles.json');
        this.connectionsFile = path.join(__dirname, 'data', 'dating_connections.json');
        this.requestsFile = path.join(__dirname, 'data', 'dating_requests.json');
        this.userLastActivity = {};
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
            console.log(`✅ Created data directory: ${dataDir}`);
        }
        
        const files = [this.profilesFile, this.connectionsFile, this.requestsFile];
        files.forEach(file => {
            if (!fs.existsSync(file)) {
                fs.writeFileSync(file, JSON.stringify({}));
                console.log(`✅ Created data file: ${file}`);
            }
        });
    }

    loadData(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
            return {};
        } catch (error) {
            console.error(`Error loading data from ${filePath}:`, error);
            return {};
        }
    }

    saveProfiles() {
        try {
            fs.writeFileSync(this.profilesFile, JSON.stringify(this.profiles, null, 2));
        } catch (error) {
            console.error('Error saving profiles:', error);
        }
    }

    saveConnections() {
        try {
            fs.writeFileSync(this.connectionsFile, JSON.stringify(this.connections, null, 2));
        } catch (error) {
            console.error('Error saving connections:', error);
        }
    }

    saveRequests() {
        try {
            fs.writeFileSync(this.requestsFile, JSON.stringify(this.requests, null, 2));
        } catch (error) {
            console.error('Error saving requests:', error);
        }
    }

    activateDatingMode(phoneNumber) {
        if (!this.profiles[phoneNumber]) {
            this.profiles[phoneNumber] = {
                phoneNumber: phoneNumber,
                createdAt: new Date().toISOString(),
                isActive: true,
                profileViews: 0,
                matches: 0,
                datingEnabled: true,
                profileComplete: false
            };
            this.saveProfiles();
        } else {
            this.profiles[phoneNumber].datingEnabled = true;
            this.saveProfiles();
        }
        
        console.log(`✅ Dating mode activated for ${phoneNumber}`);
    }

    isDatingModeEnabled(phoneNumber) {
        const profile = this.profiles[phoneNumber];
        return profile && profile.datingEnabled === true;
    }

    trackUserActivity(phoneNumber) {
        this.userLastActivity[phoneNumber] = Date.now();
    }

    async checkInactiveUsers(sock) {
        const now = Date.now();
        const threeHours = 3 * 60 * 60 * 1000;
        
        for (const [phoneNumber, lastActivity] of Object.entries(this.userLastActivity)) {
            if (now - lastActivity > threeHours) {
                const user = await this.userManager.getUser(phoneNumber);
                if (user && user.isActivated && 
                    this.subscriptionManager.hasActiveSubscription(phoneNumber) &&
                    this.isDatingModeEnabled(phoneNumber)) {
                    await this.promptInactiveUser(sock, phoneNumber, user.username);
                    this.userLastActivity[phoneNumber] = now;
                }
            }
        }
    }

    async promptInactiveUser(sock, phoneNumber, username) {
        try {
            const sender = `${phoneNumber}@s.whatsapp.net`;
            await sock.sendMessage(sender, {
                text: `👋 Hello ${username}! It's been a while. Would you like to:\n\n` +
                      `1. 🔍 Browse profiles\n` +
                      `2. 💝 Check your matches\n` +
                      `3. 📊 View your dating stats\n\n` +
                      `Just reply with the number or option you're interested in!`
            });
        } catch (error) {
            console.error('Error prompting inactive user:', error);
        }
    }

    async handleDatingCommand(sock, sender, phoneNumber, username, text, message) {
        if (!this.isDatingModeEnabled(phoneNumber)) {
            await sock.sendMessage(sender, {
                text: `❌ Dating features are not enabled for your account.\n\n` +
                      `Please subscribe to activate dating mode.`
            });
            return true;
        }
        
        const lowerText = text.toLowerCase();
        this.trackUserActivity(phoneNumber);
        
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
        
        if (lowerText === 'find matches' || lowerText === 'search matches' || lowerText === 'browse profiles') {
            await this.findMatches(sock, sender, phoneNumber, username);
            return true;
        }
        
        if (lowerText === 'my matches' || lowerText === 'check matches') {
            await this.showMyMatches(sock, sender, phoneNumber, username);
            return true;
        }
        
        if (lowerText === 'edit profile' || lowerText === 'update profile') {
            await this.startProfileEdit(sock, sender, phoneNumber, username);
            return true;
        }
        
        // Handle responses to inactivity prompt
        if (lowerText === '1' || lowerText.includes('browse')) {
            await this.findMatches(sock, sender, phoneNumber, username);
            return true;
        }
        
        if (lowerText === '2' || lowerText.includes('matches')) {
            await this.showMyMatches(sock, sender, phoneNumber, username);
            return true;
        }
        
        if (lowerText === '3' || lowerText.includes('stats')) {
            await this.showDatingStats(sock, sender, phoneNumber, username);
            return true;
        }
        
        // Handle profile creation responses
        if (this.userStates[phoneNumber] && this.userStates[phoneNumber].creatingProfile) {
            await this.handleProfileCreation(sock, sender, phoneNumber, username, text);
            return true;
        }
        
        return false;
    }

    async showDatingMenu(sock, sender, username) {
        await sock.sendMessage(sender, {
            text: `💝 *Dating Menu* - Hello ${username}!\n\n` +
                  `1. 📝 Create/Edit Profile\n` +
                  `2. 🔍 Find Matches\n` +
                  `3. 💕 My Matches\n` +
                  `4. 📊 Dating Stats\n` +
                  `5. ❓ Help\n\n` +
                  `Reply with the number or option you want to explore!`
        });
    }

    async startProfileCreation(sock, sender, phoneNumber, username) {
        this.userStates[phoneNumber] = { 
            creatingProfile: true,
            profileData: {}
        };
        
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

    async handleProfileCreation(sock, sender, phoneNumber, username, text) {
        const state = this.userStates[phoneNumber];
        
        try {
            const lines = text.split('\n');
            const profileData = {};
            
            for (const line of lines) {
                if (line.includes(':')) {
                    const [key, value] = line.split(':').map(part => part.trim());
                    if (key && value) {
                        profileData[key.toLowerCase()] = value;
                    }
                }
            }
            
            if (Object.keys(profileData).length >= 5) {
                this.profiles[phoneNumber] = {
                    ...this.profiles[phoneNumber],
                    ...profileData,
                    profileComplete: true,
                    lastUpdated: new Date().toISOString()
                };
                
                this.saveProfiles();
                delete this.userStates[phoneNumber];
                
                await sock.sendMessage(sender, {
                    text: `✅ Profile created successfully!\n\n` +
                          `*Name:* ${profileData.name || 'Not set'}\n` +
                          `*Age:* ${profileData.age || 'Not set'}\n` +
                          `*Gender:* ${profileData.gender || 'Not set'}\n` +
                          `*Location:* ${profileData.location || 'Not set'}\n` +
                          `*Interested In:* ${profileData['interested in'] || 'Not set'}\n` +
                          `*Bio:* ${profileData.bio || 'Not set'}\n\n` +
                          `Use 'edit profile' to make changes.`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ Please provide all required information in the correct format.`
                });
            }
        } catch (error) {
            console.error('Profile creation error:', error);
            await sock.sendMessage(sender, {
                text: `❌ Error creating profile. Please try again.`
            });
        }
    }

    async showDatingStats(sock, sender, phoneNumber, username) {
        const profile = this.profiles[phoneNumber];
        
        if (!profile || !profile.profileComplete) {
            await sock.sendMessage(sender, {
                text: `❌ You need to create a dating profile first!\n\n` +
                      `Use 'create profile' to get started.`
            });
            return;
        }
        
        const matches = this.connections[phoneNumber] ? Object.keys(this.connections[phoneNumber]).length : 0;
        const profileViews = profile.profileViews || 0;
        
        await sock.sendMessage(sender, {
            text: `📊 *Dating Stats for ${username}*\n\n` +
                  `✅ Profile Complete: Yes\n` +
                  `👀 Profile Views: ${profileViews}\n` +
                  `💕 Total Matches: ${matches}\n` +
                  `📅 Member Since: ${new Date(profile.createdAt).toLocaleDateString()}\n\n` +
                  `Keep exploring to find more matches!`
        });
    }

    async findMatches(sock, sender, phoneNumber, username) {
        const userProfile = this.profiles[phoneNumber];
        
        if (!userProfile || !userProfile.profileComplete) {
            await sock.sendMessage(sender, {
                text: `❌ You need to create a dating profile first!\n\n` +
                      `Use 'create profile' to get started.`
            });
            return;
        }
        
        const interestedIn = userProfile['interested in'] || 'both';
        const userGender = userProfile.gender || '';
        
        // Find potential matches
        const potentialMatches = [];
        
        for (const [otherNumber, otherProfile] of Object.entries(this.profiles)) {
            if (otherNumber !== phoneNumber && 
                otherProfile.profileComplete && 
                otherProfile.datingEnabled) {
                
                const otherInterestedIn = otherProfile['interested in'] || 'both';
                const otherGender = otherProfile.gender || '';
                
                // Basic compatibility check
                if (this.isCompatible(interestedIn, userGender, otherInterestedIn, otherGender)) {
                    potentialMatches.push(otherProfile);
                }
            }
        }
        
        if (potentialMatches.length === 0) {
            await sock.sendMessage(sender, {
                text: `🔍 No matches found at the moment.\n\n` +
                      `Check back later or make sure your profile is complete!`
            });
            return;
        }
        
        // Show first 3 matches
        const matchesToShow = potentialMatches.slice(0, 3);
        let matchText = `🔍 *Found ${potentialMatches.length} potential matches!*\n\n`;
        
        matchesToShow.forEach((match, index) => {
            matchText += `*Match ${index + 1}:*\n` +
                        `👤 ${match.name || 'Unknown'}\n` +
                        `🎂 ${match.age || '?'} years\n` +
                        `📍 ${match.location || 'Unknown location'}\n` +
                        `📝 ${match.bio || 'No bio'}\n\n`;
        });
        
        if (potentialMatches.length > 3) {
            matchText += `... and ${potentialMatches.length - 3} more matches available!`;
        }
        
        matchText += `\n\nUse 'my matches' to see your connections.`;
        
        await sock.sendMessage(sender, {
            text: matchText
        });
    }

    isCompatible(userInterestedIn, userGender, otherInterestedIn, otherGender) {
        userInterestedIn = userInterestedIn.toLowerCase();
        otherInterestedIn = otherInterestedIn.toLowerCase();
        
        if (userInterestedIn === 'both' && otherInterestedIn === 'both') return true;
        if (userInterestedIn === 'both' && otherInterestedIn === otherGender.toLowerCase()) return true;
        if (otherInterestedIn === 'both' && userInterestedIn === userGender.toLowerCase()) return true;
        if (userInterestedIn === otherGender.toLowerCase() && otherInterestedIn === userGender.toLowerCase()) return true;
        
        return false;
    }

    async showMyMatches(sock, sender, phoneNumber, username) {
        const userMatches = this.connections[phoneNumber];
        
        if (!userMatches || Object.keys(userMatches).length === 0) {
            await sock.sendMessage(sender, {
                text: `💕 You don't have any matches yet.\n\n` +
                      `Use 'find matches' to discover people!`
            });
            return;
        }
        
        let matchesText = `💕 *Your Matches (${Object.keys(userMatches).length})*\n\n`;
        
        for (const [matchNumber, matchData] of Object.entries(userMatches)) {
            const matchProfile = this.profiles[matchNumber];
            if (matchProfile) {
                matchesText += `👤 *${matchProfile.name || 'Unknown'}*\n` +
                             `📞 ${matchNumber}\n` +
                             `📍 ${matchProfile.location || 'Unknown location'}\n` +
                             `📅 Connected: ${new Date(matchData.connectedAt).toLocaleDateString()}\n\n`;
            }
        }
        
        await sock.sendMessage(sender, {
            text: matchesText
        });
    }

    async startProfileEdit(sock, sender, phoneNumber, username) {
        const profile = this.profiles[phoneNumber];
        
        if (!profile || !profile.profileComplete) {
            await sock.sendMessage(sender, {
                text: `❌ You need to create a dating profile first!\n\n` +
                      `Use 'create profile' to get started.`
            });
            return;
        }
        
        await sock.sendMessage(sender, {
            text: `📝 *Your Current Profile:*\n\n` +
                  `Name: ${profile.name || 'Not set'}\n` +
                  `Age: ${profile.age || 'Not set'}\n` +
                  `Gender: ${profile.gender || 'Not set'}\n` +
                  `Location: ${profile.location || 'Not set'}\n` +
                  `Interested In: ${profile['interested in'] || 'Not set'}\n` +
                  `Bio: ${profile.bio || 'Not set'}\n\n` +
                  `To edit, send your updated information in the same format as profile creation.`
        });
        
        this.userStates[phoneNumber] = { editingProfile: true };
    }

    startInactivityChecker(sock, intervalMinutes = 30) {
        setInterval(() => {
            this.checkInactiveUsers(sock);
        }, intervalMinutes * 60 * 1000);
        
        console.log(`⏰ Inactivity checker started (checking every ${intervalMinutes} minutes)`);
    }
}

module.exports = DatingManager;
