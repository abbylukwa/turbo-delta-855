const fs = require('fs');
const path = require('path');

class DataMigrator {
    constructor() {
        this.oldDataPath = path.join(__dirname, 'old_data');
        this.newDataPath = path.join(__dirname, 'data');
    }

    async migrateAll() {
        console.log('Starting data migration...');
        
        await this.migrateUsers();
        await this.migrateSubscriptions();
        await this.migratePayments();
        
        console.log('Data migration completed!');
    }

    async migrateUsers() {
        try {
            const oldUsersPath = path.join(this.oldDataPath, 'users.json');
            if (fs.existsSync(oldUsersPath)) {
                const oldUsers = JSON.parse(fs.readFileSync(oldUsersPath, 'utf8'));
                const newUsers = {};
                
                for (const [phone, user] of Object.entries(oldUsers)) {
                    newUsers[phone] = {
                        phoneNumber: phone,
                        username: user.username || `User_${phone.substring(0, 6)}`,
                        role: user.role || 'user',
                        joinDate: user.joinDate || new Date().toISOString(),
                        lastActive: user.lastActive || new Date().toISOString(),
                        stats: user.stats || {
                            messagesSent: 0,
                            commandsUsed: 0,
                            downloads: 0
                        }
                    };
                }
                
                fs.writeFileSync(path.join(this.newDataPath, 'users.json'), JSON.stringify(newUsers, null, 2));
                console.log('✅ Users migrated successfully');
            }
        } catch (error) {
            console.error('Error migrating users:', error);
        }
    }

    async migrateSubscriptions() {
        try {
            const oldSubsPath = path.join(this.oldDataPath, 'subscriptions.json');
            if (fs.existsSync(oldSubsPath)) {
                const oldSubs = JSON.parse(fs.readFileSync(oldSubsPath, 'utf8'));
                const newSubs = {};
                
                for (const [phone, sub] of Object.entries(oldSubs)) {
                    newSubs[phone] = {
                        downloadCount: sub.downloadCount || 0,
                        demoUsage: sub.demoUsage || 0,
                        subscriptionActive: sub.subscriptionActive || false,
                        subscriptionType: sub.subscriptionType || 'none',
                        subscriptionExpiry: sub.subscriptionExpiry || null,
                        paymentPending: sub.paymentPending || false,
                        datingEnabled: sub.datingEnabled || false,
                        createdAt: sub.createdAt || new Date().toISOString(),
                        subscriptionHistory: sub.subscriptionHistory || []
                    };
                }
                
                fs.writeFileSync(path.join(this.newDataPath, 'subscriptions.json'), JSON.stringify(newSubs, null, 2));
                console.log('✅ Subscriptions migrated successfully');
            }
        } catch (error) {
            console.error('Error migrating subscriptions:', error);
        }
    }

    async migratePayments() {
        try {
            const oldPaymentsPath = path.join(this.oldDataPath, 'payments.json');
            if (fs.existsSync(oldPaymentsPath)) {
                const oldPayments = JSON.parse(fs.readFileSync(oldPaymentsPath, 'utf8'));
                fs.writeFileSync(path.join(this.newDataPath, 'payments.json'), JSON.stringify(oldPayments, null, 2));
                console.log('✅ Payments migrated successfully');
            }
        } catch (error) {
            console.error('Error migrating payments:', error);
        }
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    const migrator = new DataMigrator();
    migrator.migrateAll().catch(console.error);
}

module.exports = DataMigrator;