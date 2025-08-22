const fs = require('fs');
const path = require('path');

class GroupManager {
    constructor() {
        this.groupsFile = path.join(__dirname, 'data', 'groups.json');
        this.commandNumber = '263717457592@s.whatsapp.net';
        this.ensureDataDirectoryExists();
        this.groups = this.loadGroups();
        this.groupStats = {
            totalGroups: 0,
            activeGroups: 0,
            messagesSent: 0
        };
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.groupsFile)) {
            fs.writeFileSync(this.groupsFile, JSON.stringify({ groups: {}, stats: this.groupStats }));
        }
    }

    loadGroups() {
        try {
            const data = fs.readFileSync(this.groupsFile, 'utf8');
            const parsedData = JSON.parse(data);
            this.groups = new Map(Object.entries(parsedData.groups || {}));
            this.groupStats = parsedData.stats || this.groupStats;
            return this.groups;
        } catch (error) {
            console.error('Error loading groups:', error);
            return new Map();
        }
    }

    saveGroupData() {
        try {
            const data = {
                groups: Object.fromEntries(this.groups),
                stats: this.groupStats
            };
            fs.writeFileSync(this.groupsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving group data:', error);
        }
    }

    async detectGroupLink(text) {
        const groupLinkRegex = /https?:\/\/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/;
        return groupLinkRegex.test(text);
    }

    async handleGroupLink(sock, text, phoneNumber, username) {
        const groupLinkRegex = /https?:\/\/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/;
        const match = text.match(groupLinkRegex);
        
        if (!match) {
            return false;
        }

        const groupCode = match[1];
        
        try {
            await sock.sendMessage(sock.user.id, { 
                text: `⬇️ Processing group link from ${username}...` 
            });

            const response = await sock.groupAcceptInvite(groupCode);
            
            if (response) {
                const groupId = response.gid;
                const groupMetadata = await sock.groupMetadata(groupId);
                const groupName = groupMetadata.subject;
                
                this.addGroup(groupId, groupName, `https://chat.whatsapp.com/${groupCode}`, phoneNumber, username);
                
                await sock.sendMessage(sock.user.id, { 
                    text: `✅ Successfully joined group: ${groupName}\n\nGroup ID: ${groupId}`
                });
                
                console.log(`✅ Joined group: ${groupName} (${groupId})`);
                return true;
            }
        } catch (error) {
            console.error('Error joining group:', error);
            await sock.sendMessage(sock.user.id, { 
                text: `❌ Failed to join group: ${error.message}`
            });
            return false;
        }
    }

    getGroupStats() {
        const totalGroups = this.groups.size;
        const groupsByUser = {};
        
        this.groups.forEach(group => {
            if (!groupsByUser[group.joinedByUsername]) {
                groupsByUser[group.joinedByUsername] = 0;
            }
            groupsByUser[group.joinedByUsername]++;
        });
        
        return {
            totalGroups,
            groupsByUser
        };
    }

    getAllGroups() {
        return Array.from(this.groups.values());
    }

    isCommandNumber(phoneNumber) {
        return phoneNumber === this.commandNumber;
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

    extractInviteCode(groupLink) {
        try {
            const url = new URL(groupLink);
            return url.pathname.split('/').pop();
        } catch (error) {
            const match = groupLink.match(/([A-Za-z0-9_-]{22})/);
            return match ? match[1] : null;
        }
    }

    addGroup(groupId, name, inviteLink = '', joinedBy = '', joinedByUsername = '') {
        const groupInfo = {
            id: groupId,
            name: name,
            inviteLink: inviteLink,
            joinedBy: joinedBy,
            joinedByUsername: joinedByUsername,
            joinedAt: new Date().toISOString(),
            lastMessage: null,
            messageCount: 0,
            isActive: true,
            members: 0
        };

        this.groups.set(groupId, groupInfo);
        this.groupStats.totalGroups++;
        this.groupStats.activeGroups++;
        this.saveGroupData();
        
        return groupInfo;
    }

    removeGroup(groupId) {
        if (this.groups.has(groupId)) {
            this.groups.delete(groupId);
            this.groupStats.activeGroups--;
            this.saveGroupData();
            return true;
        }
        return false;
    }

    updateGroupInfo(groupId, updates) {
        const group = this.groups.get(groupId);
        if (group) {
            Object.assign(group, updates);
            this.groups.set(groupId, group);
            this.saveGroupData();
            return group;
        }
        return null;
    }

    async sendToAllGroups(sock, message) {
        const results = [];
        
        for (const [groupId, groupInfo] of this.groups) {
            if (groupInfo.isActive) {
                try {
                    await sock.sendMessage(groupId, { text: message });
                    
                    this.updateGroupInfo(groupId, {
                        lastMessage: new Date().toISOString(),
                        messageCount: groupInfo.messageCount + 1
                    });
                    
                    this.groupStats.messagesSent++;
                    
                    results.push({
                        groupId: groupId,
                        name: groupInfo.name,
                        success: true
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    results.push({
                        groupId: groupId,
                        name: groupInfo.name,
                        success: false,
                        error: error.message
                    });
                    
                    this.updateGroupInfo(groupId, { isActive: false });
                }
            }
        }
        
        this.saveGroupData();
        return results;
    }

    async sendToGroup(sock, groupId, message) {
        try {
            await sock.sendMessage(groupId, { text: message });
            
            this.updateGroupInfo(groupId, {
                lastMessage: new Date().toISOString(),
                messageCount: (this.groups.get(groupId)?.messageCount || 0) + 1
            });
            
            this.groupStats.messagesSent++;
            this.saveGroupData();
            
            return { success: true };
        } catch (error) {
            this.updateGroupInfo(groupId, { isActive: false });
            this.saveGroupData();
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createGroup(sock, groupName, participants = []) {
        try {
            const creation = await sock.groupCreate(groupName, participants);
            const groupId = creation.gid;
            
            const groupInfo = this.addGroup(groupId, groupName);
            await this.promoteUser(sock, groupId, this.commandNumber.replace('@s.whatsapp.net', ''));
            
            console.log(`Group created successfully: ${groupName}`);
            return {
                success: true,
                groupId: groupId,
                name: groupName,
                info: groupInfo
            };
        } catch (error) {
            console.error('Error creating group:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createChannel(sock, channelName) {
        try {
            const creation = await sock.createBroadcastList(channelName);
            const broadcastId = creation.id;
            
            const groupInfo = this.addGroup(broadcastId, channelName);
            
            console.log(`Channel/Broadcast created successfully: ${channelName}`);
            return {
                success: true,
                channelId: broadcastId,
                name: channelName,
                info: groupInfo
            };
        } catch (error) {
            console.error('Error creating channel:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async promoteUser(sock, groupId, userId) {
        try {
            await sock.groupParticipantsUpdate(
                groupId,
                [userId + '@s.whatsapp.net'],
                'promote'
            );
            return true;
        } catch (error) {
            console.error('Promote error:', error);
            throw error;
        }
    }

    async demoteUser(sock, groupId, userId) {
        try {
            await sock.groupParticipantsUpdate(
                groupId,
                [userId + '@s.whatsapp.net'],
                'demote'
            );
            return true;
        } catch (error) {
            console.error('Demote error:', error);
            throw error;
        }
    }

    async removeUser(sock, groupId, userId) {
        try {
            await sock.groupParticipantsUpdate(
                groupId,
                [userId + '@s.whatsapp.net'],
                'remove'
            );
            return true;
        } catch (error) {
            console.error('Remove error:', error);
            throw error;
        }
    }

    async getGroupInfo(sock, groupId) {
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            
            this.updateGroupInfo(groupId, {
                name: groupMetadata.subject,
                members: groupMetadata.participants.length
            });
            
            return {
                id: groupMetadata.id,
                subject: groupMetadata.subject,
                creation: groupMetadata.creation,
                owner: groupMetadata.owner,
                participants: groupMetadata.participants,
                description: groupMetadata.desc,
                members: groupMetadata.participants.length
            };
        } catch (error) {
            console.error('Group info error:', error);
            throw error;
        }
    }

    async getAllGroupsInfo(sock) {
        const groupsInfo = [];
        
        for (const [groupId, groupInfo] of this.groups) {
            try {
                const metadata = await this.getGroupInfo(sock, groupId);
                groupsInfo.push({
                    ...groupInfo,
                    ...metadata
                });
            } catch (error) {
                groupsInfo.push({
                    ...groupInfo,
                    error: 'Could not fetch metadata'
                });
            }
        }
        
        return groupsInfo;
    }

    getGroupStatistics() {
        return {
            ...this.groupStats,
            inactiveGroups: this.groupStats.totalGroups - this.groupStats.activeGroups,
            averageMessages: this.groupStats.totalGroups > 0 ? 
                (this.groupStats.messagesSent / this.groupStats.totalGroups).toFixed(2) : 0
        };
    }

    exportGroupLinks() {
        const links = [];
        
        for (const [groupId, groupInfo] of this.groups) {
            if (groupInfo.isActive && groupInfo.inviteLink) {
                links.push({
                    name: groupInfo.name,
                    link: groupInfo.inviteLink,
                    members: groupInfo.members,
                    joinedAt: groupInfo.joinedAt
                });
            }
        }
        
        return links;
    }

    async generateInviteLink(sock, groupId) {
        try {
            const inviteCode = await sock.groupInviteCode(groupId);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            
            this.updateGroupInfo(groupId, { inviteLink: inviteLink });
            return inviteLink;
        } catch (error) {
            console.error('Error generating invite link:', error);
            throw error;
        }
    }

    handleParticipantUpdate(update) {
        const { id, participants, action } = update;
        
        if (this.groups.has(id)) {
            const group = this.groups.get(id);
            this.updateGroupInfo(id, { members: participants.length });
        }
    }

    handleGroupMessage(groupId) {
        if (this.groups.has(groupId)) {
            const group = this.groups.get(groupId);
            this.updateGroupInfo(groupId, {
                messageCount: group.messageCount + 1,
                lastMessage: new Date().toISOString()
            });
            this.groupStats.messagesSent++;
        }
    }
}

module.exports = GroupManager;
