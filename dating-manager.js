const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

class DataMigrator {
    constructor() {
        this.oldDataPath = path.join(__dirname, 'old_data');
        this.newDataPath = path.join(__dirname, 'data');
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/dating_bot',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Track migration statistics
        this.stats = {
            users: { migrated: 0, skipped: 0 },
            subscriptions: { migrated: 0 },
            payments: { migrated: 0 },
            matches: { migrated: 0, skipped: 0 }
        };
    }

    async migrateAll() {
        try {
            console.log('🚀 Starting data migration...');
            
            // Test database connection first
            await this.testConnection();
            
            await this.ensureDirectories();
            await this.migrateUsers();
            await this.migrateSubscriptions();
            await this.migratePayments();
            await this.migrateDatingData();
            
            console.log('✅ Data migration completed successfully!');
            console.log('📊 Migration Statistics:');
            console.log(`   Users: ${this.stats.users.migrated} migrated, ${this.stats.users.skipped} skipped`);
            console.log(`   Subscriptions: ${this.stats.subscriptions.migrated} migrated`);
            console.log(`   Payments: ${this.stats.payments.migrated} migrated`);
            console.log(`   Matches: ${this.stats.matches.migrated} migrated, ${this.stats.matches.skipped} skipped`);
        } catch (error) {
            console.error('❌ Data migration failed:', error);
            throw error;
        } finally {
            await this.pool.end();
        }
    }

    async testConnection() {
        try {
            await this.pool.query('SELECT NOW()');
            console.log('✅ Database connection established');
        } catch (error) {
            console.error('❌ Database connection failed');
            throw error;
        }
    }

    async ensureDirectories() {
        const directories = [this.oldDataPath, this.newDataPath];
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

            const oldUsers = JSON.parse(await fs.readFile(oldUsersPath, 'utf8'));
            console.log(`📊 Found ${Object.keys(oldUsers).length} users to migrate`);

            for (const [phone, userData] of Object.entries(oldUsers)) {
                try {
                    const result = await this.pool.query(`
                        INSERT INTO dating_profiles (phone_number, name, age, gender, location, bio, interests)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (phone_number) DO UPDATE SET
                            name = EXCLUDED.name,
                            age = EXCLUDED.age,
                            gender = EXCLUDED.gender,
                            location = EXCLUDED.location,
                            bio = EXCLUDED.bio,
                            interests = EXCLUDED.interests,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING phone_number
                    `, [
                        phone,
                        userData.username,
                        userData.profile?.age || null,
                        userData.profile?.gender || null,
                        userData.profile?.location || null,
                        userData.profile?.bio || null,
                        JSON.stringify(userData.profile?.interests || []) // Ensure proper JSON format
                    ]);
                    
                    if (result.rowCount > 0) {
                        this.stats.users.migrated++;
                    } else {
                        this.stats.users.skipped++;
                    }
                } catch (error) {
                    console.error(`❌ Error migrating user ${phone}:`, error.message);
                    this.stats.users.skipped++;
                }
            }
            
            console.log('✅ Users migration completed');
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
            await fs.writeFile(
                path.join(this.newDataPath, 'subscriptions.json'), 
                JSON.stringify(oldSubs, null, 2)
            );
            
            this.stats.subscriptions.migrated = Object.keys(oldSubs).length;
            console.log('✅ Subscriptions migrated to file');
        } catch (error) {
            console.error('❌ Error migrating subscriptions:', error);
            throw error;
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
            await fs.writeFile(
                path.join(this.newDataPath, 'payments.json'), 
                JSON.stringify(oldPayments, null, 2)
            );
            
            this.stats.payments.migrated = Object.keys(oldPayments).length;
            console.log('✅ Payments migrated to file');
        } catch (error) {
            console.error('❌ Error migrating payments:', error);
            throw error;
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
            
            // Process matches in batches for better performance
            const batchSize = 100;
            let matchesBatch = [];
            
            for (const [phone, userData] of Object.entries(oldDating)) {
                if (userData.matches && Array.isArray(userData.matches)) {
                    for (const match of userData.matches) {
                        matchesBatch.push([phone, match, 80, 'matched']);
                        
                        if (matchesBatch.length >= batchSize) {
                            await this.processMatchesBatch(matchesBatch);
                            matchesBatch = [];
                        }
                    }
                }
            }
            
            // Process any remaining matches
            if (matchesBatch.length > 0) {
                await this.processMatchesBatch(matchesBatch);
            }
            
            console.log('✅ Dating data migrated to database');
        } catch (error) {
            console.error('❌ Error migrating dating data:', error);
            throw error;
        }
    }

    async processMatchesBatch(matchesBatch) {
        if (matchesBatch.length === 0) return;
        
        try {
            // Use a transaction for batch insert
            const client = await this.pool.connect();
            
            try {
                await client.query('BEGIN');
                
                for (const match of matchesBatch) {
                    const result = await client.query(`
                        INSERT INTO dating_matches (user1_phone, user2_phone, match_score, status)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (user1_phone, user2_phone) DO NOTHING
                        RETURNING user1_phone
                    `, match);
                    
                    if (result.rowCount > 0) {
                        this.stats.matches.migrated++;
                    } else {
                        this.stats.matches.skipped++;
                    }
                }
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('❌ Error processing matches batch:', error.message);
            // Continue with migration but skip this batch
            this.stats.matches.skipped += matchesBatch.length;
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
}

// Run if called directly
if (require.main === module) {
    const migrator = new DataMigrator();
    migrator.migrateAll()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = DataMigrator;