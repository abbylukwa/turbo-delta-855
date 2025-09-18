const { Sequelize, DataTypes } = require('sequelize');

class DatingManager {
    constructor(userManager, subscriptionManager) {
        this.userManager = userManager;
        this.subscriptionManager = subscriptionManager;
        
        // Initialize database connection
        this.sequelize = new Sequelize('postgresql://datingmanagerdb_user:3SIFdxCHPKgiil3WubqeXkOUPJEbmOGi@dpg-d338pendiees739bhld0-a/datingmanagerdb', {
            dialect: 'postgres',
            logging: false, // Set to true for debugging
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        });

        // Initialize models
        this.UserProfile = null;
        this.Connection = null;
        this.DatingMessage = null;
        
        this.userStates = {};
        this.userLastActivity = {};

        // Initialize database
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            // Test connection
            await this.sequelize.authenticate();
            console.log('✅ PostgreSQL Dating Database connected successfully');

            // Define models
            this.defineModels();
            
            // Sync database
            await this.sequelize.sync({ alter: true });
            console.log('✅ Dating database synchronized');

        } catch (error) {
            console.error('❌ Unable to connect to dating database:', error);
        }
    }

    defineModels() {
        // User Profile Model
        this.UserProfile = this.sequelize.define('UserProfile', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            phoneNumber: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            age: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            gender: {
                type: DataTypes.STRING,
                allowNull: true
            },
            location: {
                type: DataTypes.STRING,
                allowNull: true
            },
            interestedIn: {
                type: DataTypes.STRING,
                allowNull: true
            },
            bio: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            profilePhoto: {
                type: DataTypes.STRING,
                allowNull: true
            },
            datingEnabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            profileComplete: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            profileViews: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            lastActive: {
                type: DataTypes.DATE,
                allowNull: true
            },
            isPremium: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            preferences: {
                type: DataTypes.JSONB,
                defaultValue: {}
            }
        }, {
            indexes: [
                {
                    fields: ['phoneNumber']
                },
                {
                    fields: ['location']
                },
                {
                    fields: ['age']
                },
                {
                    fields: ['gender']
                },
                {
                    fields: ['datingEnabled', 'profileComplete']
                }
            ]
        });

        // Connection Model (Matches)
        this.Connection = this.sequelize.define('Connection', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user1: {
                type: DataTypes.STRING,
                allowNull: false
            },
            user2: {
                type: DataTypes.STRING,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'blocked'),
                defaultValue: 'pending'
            },
            initiator: {
                type: DataTypes.STRING,
                allowNull: false
            },
            compatibilityScore: {
                type: DataTypes.FLOAT,
                defaultValue: 0
            },
            lastInteraction: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            }
        }, {
            indexes: [
                {
                    fields: ['user1', 'user2'],
                    unique: true
                },
                {
                    fields: ['status']
                },
                {
                    fields: ['user1']
                },
                {
                    fields: ['user2']
                }
            ]
        });

        // Dating Message Model
        this.DatingMessage = this.sequelize.define('DatingMessage', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            sender: {
                type: DataTypes.STRING,
                allowNull: false
            },
            receiver: {
                type: DataTypes.STRING,
                allowNull: false
            },
            message: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            messageType: {
                type: DataTypes.ENUM('text', 'image', 'video', 'audio'),
                defaultValue: 'text'
            },
            isRead: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },
            timestamp: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            }
        }, {
            indexes: [
                {
                    fields: ['sender', 'receiver']
                },
                {
                    fields: ['timestamp']
                },
                {
                    fields: ['isRead']
                }
            ]
        });

        // Define associations
        this.UserProfile.hasMany(this.Connection, { foreignKey: 'user1', as: 'initiatedConnections' });
        this.UserProfile.hasMany(this.Connection, { foreignKey: 'user2', as: 'receivedConnections' });
        this.Connection.belongsTo(this.UserProfile, { foreignKey: 'user1', as: 'initiatorProfile' });
        this.Connection.belongsTo(this.UserProfile, { foreignKey: 'user2', as: 'receiverProfile' });

        this.UserProfile.hasMany(this.DatingMessage, { foreignKey: 'sender', as: 'sentMessages' });
        this.UserProfile.hasMany(this.DatingMessage, { foreignKey: 'receiver', as: 'receivedMessages' });
    }

    async activateDatingMode(phoneNumber) {
        try {
            const [profile, created] = await this.UserProfile.findOrCreate({
                where: { phoneNumber },
                defaults: {
                    phoneNumber,
                    datingEnabled: true,
                    profileComplete: false,
                    profileViews: 0,
                    matches: 0,
                    lastActive: new Date()
                }
            });

            if (!created) {
                profile.datingEnabled = true;
                profile.lastActive = new Date();
                await profile.save();
            }

            console.log(`✅ Dating mode activated for ${phoneNumber}`);
            return true;
        } catch (error) {
            console.error('Error activating dating mode:', error);
            return false;
        }
    }

    async isDatingModeEnabled(phoneNumber) {
        try {
            const profile = await this.UserProfile.findOne({ where: { phoneNumber } });
            return profile && profile.datingEnabled === true;
        } catch (error) {
            console.error('Error checking dating mode:', error);
            return false;
        }
    }

    trackUserActivity(phoneNumber) {
        this.userLastActivity[phoneNumber] = Date.now();

        // Update last active in database
        this.UserProfile.update(
            { lastActive: new Date() },
            { where: { phoneNumber } }
        ).catch(error => console.error('Error updating last active:', error));
    }

    async checkInactiveUsers(sock) {
        try {
            const now = Date.now();
            const threeHours = 3 * 60 * 60 * 1000;

            for (const [phoneNumber, lastActivity] of Object.entries(this.userLastActivity)) {
                if (now - lastActivity > threeHours) {
                    const user = await this.userManager.getUser(phoneNumber);
                    if (user && user.isActivated && 
                        this.subscriptionManager.hasActiveSubscription(phoneNumber) &&
                        await this.isDatingModeEnabled(phoneNumber)) {
                        await this.promptInactiveUser(sock, phoneNumber, user.username);
                        this.userLastActivity[phoneNumber] = now;
                    }
                }
            }
        } catch (error) {
            console.error('Error checking inactive users:', error);
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
        if (!this.UserProfile) {
            await sock.sendMessage(sender, {
                text: `❌ Dating features are currently unavailable.\n\n` +
                      `Please try again later.`
            });
            return true;
        }

        if (!await this.isDatingModeEnabled(phoneNumber)) {
            await sock.sendMessage(sender, {
                text: `❌ Dating features are not enabled for your account.\n\n` +
                      `Please subscribe to activate dating mode.`
            });
            return true;
        }

        const lowerText = text.toLowerCase();
        this.trackUserActivity(phoneNumber);

        // Handle different dating commands
        const commandHandlers = {
            'dating': () => this.showDatingMenu(sock, sender, username),
            'date': () => this.showDatingMenu(sock, sender, username),
            'match': () => this.showDatingMenu(sock, sender, username),
            'create profile': () => this.startProfileCreation(sock, sender, phoneNumber, username),
            'create dating profile': () => this.startProfileCreation(sock, sender, phoneNumber, username),
            'dating stats': () => this.showDatingStats(sock, sender, phoneNumber, username),
            'my dating stats': () => this.showDatingStats(sock, sender, phoneNumber, username),
            'find matches': () => this.findMatches(sock, sender, phoneNumber, username),
            'search matches': () => this.findMatches(sock, sender, phoneNumber, username),
            'browse profiles': () => this.findMatches(sock, sender, phoneNumber, username),
            'my matches': () => this.showMyMatches(sock, sender, phoneNumber, username),
            'check matches': () => this.showMyMatches(sock, sender, phoneNumber, username),
            'edit profile': () => this.startProfileEdit(sock, sender, phoneNumber, username),
            'update profile': () => this.startProfileEdit(sock, sender, phoneNumber, username)
        };

        for (const [command, handler] of Object.entries(commandHandlers)) {
            if (lowerText.includes(command)) {
                await handler();
                return true;
            }
        }

        // Handle numeric responses to inactivity prompt
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
                        const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
                        profileData[normalizedKey] = value;
                    }
                }
            }

            if (Object.keys(profileData).length >= 5) {
                // Map normalized keys to database fields
                const updateData = {
                    name: profileData.name,
                    age: parseInt(profileData.age) || 0,
                    gender: profileData.gender,
                    location: profileData.location,
                    interestedIn: profileData.interestedin,
                    bio: profileData.bio,
                    profileComplete: true,
                    lastActive: new Date(),
                    lastUpdated: new Date()
                };

                await this.UserProfile.update(updateData, {
                    where: { phoneNumber }
                });

                delete this.userStates[phoneNumber];

                await sock.sendMessage(sender, {
                    text: `✅ Profile created successfully!\n\n` +
                          `*Name:* ${updateData.name || 'Not set'}\n` +
                          `*Age:* ${updateData.age || 'Not set'}\n` +
                          `*Gender:* ${updateData.gender || 'Not set'}\n` +
                          `*Location:* ${updateData.location || 'Not set'}\n` +
                          `*Interested In:* ${updateData.interestedIn || 'Not set'}\n` +
                          `*Bio:* ${updateData.bio || 'Not set'}\n\n` +
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
        try {
            const profile = await this.UserProfile.findOne({ where: { phoneNumber } });

            if (!profile || !profile.profileComplete) {
                await sock.sendMessage(sender, {
                    text: `❌ You need to create a dating profile first!\n\n` +
                          `Use 'create profile' to get started.`
                });
                return;
            }

            const matchCount = await this.Connection.count({
                where: {
                    [this.sequelize.Op.or]: [
                        { user1: phoneNumber, status: 'accepted' },
                        { user2: phoneNumber, status: 'accepted' }
                    ]
                }
            });

            await sock.sendMessage(sender, {
                text: `📊 *Dating Stats for ${username}*\n\n` +
                      `✅ Profile Complete: ${profile.profileComplete ? 'Yes' : 'No'}\n` +
                      `👀 Profile Views: ${profile.profileViews}\n` +
                      `💕 Total Matches: ${matchCount}\n` +
                      `📅 Member Since: ${profile.createdAt.toLocaleDateString()}\n\n` +
                      `Keep exploring to find more matches!`
            });
        } catch (error) {
            console.error('Error showing dating stats:', error);
            await sock.sendMessage(sender, {
                text: `❌ Error retrieving your stats. Please try again.`
            });
        }
    }

    async findMatches(sock, sender, phoneNumber, username) {
        try {
            const userProfile = await this.UserProfile.findOne({ where: { phoneNumber } });

            if (!userProfile || !userProfile.profileComplete) {
                await sock.sendMessage(sender, {
                    text: `❌ You need to create a dating profile first!\n\n` +
                          `Use 'create profile' to get started.`
                });
                return;
            }

            const interestedIn = userProfile.interestedIn || 'both';
            const userGender = userProfile.gender || '';

            // Find potential matches
            const potentialMatches = await this.UserProfile.findAll({
                where: {
                    phoneNumber: { [this.sequelize.Op.ne]: phoneNumber },
                    profileComplete: true,
                    datingEnabled: true
                },
                limit: 10,
                order: this.sequelize.random() // Random order for variety
            });

            // Filter by compatibility
            const compatibleMatches = potentialMatches.filter(otherProfile => {
                const otherInterestedIn = otherProfile.interestedIn || 'both';
                const otherGender = otherProfile.gender || '';
                return this.isCompatible(interestedIn, userGender, otherInterestedIn, otherGender);
            });

            if (compatibleMatches.length === 0) {
                await sock.sendMessage(sender, {
                    text: `🔍 No matches found at the moment.\n\n` +
                          `Check back later or make sure your profile is complete!`
                });
                return;
            }

            let matchText = `🔍 *Found ${compatibleMatches.length} potential matches!*\n\n`;

            compatibleMatches.slice(0, 3).forEach((match, index) => {
                matchText += `*Match ${index + 1}:*\n` +
                            `👤 ${match.name || 'Unknown'}\n` +
                            `🎂 ${match.age || '?'} years\n` +
                            `📍 ${match.location || 'Unknown location'}\n` +
                            `📝 ${match.bio ? match.bio.substring(0, 100) + '...' : 'No bio'}\n\n`;
            });

            if (compatibleMatches.length > 3) {
                matchText += `... and ${compatibleMatches.length - 3} more matches available!`;
            }

            matchText += `\n\nUse 'my matches' to see your connections.`;

            await sock.sendMessage(sender, {
                text: matchText
            });

            // Update profile views for shown matches
            compatibleMatches.forEach(match => {
                this.UserProfile.increment('profileViews', {
                    where: { phoneNumber: match.phoneNumber }
                }).catch(error => console.error('Error updating profile views:', error));
            });

        } catch (error) {
            console.error('Error finding matches:', error);
            await sock.sendMessage(sender, {
                text: `❌ Error finding matches. Please try again.`
            });
        }
    }

    isCompatible(userInterestedIn, userGender, otherInterestedIn, otherGender) {
        userInterestedIn = (userInterestedIn || 'both').toLowerCase();
        otherInterestedIn = (otherInterestedIn || 'both').toLowerCase();
        userGender = (userGender || '').toLowerCase();
        otherGender = (otherGender || '').toLowerCase();

        if (userInterestedIn === 'both' && otherInterestedIn === 'both') return true;
        if (userInterestedIn === 'both' && otherInterestedIn === otherGender) return true;
        if (otherInterestedIn === 'both' && userInterestedIn === userGender) return true;
        if (userInterestedIn === otherGender && otherInterestedIn === userGender) return true;

        return false;
    }

    async showMyMatches(sock, sender, phoneNumber, username) {
        try {
            const connections = await this.Connection.findAll({
                where: {
                    [this.sequelize.Op.or]: [
                        { user1: phoneNumber, status: 'accepted' },
                        { user2: phoneNumber, status: 'accepted' }
                    ]
                },
                include: [
                    {
                        model: this.UserProfile,
                        as: 'initiatorProfile',
                        attributes: ['name', 'location', 'age']
                    },
                    {
                        model: this.UserProfile,
                        as: 'receiverProfile',
                        attributes: ['name', 'location', 'age']
                    }
                ],
                order: [['lastInteraction', 'DESC']]
            });

            if (connections.length === 0) {
                await sock.sendMessage(sender, {
                    text: `💕 You don't have any matches yet.\n\n` +
                          `Use 'find matches' to discover people!`
                });
                return;
            }

            let matchesText = `💕 *Your Matches (${connections.length})*\n\n`;

            connections.forEach((connection, index) => {
                const isInitiator = connection.user1 === phoneNumber;
                const matchProfile = isInitiator ? connection.receiverProfile : connection.initiatorProfile;
                const matchNumber = isInitiator ? connection.user2 : connection.user1;

                matchesText += `👤 *${matchProfile?.name || 'Unknown'}*\n` +
                             `📞 ${matchNumber}\n` +
                             `🎂 ${matchProfile?.age || '?'} years\n` +
                             `📍 ${matchProfile?.location || 'Unknown location'}\n` +
                             `📅 Connected: ${connection.createdAt.toLocaleDateString()}\n\n`;
            });

            await sock.sendMessage(sender, {
                text: matchesText
            });

        } catch (error) {
            console.error('Error showing matches:', error);
            await sock.sendMessage(sender, {
                text: `❌ Error retrieving your matches. Please try again.`
            });
        }
    }

    async startProfileEdit(sock, sender, phoneNumber, username) {
        try {
            const profile = await this.UserProfile.findOne({ where: { phoneNumber } });

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
                      `Interested In: ${profile.interestedIn || 'Not set'}\n` +
                      `Bio: ${profile.bio || 'Not set'}\n\n` +
                      `To edit, send your updated information in the same format as profile creation.`
            });

            this.userStates[phoneNumber] = { editingProfile: true };

        } catch (error) {
            console.error('Error starting profile edit:', error);
            await sock.sendMessage(sender, {
                text: `❌ Error retrieving your profile. Please try again.`
            });
        }
    }

    startInactivityChecker(sock, intervalMinutes = 30) {
        setInterval(() => {
            this.checkInactiveUsers(sock);
        }, intervalMinutes * 60 * 1000);

        console.log(`⏰ Inactivity checker started (checking every ${intervalMinutes} minutes)`);
    }

    // Additional methods for database management
    async closeConnection() {
        try {
            await this.sequelize.close();
            console.log('✅ Dating database connection closed');
        } catch (error) {
            console.error('Error closing database connection:', error);
        }
    }

    async getDatabaseStats() {
        try {
            const totalUsers = await this.UserProfile.count();
            const activeUsers = await this.UserProfile.count({ where: { datingEnabled: true } });
            const completeProfiles = await this.UserProfile.count({ where: { profileComplete: true } });
            const totalMatches = await this.Connection.count({ where: { status: 'accepted' } });

            return {
                totalUsers,
                activeUsers,
                completeProfiles,
                totalMatches
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            return null;
        }
    }
}

module.exports = DatingManager;