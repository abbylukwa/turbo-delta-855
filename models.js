const { GroupManager } = require('./group-manager');

async function cleanup() {
    const manager = new GroupManager();
    const deletedCount = await manager.cleanupOldFiles(24);
    console.log(`Cleanup completed: ${deletedCount} files deleted`);
    process.exit(0);
}

cleanup().catch(console.error);