const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

class DataMigrator {
    constructor(config = {}) {
        this.oldDataPath = path.join(__dirname, 'old_data');
        this.newDataPath = path.join(__dirname, 'data');
        this.batchSize = config.batchSize || 100;
        
        // Database configuration with fallbacks
        this.pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'dating_bot',
            password: process.env.DB_PASSWORD || 'password',
            port: process.env.DB_PORT || 5432,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000
        });
        
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
            console.log('🚀 Starting data migration...');
            
            // Create necessary directories first
            await this.ensureDirectories();
            
            // Test database connection
            await this.testConnection();
            
            // Create tables if they don't exist
            await this.createTables();
            
            // Execute migrations in sequence
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
        } finally {
            await this.pool.end();
        }
    }

    async createTables() {
        try {
            // Create dating_profiles table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS dating_profiles (
                    phone_number VARCHAR(20) PRIMARY KEY,
                    name VARCHAR(100),
                    age INTEGER,
                    gender VARCHAR(20),
                    location VARCHAR(100),
                    bio TEXT,
                    interests JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create dating_matches table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS dating_matches (
                    id SERIAL PRIMARY KEY,
                    user1_phone VARCHAR(20) REFERENCES dating_profiles(phone_number),
                    user2_phone VARCHAR(20) REFERENCES dating_profiles(phone_number),
                    match_score INTEGER,
                    status VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user1_phone, user2_phone)
                )
            `);

            console.log('✅ Database tables ensured');
        } catch (error) {
            console.error('❌ Error creating tables:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.pool.query('SELECT NOW()');
            console.log('✅ Database connection established');
        } catch (error) {
            console.error('❌ Database connection failed');
            console.error('Please check your database configuration:');
            console.error('- Ensure PostgreSQL is running');
            console.error('- Check DB connection settings');
            console.error('- Verify database "dating_bot" exists');
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
                    `, [
                        phone,
                        userData.username || '',
                        userData.profile?.age || null,
                        userData.profile?.gender || null,
                        userData.profile?.location || null,
                        userData.profile?.bio || '',
                        JSON.stringify(userData.profile?.interests || [])
                    ]);
                    
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
            await fs.writeFile(
                path.join(this.newDataPath, 'payments.json'), 
                JSON.stringify(oldPayments, null, 2)
            );
            
            this.stats.payments.migrated = Object.keys(oldPayments).length;
            console.log('✅ Payments migrated to file');
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
            
            // Process matches in batches for better performance
            let matchesBatch = [];
            let processed = 0;
            
            for (const [phone, userData] of Object.entries(oldDating)) {
                if (userData.matches && Array.isArray(userData.matches)) {
                    for (const match of userData.matches) {
                        // Ensure we don't create duplicate or self-matches
                        if (phone !== match) {
                            matchesBatch.push([phone, match, 80, 'matched']);
                            
                            if (matchesBatch.length >= this.batchSize) {
                                await this.processMatchesBatch(matchesBatch);
                                processed += matchesBatch.length;
                                console.log(`   Processed ${processed}/${totalMatches} matches`);
                                matchesBatch = [];
                            }
                        }
                    }
                }
            }
            
            // Process any remaining matches
            if (matchesBatch.length > 0) {
                await this.processMatchesBatch(matchesBatch);
                processed += matchesBatch.length;
                console.log(`   Processed ${processed}/${totalMatches} matches`);
            }
            
            console.log('✅ Dating data migrated to database');
        } catch (error) {
            console.error('❌ Error migrating dating data:', error);
        }
    }

    async processMatchesBatch(matchesBatch) {
        if (matchesBatch.length === 0) return;
        
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            for (const match of matchesBatch) {
                try {
                    const [user1_phone, user2_phone, match_score, status] = match;
                    
                    const result = await client.query(`
                        INSERT INTO dating_matches (user1_phone, user2_phone, match_score, status)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (user1_phone, user2_phone) DO NOTHING
                    `, [user1_phone, user2_phone, match_score, status]);
                    
                    if (result.rowCount > 0) {
                        this.stats.matches.migrated++;
                    } else {
                        this.stats.matches.skipped++;
                    }
                } catch (error) {
                    console.error('❌ Error inserting match:', error.message);
                    this.stats.matches.errors++;
                }
            }
            
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error processing matches batch:', error.message);
            this.stats.matches.errors += matchesBatch.length;
        } finally {
            client.release();
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
    // Simple command line interface
    const args = process.argv.slice(2);
    const config = {};
    
    // Parse batch size from command line if provided
    const batchSizeIndex = args.indexOf('--batch-size');
    if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
        config.batchSize = parseInt(args[batchSizeIndex + 1]);
    }
    
    const migrator = new DataMigrator(config);
    migrator.migrateAll()
        .then(() => {
            console.log('🎉 Migration completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = DataMigrator;