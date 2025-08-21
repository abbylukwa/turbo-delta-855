class GroupManager {
    constructor() {
        this.groups = new Map();
    }

    // Promote user in group
    async promoteUser(groupId, userId, sock) {
        try {
            await sock.groupParticipantsUpdate(
                groupId,
                [userId],
                'promote'
            );
            return true;
        } catch (error) {
            console.error('Promote error:', error);
            throw error;
        }
    }

    // Demote user in group
    async demoteUser(groupId, userId, sock) {
        try {
            await sock.groupParticipantsUpdate(
                groupId,
                [userId],
                'demote'
            );
            return true;
        } catch (error) {
            console.error('Demote error:', error);
            throw error;
        }
    }

    // Remove user from group
    async removeUser(groupId, userId, sock) {
        try {
            await sock.groupParticipantsUpdate(
                groupId,
                [userId],
                'remove'
            );
            return true;
        } catch (error) {
            console.error('Remove error:', error);
            throw error;
        }
    }

    // Get group information
    async getGroupInfo(groupId, sock) {
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            return {
                id: groupMetadata.id,
                subject: groupMetadata.subject,
                creation: groupMetadata.creation,
                owner: groupMetadata.owner,
                participants: groupMetadata.participants,
                description: groupMetadata.desc
            };
        } catch (error) {
            console.error('Group info error:', error);
            throw error;
        }
    }

    // Send announcement to group
    async sendAnnouncement(groupId, message, sock) {
        try {
            await sock.sendMessage(groupId, { text: `📢 ANNOUNCEMENT:\n${message}` });
            return true;
        } catch (error) {
            console.error('Announcement error:', error);
            throw error;
        }
    }

    // Set group subject
    async setGroupSubject(groupId, newSubject, sock) {
        try {
            await sock.groupUpdateSubject(groupId, newSubject);
            return true;
        } catch (error) {
            console.error('Set subject error:', error);
            throw error;
        }
    }

    // Set group description
    async setGroupDescription(groupId, description, sock) {
        try {
            await sock.groupUpdateDescription(groupId, description);
            return true;
        } catch (error) {
            console.error('Set description error:', error);
            throw error;
        }
    }

    // List all groups
    async listGroups(sock) {
        try {
            const groups = await sock.groupFetchAllParticipating();
            return Object.values(groups).map(group => ({
                id: group.id,
                subject: group.subject,
                participants: group.participants.length,
                owner: group.owner
            }));
        } catch (error) {
            console.error('List groups error:', error);
            return [];
        }
    }
}

module.exports = GroupManager;
