// Toggle auto-join
if (text === '!autojoin on') {
    const status = groupManager.toggleAutoJoin(true);
    await sock.sendMessage(chatId, { text: `Auto-join ${status ? 'enabled' : 'disabled'}` });
}

if (text === '!autojoin off') {
    const status = groupManager.toggleAutoJoin(false);
    await sock.sendMessage(chatId, { text: `Auto-join ${status ? 'enabled' : 'disabled'}` });
}

// Check status
if (text === '!autojoin status') {
    const status = groupManager.getAutoJoinStatus();
    await sock.sendMessage(chatId, { text: `Auto-join is currently ${status ? 'enabled' : 'disabled'}` });
}            console.log(`Attempting to join group: ${groupLink}`);
            
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
