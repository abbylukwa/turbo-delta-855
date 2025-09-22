const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

class DataMigrator {
    constructor() {
        this.oldDataPath = path.join(__dirname, 'old_data');
        this.newDataPath = path.join(__dirname, 'data');
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://database_3lb1_user:SG82maildcd1UeiIs0Gdndp8tMPRjOcI@dpg-d37c830gjchc73c5l15g-a/database_3lb1',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async migrateAll() {
        try {
            console.log('🚀 Starting data migration...');

            await this.ensureDirectories();
            await this.migrateUsers();
            await this.migrateSubscriptions();
            await this.migratePayments();
            await this.migrateDatingData();

            console.log('✅ Data migration completed successfully!');
        } catch (error) {
            console.error('❌ Data migration failed:', error);
            throw error;
        }
    }

    async ensureDirectories() {
        const directories = [this.oldDataPath, this.newDataPath];
        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                // Directory might already exist
            }
        }
    }

    async migrateUsers() {
        try {
            const oldUsersPath = path.join(this.oldDataPath, 'users.json');
            if (await this.fileExists(oldUsersPath)) {
                const oldUsers = JSON.parse(await fs.readFile(oldUsersPath, 'utf8'));

                for (const [phone, userData] of Object.entries(oldUsers)) {
                    await this.pool.query(`
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
                        userData.username,
                        userData.profile?.age || null,
                        userData.profile?.gender || null,
                        userData.profile?.location || null,
                        userData.profile?.bio || null,
                        userData.profile?.interests || []
                    ]);
                }

                console.log('✅ Users migrated to database');
            }
        } catch (error) {
            console.error('Error migrating users:', error);
        }
    }

    async migrateSubscriptions() {
        try {
            const oldSubsPath = path.join(this.oldDataPath, 'subscriptions.json');
            if (await this.fileExists(oldSubsPath)) {
                const oldSubs = JSON.parse(await fs.readFile(oldSubsPath, 'utf8'));
                // Subscription data is now handled by SubscriptionManager, not in database
                await fs.writeFile(path.join(this.newDataPath, 'subscriptions.json'), JSON.stringify(oldSubs, null, 2));
                console.log('✅ Subscriptions migrated to file');
            }
        } catch (error) {
            console.error('Error migrating subscriptions:', error);
        }
    }

    async migratePayments() {
        try {
            const oldPaymentsPath = path.join(this.oldDataPath, 'payments.json');
            if (await this.fileExists(oldPaymentsPath)) {
                const oldPayments = JSON.parse(await fs.readFile(oldPaymentsPath, 'utf8'));
                await fs.writeFile(path.join(this.newDataPath, 'payments.json'), JSON.stringify(oldPayments, null, 2));
                console.log('✅ Payments migrated to file');
            }
        } catch (error) {
            console.error('Error migrating payments:', error);
        }
    }

    async migrateDatingData() {
        try {
            const oldDatingPath = path.join(this.oldDataPath, 'dating.json');
            if (await this.fileExists(oldDatingPath)) {
                const oldDating = JSON.parse(await fs.readFile(oldDatingPath, 'utf8'));

                // Migrate matches
                for (const [phone, userData] of Object.entries(oldDating)) {
                    if (userData.matches) {
                        for (const match of userData.matches) {
                            await this.pool.query(`
                                INSERT INTO dating_matches (user1_phone, user2_phone, match_score, status)
                                VALUES ($1, $2, $3, $4)
                                ON CONFLICT (user1_phone, user2_phone) DO NOTHING
                            `, [phone, match, 80, 'matched']);
                        }
                    }
                }

                console.log('✅ Dating data migrated to database');
            }
        } catch (error) {
            console.error('Error migrating dating data:', error);
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
    migrator.migrateAll().catch(console.error);
}

module.exports = DataMigrator;