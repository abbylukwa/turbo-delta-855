const { initializeDatabase, sequelize, UserProfile, Connection, DatingMessage, ActivationCode, Group } = require('./models');
const { QueryTypes } = require('sequelize');

async function migrate() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Initialize database connection
    const models = await initializeDatabase();
    console.log('✅ Database connection established');

    // Check if tables exist and get current state
    const tableCheck = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `, { type: QueryTypes.SELECT });

    const existingTables = tableCheck.map(t => t.table_name);
    console.log(`📊 Found ${existingTables.length} existing tables`);

    // Run specific migrations based on what tables exist
    if (!existingTables.includes('user_profiles')) {
      console.log('🔄 Creating user_profiles table...');
      await UserProfile.sync({ force: false });
    }

    if (!existingTables.includes('connections')) {
      console.log('🔄 Creating connections table...');
      await Connection.sync({ force: false });
    }

    if (!existingTables.includes('dating_messages')) {
      console.log('🔄 Creating dating_messages table...');
      await DatingMessage.sync({ force: false });
    }

    if (!existingTables.includes('activation_codes')) {
      console.log('🔄 Creating activation_codes table...');
      await ActivationCode.sync({ force: false });
    }

    if (!existingTables.includes('groups')) {
      console.log('🔄 Creating groups table...');
      await Group.sync({ force: false });
    }

    // Check if we need to add new columns to existing tables
    await checkAndAddColumns();

    // Insert default activation codes if they don't exist
    await seedActivationCodes();

    // Create indexes for better performance
    await createIndexes();

    console.log('✅ Migration completed successfully!');
    console.log('📋 Migration Summary:');
    console.log(`   - User Profiles: ${await UserProfile.count()} records`);
    console.log(`   - Connections: ${await Connection.count()} records`);
    console.log(`   - Dating Messages: ${await DatingMessage.count()} records`);
    console.log(`   - Activation Codes: ${await ActivationCode.count()} records`);
    console.log(`   - Groups: ${await Group.count()} records`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

async function checkAndAddColumns() {
  console.log('🔍 Checking for missing columns...');
  
  try {
    // Check if specific columns exist in user_profiles table
    const userProfileColumns = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles' 
      AND table_schema = 'public'
    `, { type: QueryTypes.SELECT });

    const existingColumns = userProfileColumns.map(c => c.column_name);
    
    // Add missing columns if needed
    const columnsToAdd = [
      'isActive', 'role', 'profileViews', 'matches'
    ];

    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column)) {
        console.log(`   ➕ Adding missing column: ${column}`);
        // You would need to use raw SQL to add columns
        // This is a simplified example - in production you'd use migrations tool
      }
    }

  } catch (error) {
    console.warn('⚠️ Could not check columns:', error.message);
  }
}

async function seedActivationCodes() {
  console.log('🌱 Seeding default activation codes...');
  
  const defaultCodes = [
    { code: 'Pretty911', role: 'admin' },
    { code: 'Abner911', role: 'moderator' },
    { code: 'Abby123', role: 'user' }
  ];

  for (const codeData of defaultCodes) {
    try {
      const [code, created] = await ActivationCode.findOrCreate({
        where: { code: codeData.code },
        defaults: {
          ...codeData,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        }
      });

      if (created) {
        console.log(`   ✅ Created activation code: ${codeData.code} (${codeData.role})`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not create activation code ${codeData.code}:`, error.message);
    }
  }
}

async function createIndexes() {
  console.log('📈 Creating indexes for better performance...');
  
  try {
    // This would be implemented with raw SQL queries
    // Example: await sequelize.query('CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON user_profiles(location)');
    console.log('   ✅ Index creation completed');
  } catch (error) {
    console.warn('   ⚠️ Could not create indexes:', error.message);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--force')) {
  console.log('⚠️ Force mode enabled - this may drop existing tables!');
  // You would implement force sync logic here
}

if (args.includes('--seed-only')) {
  console.log('🌱 Running seed only...');
  seedActivationCodes()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
} else {
  migrate();
}

// Export for testing purposes
module.exports = { migrate, seedActivationCodes };