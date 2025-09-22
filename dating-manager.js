
const fs = require('fs').promises;
const path = require('path');

class ChatStorageMigrator {
    constructor() {
        this.oldDataPath = path.join(__dirname, 'old_data');
        this.chatStoragePath = path.join(__dirname, 'chat_storage');
        this.userChatsPath = path.join(this.chatStoragePath, 'users');
        this.systemChatsPath = path.join(this.chatStoragePath, 'system');
        
        // Track migration statistics
        this.stats = {
            users: { migrated: 0, skipped: 0, errors: 0 },
            subscriptions: { migrated: 0, errors: 0 },
            payments: { migrated: 0, errors: 0 },
            matches: { migrated: 0, skipped: 0, errors: 0 }
        };
    }

    async migrateAll() {
        const startTime = Date.now();
        try {
            console.log('🚀 Starting data migration to chat storage...');
            
            await this.ensureDirectories();
            await this.migrateUsers();
            await this.migrateSubscriptions();
            await this.migratePayments();
            await this.migrateDatingData();
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Data migration completed successfully in ${duration}s!`);
            console.log('📊 Migration Statistics:');
            console.log(`   Users: ${this.stats.users.migrated} migrated, ${this.stats.users.skipped} skipped, ${this.stats.users.errors} errors`);
            console.log(`   Subscriptions: ${this.stats.subscriptions.migrated} migrated, ${this.stats.subscriptions.errors} errors`);
            console.log(`   Payments: ${this.stats.payments.migrated} migrated, ${this.stats.payments.errors} errors`);
            console.log(`   Matches: ${this.stats.matches.migrated} migrated, ${this.stats.matches.skipped} skipped, ${this.stats.matches.errors} errors`);
            
            return this.stats;
        } catch (error) {
            console.error('❌ Data migration failed:', error);
            throw error;
        }
    }

    async ensureDirectories() {
        const directories = [this.oldDataPath, this.chatStoragePath, this.userChatsPath, this.systemChatsPath];
        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✅ Directory ensured: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.warn(`⚠️ Could not create directory ${dir}:`, error.message);
                }
            }
        }
    }

    async migrateUsers() {
        try {
            const oldUsersPath = path.join(this.oldDataPath, 'users.json');
            if (!await this.fileExists(oldUsersPath)) {
                console.log('ℹ️ No users.json file found to migrate');
                return;
            }

            const fileContent = await fs.readFile(oldUsersPath, 'utf8');
            if (!fileContent.trim()) {
                console.log('ℹ️ users.json file is empty');
                return;
            }

            const oldUsers = JSON.parse(fileContent);
            console.log(`📊 Found ${Object.keys(oldUsers).length} users to migrate`);

            let processed = 0;
            const totalUsers = Object.keys(oldUsers).length;

            for (const [phone, userData] of Object.entries(oldUsers)) {
                try {
                    // Validate required fields
                    if (!userData || !userData.username) {
                        console.warn(`⚠️ Skipping user ${phone}: invalid data structure`);
                        this.stats.users.skipped++;
                        continue;
                    }

                    // Create user chat file
                    const userChatPath = path.join(this.userChatsPath, `${phone}.json`);
                    
                    // Format user data as chat messages
                    const chatMessages = [
                        {
                            type: 'system',
                            timestamp: new Date().toISOString(),
                            message: `USER PROFILE CREATED - ${userData.username}`
                        },
                        {
                            type: 'profile_data',
                            timestamp: new Date().toISOString(),
                            data: {
                                phone: phone,
                                username: userData.username,
                                age: userData.profile?.age || null,
                                gender: userData.profile?.gender || null,
                                location: userData.profile?.location || null,
                                bio: userData.profile?.bio || '',
                                interests: userData.profile?.interests || []
                            }
                        }
                    ];

                    // Save as chat messages
                    await fs.writeFile(
                        userChatPath,
                        JSON.stringify(chatMessages, null, 2)
                    );
                    
                    this.stats.users.migrated++;
                    
                    processed++;
                    if (processed % 50 === 0 || processed === totalUsers) {
                        console.log(`   Processed ${processed}/${totalUsers} users`);
                    }
                } catch (error) {
                    console.error(`❌ Error migrating user ${phone}:`, error.message);
                    this.stats.users.errors++;
                }
            }
            
            console.log('✅ Users migrated to chat storage');
        } catch (error) {
            console.error('❌ Error in users migration:', error);
            throw error;
        }
    }

    async migrateSubscriptions() {
        try {
            const oldSubsPath = path.join(this.oldDataPath, 'subscriptions.json');
            if (!await this.fileExists(oldSubsPath)) {
                console.log('ℹ️ No subscriptions.json file found to migrate');
                return;
            }

            const oldSubs = JSON.parse(await fs.readFile(oldSubsPath, 'utf8'));
            
            // Create subscription chat file
            const subsChatPath = path.join(this.systemChatsPath, 'subscriptions.json');
            const chatMessages = [
                {
                    type: 'system',
                    timestamp: new Date().toISOString(),
                    message: 'SUBSCRIPTIONS DATA MIGRATED'
                },
                {
                    type: 'subscriptions_data',
                    timestamp: new Date().toISOString(),
                    data: oldSubs
                }
            ];
            
            await fs.writeFile(
                subsChatPath,
                JSON.stringify(chatMessages, null, 2)
            );
            
            this.stats.subscriptions.migrated = Object.keys(oldSubs).length;
            console.log('✅ Subscriptions migrated to chat storage');
        } catch (error) {
            console.error('❌ Error migrating subscriptions:', error);
            this.stats.subscriptions.errors++;
        }
    }

    async migratePayments() {
        try {
            const oldPaymentsPath = path.join(this.oldDataPath, 'payments.json');
            if (!await this.fileExists(oldPaymentsPath)) {
                console.log('ℹ️ No payments.json file found to migrate');
                return;
            }

            const oldPayments = JSON.parse(await fs.readFile(oldPaymentsPath, 'utf8'));
            
            // Create payments chat file
            const paymentsChatPath = path.join(this.systemChatsPath, 'payments.json');
            const chatMessages = [
                {
                    type: 'system',
                    timestamp: new Date().toISOString(),
                    message: 'PAYMENTS DATA MIGRATED'
                },
                {
                    type: 'payments_data',
                    timestamp: new Date().toISOString(),
                    data: oldPayments
                }
            ];
            
            await fs.writeFile(
                paymentsChatPath,
                JSON.stringify(chatMessages, null, 2)
            );
            
            this.stats.payments.migrated = Object.keys(oldPayments).length;
            console.log('✅ Payments migrated to chat storage');
        } catch (error) {
            console.error('❌ Error migrating payments:', error);
            this.stats.payments.errors++;
        }
    }

    async migrateDatingData() {
        try {
            const oldDatingPath = path.join(this.oldDataPath, 'dating.json');
            if (!await this.fileExists(oldDatingPath)) {
                console.log('ℹ️ No dating.json file found to migrate');
                return;
            }

            const oldDating = JSON.parse(await fs.readFile(oldDatingPath, 'utf8'));
            
            // Count total matches first for progress reporting
            let totalMatches = 0;
            for (const userData of Object.values(oldDating)) {
                if (userData.matches && Array.isArray(userData.matches)) {
                    totalMatches += userData.matches.length;
                }
            }
            
            if (totalMatches === 0) {
                console.log('ℹ️ No matches found to migrate');
                return;
            }
            
            console.log(`📊 Found ${totalMatches} matches to migrate`);
            
            // Create matches chat file
            const matchesChatPath = path.join(this.systemChatsPath, 'matches.json');
            const chatMessages = [
                {
                    type: 'system',
                    timestamp: new Date().toISOString(),
                    message: 'MATCHES DATA MIGRATED'
                }
            ];
            
            // Add each match as a chat message
            let processed = 0;
            for (const [phone, userData] of Object.entries(oldDating)) {
                if (userData.matches && Array.isArray(userData.matches)) {
                    for (const match of userData.matches) {
                        // Ensure we don't create duplicate or self-matches
                        if (phone !== match) {
                            chatMessages.push({
                                type: 'match_data',
                                timestamp: new Date().toISOString(),
                                data: {
                                    user1: phone,
                                    user2: match,
                                    match_score: 80,
                                    status: 'matched'
                                }
                            });
                            
                            processed++;
                            if (processed % 100 === 0) {
                                console.log(`   Processed ${processed}/${totalMatches} matches`);
                            }
                            
                            this.stats.matches.migrated++;
                        } else {
                            this.stats.matches.skipped++;
                        }
                    }
                }
            }
            
            // Save all matches
            await fs.writeFile(
                matchesChatPath,
                JSON.stringify(chatMessages, null, 2)
            );
            
            console.log('✅ Dating data migrated to chat storage');
        } catch (error) {
            console.error('❌ Error migrating dating data:', error);
            this.stats.matches.errors++;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Helper method to read user data from chat storage
    async getUserData(phone) {
        try {
            const userChatPath = path.join(this.userChatsPath, `${phone}.json`);
            if (!await this.fileExists(userChatPath)) {
                return null;
            }
            
            const chatData = JSON.parse(await fs.readFile(userChatPath, 'utf8'));
            const profileMessage = chatData.find(msg => msg.type === 'profile_data');
            
            return profileMessage ? profileMessage.data : null;
        } catch (error) {
            console.error(`Error reading user data for ${phone}:`, error);
            return null;
        }
    }

    // Helper method to find matches for a user
    async getUserMatches(phone) {
        try {
            const matchesChatPath = path.join(this.systemChatsPath, 'matches.json');
            if (!await this.fileExists(matchesChatPath)) {
                return [];
            }
            
            const chatData = JSON.parse(await fs.readFile(matchesChatPath, 'utf8'));
            const matchMessages = chatData.filter(msg => msg.type === 'match_data');
            
            return matchMessages
                .filter(msg => msg.data.user1 === phone || msg.data.user2 === phone)
                .map(msg => msg.data.user1 === phone ? msg.data.user2 : msg.data.user1);
        } catch (error) {
            console.error(`Error reading matches for ${phone}:`, error);
            return [];
        }
    }
}

// Run if called directly
if (require.main === module) {
    const migrator = new ChatStorageMigrator();
    migrator.migrateAll()
        .then(() => {
            console.log('🎉 Migration to chat storage completed!');
            console.log('\n📁 Data stored in:');
            console.log(`   User chats: ${migrator.userChatsPath}`);
            console.log(`   System data: ${migrator.systemChatsPath}`);
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = ChatStorageMigrator;