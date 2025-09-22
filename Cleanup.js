const { GroupManager } = require('./group-manager');
const fs = require('fs').promises;
const path = require('path');

async function cleanup() {
    try {
        console.log('🧹 Starting cleanup process...');
        
        const manager = new GroupManager();
        const deletedCount = await manager.cleanupOldFiles(24);
        
        // Clean up other directories
        const directoriesToClean = [
            path.join(__dirname, 'downloads'),
            path.join(__dirname, 'data', 'temp')
        ];
        
        let totalDeleted = deletedCount;
        
        for (const dir of directoriesToClean) {
            try {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = await fs.stat(filePath);
                    const fileAge = Date.now() - stats.mtimeMs;
                    
                    // Delete files older than 24 hours
                    if (fileAge > 24 * 60 * 60 * 1000) {
                        await fs.unlink(filePath);
                        totalDeleted++;
                        console.log(`🧹 Deleted old file: ${filePath}`);
                    }
                }
            } catch (error) {
                // Directory might not exist, skip
            }
        }
        
        console.log(`✅ Cleanup completed: ${totalDeleted} files deleted total`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    cleanup();
}

module.exports = { cleanup };