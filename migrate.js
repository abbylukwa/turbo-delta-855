const { initializeDatabase } = require('../models');

async function migrate() {
  console.log('🚀 Starting database migration...');
  await initializeDatabase();
  console.log('✅ Migration completed successfully!');
  process.exit(0);
}

migrate().catch(console.error);
