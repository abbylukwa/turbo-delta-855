const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

class ChatStorageMigrator {
    constructor() {
        this.oldDataPath = path.join(__dirname, 'old_data');
        
        // Database connection
        this.pool = new Pool({
            connectionString: 'postgresql://database_3lb1_user:SG82maildcd1UeiIs0Gdndp8tMPRjOcI@dpg-d37c830gjchc73c5l15g-a/database_3lb1',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Email configuration (should be in environment variables in production)
        this.emailConfig = {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'your-email@gmail.com',
                pass: process.env.EMAIL_PASS || 'your-app-password'
            }
        };

        this.adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : ['admin@example.com'];

        // Track migration statistics
        this.stats = {
            users: { migrated: 0, skipped: 0, errors: 0 },
            subscriptions: { migrated: 0, errors: 0 },
            payments: { migrated: 0, errors: 0 },
            matches: { migrated: 0, skipped: 0, errors: 0 }
        };

        // Initialize database and start backup schedule
        this.initDatabase();
        this.startBackupSchedule();
    }

    async initDatabase() {
        try {
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    phone VARCHAR(20) PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    age INTEGER,
                    gender VARCHAR(20),
                    location VARCHAR(100),
                    bio TEXT,
                    interests JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_phone VARCHAR(20) REFERENCES users(phone),
                    plan_type VARCHAR(50) NOT NULL,
                    start_date TIMESTAMP NOT NULL,
                    end_date TIMESTAMP NOT NULL,
                    status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    user_phone VARCHAR(20) REFERENCES users(phone),
                    amount DECIMAL(10,2) NOT NULL,
                    currency VARCHAR(3) DEFAULT 'USD',
                    payment_method VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'completed',
                    transaction_id VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS matches (
                    id SERIAL PRIMARY KEY,
                    user1_phone VARCHAR(20) REFERENCES users(phone),
                    user2_phone VARCHAR(20) REFERENCES users(phone),
                    match_score INTEGER DEFAULT 80,
                    status VARCHAR(20) DEFAULT 'matched',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user1_phone, user2_phone)
                );

                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    user_phone VARCHAR(20) REFERENCES users(phone),
                    type VARCHAR(50) NOT NULL,
                    message TEXT,
                    data JSONB,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_phone);
                CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
            `);
            console.log('✅ Database tables initialized');
        } catch (error) {
            console.error('❌ Error initializing database:', error);
        }
    }

    startBackupSchedule() {
        // Schedule backup every 7 days at 2 AM
        cron.schedule('0 2 */7 * *', async () => {
            console.log('🔄 Starting scheduled database backup...');
            try {
                await this.createAndSendBackup();
                console.log('✅ Scheduled backup completed successfully');
            } catch (error) {
                console.error('❌ Scheduled backup failed:', error);
            }
        });
        console.log('📅 Backup schedule started (every 7 days at 2 AM)');
    }

    async migrateAll() {
        const startTime = Date.now();
        try {
            console.log('🚀 Starting data migration to database...');

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
        try {
            await fs.mkdir(this.oldDataPath, { recursive: true });
            console.log(`✅ Directory ensured: ${this.oldDataPath}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.warn(`⚠️ Could not create directory ${this.oldDataPath}:`, error.message);
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
                    if (!userData || !userData.username) {
                        console.warn(`⚠️ Skipping user ${phone}: invalid data structure`);
                        this.stats.users.skipped++;
                        continue;
                    }

                    // Insert user into database
                    await this.pool.query(
                        `INSERT INTO users (phone, username, age, gender, location, bio, interests)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (phone) DO UPDATE SET
                         username = EXCLUDED.username,
                         age = EXCLUDED.age,
                         gender = EXCLUDED.gender,
                         location = EXCLUDED.location,
                         bio = EXCLUDED.bio,
                         interests = EXCLUDED.interests,
                         updated_at = CURRENT_TIMESTAMP`,
                        [
                            phone,
                            userData.username,
                            userData.profile?.age || null,
                            userData.profile?.gender || null,
                            userData.profile?.location || null,
                            userData.profile?.bio || '',
                            JSON.stringify(userData.profile?.interests || [])
                        ]
                    );

                    // Add chat message for user creation
                    await this.pool.query(
                        `INSERT INTO chat_messages (user_phone, type, message, data)
                         VALUES ($1, $2, $3, $4)`,
                        [
                            phone,
                            'system',
                            `USER PROFILE CREATED - ${userData.username}`,
                            JSON.stringify({
                                username: userData.username,
                                action: 'profile_created'
                            })
                        ]
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

            console.log('✅ Users migrated to database');
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

            for (const [phone, subscriptionData] of Object.entries(oldSubs)) {
                try {
                    await this.pool.query(
                        `INSERT INTO subscriptions (user_phone, plan_type, start_date, end_date, status)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            phone,
                            subscriptionData.planType || 'basic',
                            new Date(subscriptionData.startDate || Date.now()),
                            new Date(subscriptionData.endDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
                            subscriptionData.status || 'active'
                        ]
                    );

                    this.stats.subscriptions.migrated++;
                } catch (error) {
                    console.error(`❌ Error migrating subscription for ${phone}:`, error.message);
                    this.stats.subscriptions.errors++;
                }
            }

            console.log('✅ Subscriptions migrated to database');
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

            for (const [phone, payments] of Object.entries(oldPayments)) {
                if (Array.isArray(payments)) {
                    for (const payment of payments) {
                        try {
                            await this.pool.query(
                                `INSERT INTO payments (user_phone, amount, currency, payment_method, status, transaction_id)
                                 VALUES ($1, $2, $3, $4, $5, $6)`,
                                [
                                    phone,
                                    payment.amount || 0,
                                    payment.currency || 'USD',
                                    payment.method || 'unknown',
                                    payment.status || 'completed',
                                    payment.transactionId || null
                                ]
                            );

                            this.stats.payments.migrated++;
                        } catch (error) {
                            console.error(`❌ Error migrating payment for ${phone}:`, error.message);
                            this.stats.payments.errors++;
                        }
                    }
                }
            }

            console.log('✅ Payments migrated to database');
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

            let processed = 0;
            for (const [phone, userData] of Object.entries(oldDating)) {
                if (userData.matches && Array.isArray(userData.matches)) {
                    for (const matchPhone of userData.matches) {
                        if (phone !== matchPhone) {
                            try {
                                // Insert match (avoid duplicates)
                                await this.pool.query(
                                    `INSERT INTO matches (user1_phone, user2_phone, match_score, status)
                                     VALUES ($1, $2, $3, $4)
                                     ON CONFLICT (user1_phone, user2_phone) DO NOTHING`,
                                    [phone, matchPhone, 80, 'matched']
                                );

                                processed++;
                                if (processed % 100 === 0) {
                                    console.log(`   Processed ${processed}/${totalMatches} matches`);
                                }

                                this.stats.matches.migrated++;
                            } catch (error) {
                                console.error(`❌ Error migrating match between ${phone} and ${matchPhone}:`, error.message);
                                this.stats.matches.errors++;
                            }
                        } else {
                            this.stats.matches.skipped++;
                        }
                    }
                }
            }

            console.log('✅ Dating data migrated to database');
        } catch (error) {
            console.error('❌ Error migrating dating data:', error);
            this.stats.matches.errors++;
        }
    }

    async createAndSendBackup() {
        try {
            console.log('📦 Creating database backup...');
            
            // Create backup directory
            const backupDir = path.join(__dirname, 'backups');
            await fs.mkdir(backupDir, { recursive: true });

            // Generate backup filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `backup-${timestamp}.sql`;
            const backupPath = path.join(backupDir, backupFileName);

            // Export database using pg_dump (you might need to install pg_dump on your system)
            // Alternatively, you can create a custom backup by querying all data
            await this.createCustomBackup(backupPath);

            console.log(`✅ Backup created: ${backupPath}`);

            // Send backup to admins
            await this.sendBackupToAdmins(backupPath);

            // Clean up old backups (keep last 4 backups)
            await this.cleanupOldBackups(backupDir);

        } catch (error) {
            console.error('❌ Backup creation failed:', error);
            throw error;
        }
    }

    async createCustomBackup(backupPath) {
        try {
            // Get all data from tables
            const tables = ['users', 'subscriptions', 'payments', 'matches', 'chat_messages'];
            let backupContent = '';

            for (const table of tables) {
                const result = await this.pool.query(`SELECT * FROM ${table}`);
                backupContent += `-- ${table.toUpperCase()} DATA\n`;
                backupContent += `INSERT INTO ${table} VALUES\n`;

                const rows = result.rows.map(row => {
                    const values = Object.values(row).map(value => {
                        if (value === null) return 'NULL';
                        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                        return `'${value.toString().replace(/'/g, "''")}'`;
                    });
                    return `(${values.join(', ')})`;
                });

                backupContent += rows.join(',\n') + ';\n\n';
            }

            await fs.writeFile(backupPath, backupContent);
        } catch (error) {
            console.error('Error creating custom backup:', error);
            // Fallback: create a simple metadata backup
            const metadata = {
                backup_date: new Date().toISOString(),
                tables: await this.getTableCounts()
            };
            await fs.writeFile(backupPath, JSON.stringify(metadata, null, 2));
        }
    }

    async getTableCounts() {
        const tables = ['users', 'subscriptions', 'payments', 'matches', 'chat_messages'];
        const counts = {};

        for (const table of tables) {
            try {
                const result = await this.pool.query(`SELECT COUNT(*) FROM ${table}`);
                counts[table] = parseInt(result.rows[0].count);
            } catch (error) {
                counts[table] = 'error';
            }
        }

        return counts;
    }

    async sendBackupToAdmins(backupPath) {
        try {
            const transporter = nodemailer.createTransporter(this.emailConfig);

            const mailOptions = {
                from: this.emailConfig.auth.user,
                to: this.adminEmails.join(','),
                subject: `Database Backup - ${new Date().toLocaleDateString()}`,
                text: `Automatic database backup attached.\n\nBackup date: ${new Date().toISOString()}`,
                attachments: [
                    {
                        filename: path.basename(backupPath),
                        path: backupPath
                    }
                ]
            };

            await transporter.sendMail(mailOptions);
            console.log('✅ Backup sent to admins');
        } catch (error) {
            console.error('❌ Error sending backup email:', error);
        }
    }

    async cleanupOldBackups(backupDir) {
        try {
            const files = await fs.readdir(backupDir);
            const backupFiles = files.filter(file => file.startsWith('backup-') && file.endsWith('.sql'));
            
            if (backupFiles.length > 4) {
                // Sort by creation time and remove oldest files
                backupFiles.sort();
                const filesToDelete = backupFiles.slice(0, backupFiles.length - 4);
                
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(backupDir, file));
                    console.log(`🗑️ Deleted old backup: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up old backups:', error);
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

    // Helper method to get user data
    async getUserData(phone) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM users WHERE phone = $1',
                [phone]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Error reading user data for ${phone}:`, error);
            return null;
        }
    }

    // Helper method to get user matches
    async getUserMatches(phone) {
        try {
            const result = await this.pool.query(
                `SELECT u.phone, u.username 
                 FROM users u 
                 JOIN matches m ON (u.phone = m.user1_phone OR u.phone = m.user2_phone)
                 WHERE (m.user1_phone = $1 OR m.user2_phone = $1) AND u.phone != $1`,
                [phone]
            );
            return result.rows;
        } catch (error) {
            console.error(`Error reading matches for ${phone}:`, error);
            return [];
        }
    }

    // Close database connection
    async close() {
        await this.pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    const migrator = new ChatStorageMigrator();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await migrator.close();
        process.exit(0);
    });

    migrator.migrateAll()
        .then(() => {
            console.log('🎉 Migration to database completed!');
            console.log('\n💾 Data stored in PostgreSQL database');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = ChatStorageMigrator;