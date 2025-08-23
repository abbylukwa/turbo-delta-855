const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
        
        // ADD YOUR CHAT BOT ENDPOINTS HERE (primary and backups)
        this.chatEndpoints = [
            'http://67ygf.to/chat', // Primary endpoint
            'http://backup-chat-api.com/chat', // Backup 1
            'http://another-chat-service.com/api' // Backup 2
        ];
    }

    // Activate dating mode for a user (call this after successful subscription)
    activateDatingMode(phoneNumber) {
        if (!this.profiles[phoneNumber]) {
            // Create a basic profile if one doesn't exist
            this.profiles[phoneNumber] = {
                phoneNumber: phoneNumber,
                createdAt: new Date().toISOString(),
                isActive: true,
                profileViews: 0,
                matches: 0,
                datingEnabled: true
            };
            this.saveProfiles();
        } else {
            // Enable dating mode for existing profile
            this.profiles[phoneNumber].datingEnabled = true;
            this.saveProfiles();
        }
        
        console.log(`✅ Dating mode activated for ${phoneNumber}`);
    }

    // Check if dating mode is enabled for user
    isDatingModeEnabled(phoneNumber) {
        const profile = this.profiles[phoneNumber];
        return profile && profile.datingEnabled === true;
    }

    // Track user activity
    trackUserActivity(phoneNumber) {
        this.userLastActivity[phoneNumber] = Date.now();
    }

    // Check for inactive users and prompt them (only if dating mode is enabled)
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

    // Prompt inactive user with options
    async promptInactiveUser(sock, phoneNumber, username) {
        try {
            const sender = `${phoneNumber}@s.whatsapp.net`;
            await sock.sendMessage(sender, {
                text: `👋 Hello ${username}! It's been a while. Would you like to:\n\n` +
                      `1. 🔍 Search for new content\n` +
                      `2. 💝 Explore dating features\n` +
                      `3. 💬 Chat with me\n\n` +
                      `Just reply with the number or option you're interested in!`
            });
        } catch (error) {
            console.error('Error prompting inactive user:', error);
        }
    }

    // Handle AI chat requests with fallback endpoints
    async handleAIChat(sock, sender, phoneNumber, username, text) {
        try {
            const chatMessage = text.replace(/(chat with me|chat|talk)/gi, '').trim();
            
            if (!chatMessage) {
                await sock.sendMessage(sender, {
                    text: `💬 I'd love to chat! What would you like to talk about?`
                });
                return true;
            }
            
            await sock.sendMessage(sender, {
                text: `💭 Thinking...`
            });
            
            // Try each endpoint until one works
            const aiResponse = await this.getAIResponseWithFallback(chatMessage, phoneNumber);
            
            await sock.sendMessage(sender, {
                text: `🤖 ${aiResponse}`
            });
            
            return true;
        } catch (error) {
            console.error('AI chat error:', error);
            await sock.sendMessage(sender, {
                text: `❌ Sorry, I'm having trouble connecting right now. Please try again later.`
            });
            return true;
        }
    }

    // Try multiple endpoints with fallback
    async getAIResponseWithFallback(message, phoneNumber) {
        let lastError = null;
        
        for (const endpoint of this.chatEndpoints) {
            try {
                const response = await axios.post(endpoint, {
                    message: message,
                    user_id: phoneNumber,
                    timestamp: new Date().toISOString()
                }, {
                    timeout: 8000 // 8 second timeout per endpoint
                });
                
                if (response.data && response.data.response) {
                    console.log(`✅ AI response from ${endpoint}`);
                    return response.data.response;
                }
            } catch (error) {
                console.log(`❌ Failed to connect to ${endpoint}:`, error.message);
                lastError = error;
                // Continue to next endpoint
            }
        }
        
        // If all endpoints failed
        throw lastError || new Error('All chat endpoints failed');
    }

    // Modified to check if dating mode is enabled
    async handleDatingCommand(sock, sender, phoneNumber, username, text, message) {
        // Check if dating mode is enabled for this user
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
        
        if (lowerText === 'find matches' || lowerText === 'search matches') {
            await this.findMatches(sock, sender, phoneNumber, username);
            return true;
        }
        
        // Handle AI chat requests
        if (lowerText.includes('chat with me') || lowerText.includes('chat') || 
            lowerText.includes('talk') || lowerText === '3') {
            return await this.handleAIChat(sock, sender, phoneNumber, username, text);
        }
        
        // Handle responses to inactivity prompt
        if (lowerText === '1' || lowerText.includes('search')) {
            await sock.sendMessage(sender, {
                text: `🔍 Great! What would you like to search for? Just type 'search' followed by your query.`
            });
            return true;
        }
        
        if (lowerText === '2' || lowerText.includes('dating')) {
            await this.showDatingMenu(sock, sender, username);
            return true;
        }
        
        return false;
    }

    // Update profile creation to require dating mode
    async startProfileCreation(sock, sender, phoneNumber, username) {
        if (!this.isDatingModeEnabled(phoneNumber)) {
            await sock.sendMessage(sender, {
                text: `❌ Dating features are not enabled for your account.\n\n` +
                      `Please subscribe to activate dating mode.`
            });
            return;
        }

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

    // ... (keep all other existing methods unchanged) ...

    // Add this method to regularly check for inactive users
    startInactivityChecker(sock, intervalMinutes = 30) {
        setInterval(() => {
            this.checkInactiveUsers(sock);
        }, intervalMinutes * 60 * 1000);
        
        console.log(`⏰ Inactivity checker started (checking every ${intervalMinutes} minutes)`);
    }
}

module.exports = DatingManager;
