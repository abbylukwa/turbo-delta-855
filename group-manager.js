const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');

class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        
        // Ensure data directory exists before loading groups
        this.ensureDataDirectoryExists();
        
        this.groups = this.loadGroups();
        this.groupStats = {
            totalGroups: 0,
            activeGroups: 0,
            messagesSent: 0,
            autoJoined: 0
        };
        
        this.recentLinks = new Set();
        this.recentLinksCleanupInterval = setInterval(() => {
            this.recentLinks.clear();
        }, 60000);
    }

    // Add the missing ensureDataDirectoryExists method
    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('Created data directory:', dataDir);
        }
    }

    // Add the missing loadGroups method
    loadGroups() {
        try {
            if (fs.existsSync(this.groupsFile)) {
                const data = fs.readFileSync(this.groupsFile, 'utf8');
                const groups = JSON.parse(data);
                this.groupStats.totalGroups = groups.length;
                this.groupStats.activeGroups = groups.filter(g => g.active).length;
                return groups;
            }
        } catch (error) {
            console.error('Error loading groups:', error);
        }
        
        // Return empty array if file doesn't exist or error occurs
        return [];
    }

    // Add saveGroups method (you'll likely need this too)
    saveGroups() {
        try {
            const data = JSON.stringify(this.groups, null, 2);
            fs.writeFileSync(this.groupsFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving groups:', error);
        }
    }

    async joinGroup(sock, groupLink) {
        try {
            console.log(`Attempting to join group: ${groupLink}`);
            
            const inviteCode = this.extractInviteCode(groupLink);
            if (!inviteCode) {
                throw new Error('Invalid group link');
            }

            const response = await sock.groupAcceptInvite(inviteCode);
            
            if (response) {
                const groupId = response.gid;
                const groupMetadata = await sock.groupMetadata(groupId);
                
                this.addGroup(groupId, groupMetadata.subject, groupLink);
                
                console.log(`Successfully joined group: ${groupMetadata.subject}`);
                return {
                    success: true,
                    groupId: groupId,
                    name: groupMetadata.subject,
                    participants: groupMetadata.participants.length
                };
            }
            
            throw new Error('Failed to join group');
        } catch (error) {
            console.error('Error joining group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // You'll probably need these methods too:
    addGroup(groupId, name, link = '') {
        const existingGroup = this.groups.find(g => g.id === groupId);
        if (!existingGroup) {
            this.groups.push({
                id: groupId,
                name: name,
                link: link,
                joinedAt: new Date().toISOString(),
                active: true,
                messageCount: 0
            });
            this.groupStats.totalGroups++;
            this.groupStats.activeGroups++;
            this.saveGroups();
        }
    }

    extractInviteCode(link) {
        const match = link.match(/https:\/\/chat\.whatsapp\.com\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    destroy() {
        if (this.recentLinksCleanupInterval) {
            clearInterval(this.recentLinksCleanupInterval);
        }
    }
}

module.exports = GroupManager;
