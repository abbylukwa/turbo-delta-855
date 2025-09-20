const { Sequelize, DataTypes } = require('sequelize');
const express = require('express');
const cors = require('cors');

class DatingManager {
    constructor(userManager, subscriptionManager) {
        this.userManager = userManager;
        this.subscriptionManager = subscriptionManager;
        this.app = express();
        this.port = process.env.WEBSITE_PORT || 8080;

        // Parse MySQL connection string
        const connectionString = "Server=MYSQL5047.site4now.net;Database=db_abe793_dating;Uid=abe793_dating;Pwd=Abner0121";
        const config = this.parseMySqlConnectionString(connectionString);

        // Initialize MySQL database connection
        this.sequelize = new Sequelize(config.database, config.username, config.password, {
            host: config.server,
            dialect: 'mysql',
            logging: false,
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            },
            dialectOptions: {
                connectTimeout: 60000
            }
        });

        // Initialize models
        this.UserProfile = null;
        this.Connection = null;
        this.DatingMessage = null;

        this.userStates = {};
        this.userLastActivity = {};

        // Setup Express server for website
        this.setupExpress();
        this.initializeDatabase();
    }

    // Parse MySQL connection string
    parseMySqlConnectionString(connectionString) {
        const config = {};
        const parts = connectionString.split(';');
        
        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) {
                switch (key.trim().toLowerCase()) {
                    case 'server':
                        config.server = value.trim();
                        break;
                    case 'database':
                        config.database = value.trim();
                        break;
                    case 'uid':
                        config.username = value.trim();
                        break;
                    case 'pwd':
                        config.password = value.trim();
                        break;
                }
            }
        });

        return config;
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));

        // API Routes
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.getDatabaseStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch stats' });
            }
        });

        this.app.get('/api/users', async (req, res) => {
            try {
                const users = await this.UserProfile.findAll();
                res.json(users);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch users' });
            }
        });

        this.app.get('/api/users/recent', async (req, res) => {
            try {
                const users = await this.UserProfile.findAll({
                    order: [['createdAt', 'DESC']],
                    limit: 5
                });
                res.json(users);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch recent users' });
            }
        });

        this.app.get('/api/matches/recent', async (req, res) => {
            try {
                const matches = await this.Connection.findAll({
                    where: { status: 'accepted' },
                    order: [['createdAt', 'DESC']],
                    limit: 5,
                    include: [
                        { model: this.UserProfile, as: 'initiatorProfile' },
                        { model: this.UserProfile, as: 'receiverProfile' }
                    ]
                });
                
                const formattedMatches = matches.map(match => ({
                    user1: match.initiatorProfile?.name || match.user1,
                    user2: match.receiverProfile?.name || match.user2,
                    status: match.status,
                    createdAt: match.createdAt
                }));
                
                res.json(formattedMatches);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch recent matches' });
            }
        });

        // Start server
        this.app.listen(this.port, () => {
            console.log(`🌐 Dating Manager website running on port ${this.port}`);
        });
    }

    async initializeDatabase() {
        try {
            await this.sequelize.authenticate();
            console.log('✅ MySQL Dating Database connected successfully');

            this.defineModels();
            await this.sequelize.sync({ alter: true });
            console.log('✅ Dating database synchronized');

        } catch (error) {
            console.error('❌ Unable to connect to dating database:', error);
        }
    }

    defineModels() {
        // User Profile Model - Updated for MySQL compatibility
        this.UserProfile = this.sequelize.define('UserProfile', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            phoneNumber: {
                type: DataTypes.STRING(20),
                allowNull: false,
                unique: true
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            age: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            gender: {
                type: DataTypes.STRING(20),
                allowNull: true
            },
            location: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            interestedIn: {
                type: DataTypes.STRING(20),
                allowNull: true
            },
            bio: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            profilePhoto: {
                type: DataTypes.STRING(255),
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
            }
        }, {
            tableName: 'user_profiles',
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

        // Connection Model (Matches) - Updated for MySQL
        this.Connection = this.sequelize.define('Connection', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            user1: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            user2: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'blocked'),
                defaultValue: 'pending'
            },
            initiator: {
                type: DataTypes.STRING(20),
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
            tableName: 'connections',
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

        // Dating Message Model - Updated for MySQL
        this.DatingMessage = this.sequelize.define('DatingMessage', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            sender: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            receiver: {
                type: DataTypes.STRING(20),
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
            tableName: 'dating_messages',
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
        this.UserProfile.hasMany(this.Connection, { 
            foreignKey: 'user1', 
            as: 'initiatedConnections' 
        });
        this.UserProfile.hasMany(this.Connection, { 
            foreignKey: 'user2', 
            as: 'receivedConnections' 
        });
        this.Connection.belongsTo(this.UserProfile, { 
            foreignKey: 'user1', 
            as: 'initiatorProfile' 
        });
        this.Connection.belongsTo(this.UserProfile, { 
            foreignKey: 'user2', 
            as: 'receiverProfile' 
        });

        this.UserProfile.hasMany(this.DatingMessage, { 
            foreignKey: 'sender', 
            as: 'sentMessages' 
        });
        this.UserProfile.hasMany(this.DatingMessage, { 
            foreignKey: 'receiver', 
            as: 'receivedMessages' 
        });
    }

    async getDatabaseStats() {
        try {
            const totalUsers = await this.UserProfile.count();
            const activeUsers = await this.UserProfile.count({ 
                where: { datingEnabled: true } 
            });
            const completeProfiles = await this.UserProfile.count({ 
                where: { profileComplete: true } 
            });
            const totalMatches = await this.Connection.count({ 
                where: { status: 'accepted' } 
            });
            const totalMessages = await this.DatingMessage.count();
            
            // Calculate active today (users active in last 24 hours)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const activeToday = await this.UserProfile.count({
                where: {
                    lastActive: {
                        [Sequelize.Op.gte]: twentyFourHoursAgo
                    }
                }
            });

            return {
                totalUsers,
                activeUsers,
                completeProfiles,
                totalMatches,
                totalMessages,
                activeToday
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            return {
                totalUsers: 0,
                activeUsers: 0,
                completeProfiles: 0,
                totalMatches: 0,
                totalMessages: 0,
                activeToday: 0
            };
        }
    }

    // ... (rest of your existing DatingManager methods remain the same)

    async activateDatingMode(phoneNumber) {
        try {
            const [profile, created] = await this.UserProfile.findOrCreate({
                where: { phoneNumber },
                defaults: {
                    phoneNumber,
                    datingEnabled: true,
                    profileComplete: false,
                    profileViews: 0,
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

    // ... (all other methods remain unchanged from your original code)

    async closeConnection() {
        try {
            await this.sequelize.close();
            console.log('✅ Dating database connection closed');
        } catch (error) {
            console.error('Error closing database connection:', error);
        }
    }
}

module.exports = DatingManager;