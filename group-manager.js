const fs = require('fs');
const path = require('path');
const { delay } = require('@whiskeysockets/baileys');

class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.schedulesFile = path.join(__dirname, 'data', 'schedules.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.autoJoinEnabled = true;
        
        // Ensure data directory exists before loading data
        this.ensureDataDirectoryExists();
        
        this.groups = this.loadGroups();
        this.scheduledMessages = this.loadSchedules();
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
        
        // Start scheduler
        this.startScheduler();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('Created data directory:', dataDir);
        }
    }

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
        
        return [];
    }

    loadSchedules() {
        try {
            if (fs.existsSync(this.schedulesFile)) {
                const data = fs.readFileSync(this.schedulesFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading scheduled messages:', error);
        }
        
        return [];
    }

    saveGroups() {
        try {
            const data = JSON.stringify(this.groups, null, 2);
            fs.writeFileSync(this.groupsFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving groups:', error);
        }
    }

    saveSchedules() {
        try {
            const data = JSON.stringify(this.scheduledMessages, null, 2);
            fs.writeFileSync(this.schedulesFile, data, 'utf8');
        } catch (error) {
            console.error('Error saving scheduled messages:', error);
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

    // Send message to all groups
    async sendToAllGroups(sock, message) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (const group of this.groups) {
            if (group.active) {
                try {
                    await sock.sendMessage(group.id, { text: message });
                    group.messageCount = (group.messageCount || 0) + 1;
                    successCount++;
                    results.push({ group: group.name, status: 'success' });
                    await delay(1000); // Delay to avoid rate limiting
                } catch (error) {
                    failCount++;
                    results.push({ group: group.name, status: 'failed', error: error.message });
                }
            }
        }

        this.saveGroups();
        this.groupStats.messagesSent += successCount;

        return {
            success: true,
            sent: successCount,
            failed: failCount,
            results: results
        };
    }

    // Search groups by name
    searchGroups(query) {
        if (!query || query.trim() === '') {
            return this.groups;
        }

        const searchTerm = query.toLowerCase();
        return this.groups.filter(group => 
            group.name.toLowerCase().includes(searchTerm)
        );
    }

    // Advertise in all groups (similar to sendToAllGroups but with link)
    async advertiseInAllGroups(sock, message, inviteLink) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        const fullMessage = `${message}\n\nJoin here: ${inviteLink}`;
        return this.sendToAllGroups(sock, fullMessage);
    }

    // Contact all members of a specific group
    async contactGroupMembers(sock, groupName, message) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        const group = this.searchGroups(groupName)[0];
        if (!group) {
            return { success: false, error: 'Group not found' };
        }

        try {
            const metadata = await sock.groupMetadata(group.id);
            let successCount = 0;
            let failCount = 0;

            for (const participant of metadata.participants) {
                try {
                    await sock.sendMessage(participant.id, { text: message });
                    successCount++;
                    await delay(500); // Delay to avoid rate limiting
                } catch (error) {
                    failCount++;
                    console.error(`Failed to message ${participant.id}:`, error);
                }
            }

            return {
                success: true,
                group: group.name,
                participantsContacted: successCount,
                failed: failCount
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Create a new group
    async createGroup(sock, name, participants = []) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        try {
            const response = await sock.groupCreate(name, participants);
            const groupId = response.gid;
            
            // Get the group invite link
            const inviteCode = await sock.groupInviteCode(groupId);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            
            // Add to managed groups
            this.addGroup(groupId, name, inviteLink);
            
            return {
                success: true,
                groupId: groupId,
                name: name,
                inviteLink: inviteLink
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Create a channel (broadcast list)
    async createChannel(sock, name) {
        if (!this.isAdmin(sock)) {
            return { success: false, error: 'Unauthorized: Admin only command' };
        }

        try {
            // Note: WhatsApp doesn't have a direct "channel" concept in the API
            // This creates a broadcast list which functions similarly
            const response = await sock.createBroadcastList(name);
            
            return {
                success: true,
                id: response.id,
                name: name,
                type: 'broadcast'
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Schedule a message
    scheduleMessage(groupName, message, datetime) {
        if (!groupName || !message || !datetime) {
            return { success: false, error: 'Missing parameters' };
        }

        const scheduleDate = new Date(datetime);
        if (isNaN(scheduleDate.getTime())) {
            return { success: false, error: 'Invalid date format' };
        }

        const now = new Date();
        if (scheduleDate <= now) {
            return { success: false, error: 'Scheduled time must be in the future' };
        }

        const scheduledMessage = {
            id: Date.now().toString(),
            groupName: groupName,
            message: message,
            scheduledFor: scheduleDate.toISOString(),
            status: 'pending'
        };

        this.scheduledMessages.push(scheduledMessage);
        this.saveSchedules();

        return {
            success: true,
            scheduledMessage: scheduledMessage
        };
    }

    // Start the scheduler to check for pending messages
    startScheduler() {
        setInterval(() => {
            this.checkScheduledMessages();
        }, 60000); // Check every minute
    }

    async checkScheduledMessages() {
        const now = new Date();
        const pendingMessages = this.scheduledMessages.filter(
            msg => msg.status === 'pending' && new Date(msg.scheduledFor) <= now
        );

        for (const msg of pendingMessages) {
            // In a real implementation, you would need access to the sock instance
            // This would typically be handled by passing the sock instance to this method
            // or storing a reference to it
            console.log(`[SCHEDULER] Time to send message to ${msg.groupName}: ${msg.message}`);
            
            // Mark as sent (in a real implementation, you would actually send it)
            msg.status = 'sent';
            msg.sentAt = new Date().toISOString();
        }

        if (pendingMessages.length > 0) {
            this.saveSchedules();
        }
    }

    // Check if the sender is the admin
    isAdmin(sock) {
        // This would need to be implemented based on how you track the admin
        // For now, we'll assume the commandNumber is the admin
        // In a real implementation, you would check the message sender
        return true; // Placeholder
    }

    destroy() {
        if (this.recentLinksCleanupInterval) {
            clearInterval(this.recentLinksCleanupInterval);
        }
    }
}

module.exports = GroupManager;