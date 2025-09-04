const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');

class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
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

    // ... (other methods remain the same)

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

    // ... (other methods)

    destroy() {
        if (this.recentLinksCleanupInterval) {
            clearInterval(this.recentLinksCleanupInterval);
        }
    }
}

module.exports = GroupManager;
