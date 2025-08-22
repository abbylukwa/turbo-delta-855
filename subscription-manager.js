const fs = require('fs');
const path = require('path');

class SubscriptionManager {
    constructor() {
        this.subscriptionsFile = path.join(__dirname, 'data', 'subscriptions.json');
        this.ensureDataDirectoryExists();
        this.subscriptions = this.loadSubscriptions();
    }

    ensureDataDirectoryExists() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.subscriptionsFile)) {
            fs.writeFileSync(this.subscriptionsFile, JSON.stringify({}));
        }
    }

    loadSubscriptions() {
        try {
            const data = fs.readFileSync(this.subscriptionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading subscriptions:', error);
            return {};
        }
    }

    saveSubscriptions() {
        try {
            fs.writeFileSync(this.subscriptionsFile, JSON.stringify(this.subscriptions, null, 2));
        } catch (error) {
            console.error('Error saving subscriptions:', error);
        }
    }

    initializeUser(phoneNumber) {
        if (!this.subscriptions[phoneNumber]) {
            this.subscriptions[phoneNumber] = {
                downloadCount: 0,
                subscriptionActive: false,
                subscriptionExpiry: null,
                paymentPending: false
            };
            this.saveSubscriptions();
        }
    }

    recordDownload(phoneNumber) {
        this.initializeUser(phoneNumber);
        this.subscriptions[phoneNumber].downloadCount++;
        this.saveSubscriptions();
    }

    canUserDownload(phoneNumber) {
        this.initializeUser(phoneNumber);
        const user = this.subscriptions[phoneNumber];
        
        // If user has active subscription, always allow
        if (user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date()) {
            return true;
        }
        
        // Allow up to 4 free downloads
        return user.downloadCount < 4;
    }

    getDownloadCount(phoneNumber) {
        this.initializeUser(phoneNumber);
        return this.subscriptions[phoneNumber].downloadCount;
    }

    getDownloadsLeft(phoneNumber) {
        this.initializeUser(phoneNumber);
        const user = this.subscriptions[phoneNumber];
        
        if (user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date()) {
            return 'Unlimited';
        }
        
        return Math.max(0, 4 - user.downloadCount);
    }

    hasActiveSubscription(phoneNumber) {
        this.initializeUser(phoneNumber);
        const user = this.subscriptions[phoneNumber];
        return user.subscriptionActive && new Date(user.subscriptionExpiry) > new Date();
    }

    activateSubscription(phoneNumber, durationWeeks = 2) {
        this.initializeUser(phoneNumber);
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (durationWeeks * 7));
        
        this.subscriptions[phoneNumber] = {
            ...this.subscriptions[phoneNumber],
            subscriptionActive: true,
            subscriptionExpiry: expiryDate.toISOString(),
            paymentPending: false
        };
        
        this.saveSubscriptions();
    }

    setPaymentPending(phoneNumber) {
        this.initializeUser(phoneNumber);
        this.subscriptions[phoneNumber].paymentPending = true;
        this.saveSubscriptions();
    }

    isPaymentPending(phoneNumber) {
        this.initializeUser(phoneNumber);
        return this.subscriptions[phoneNumber].paymentPending === true;
    }
}

module.exports = SubscriptionManager;        }
    }

    async ensureDataDirectory() {
        await fs.ensureDir('./data');
    }

    // Create or update dating profile
    createProfile(phoneNumber, profileData) {
        const profile = {
            phoneNumber: phoneNumber,
            ...profileData,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            profileViews: 0,
            matches: 0,
            oneNightStand: profileData.oneNightStand || false
        };

        this.profiles.set(phoneNumber, profile);
        this.saveDatingData();
        return profile;
    }

    // Get user profile
    getProfile(phoneNumber) {
        return this.profiles.get(phoneNumber);
    }

    // Check if user has active profile
    hasActiveProfile(phoneNumber) {
        const profile = this.profiles.get(phoneNumber);
        return profile && profile.isActive;
    }

    // Delete profile
    deleteProfile(phoneNumber) {
        this.profiles.delete(phoneNumber);
        this.connections.delete(phoneNumber);
        this.saveDatingData();
        return true;
    }

    // Search profiles with filters
    searchProfiles(filters = {}) {
        let results = Array.from(this.profiles.values())
            .filter(profile => profile.isActive);

        // Apply filters
        if (filters.gender) {
            results = results.filter(profile => 
                profile.gender?.toLowerCase() === filters.gender.toLowerCase());
        }

        if (filters.ageMin) {
            results = results.filter(profile => 
                profile.age >= filters.ageMin);
        }

        if (filters.ageMax) {
            results = results.filter(profile => 
                profile.age <= filters.ageMax);
        }

        if (filters.location) {
            results = results.filter(profile => 
                profile.location?.toLowerCase().includes(filters.location.toLowerCase()));
        }

        if (filters.oneNightStand !== undefined) {
            results = results.filter(profile => 
                profile.oneNightStand === filters.oneNightStand);
        }

        // Shuffle and limit results
        return this.shuffleArray(results).slice(0, filters.limit || 10);
    }

    // Shuffle array for random results
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Send connection request
    sendRequest(fromPhone, toPhone, message = '') {
        const requestId = `${fromPhone}-${toPhone}-${Date.now()}`;
        
        const request = {
            id: requestId,
            from: fromPhone,
            to: toPhone,
            message: message,
            status: 'pending',
            createdAt: new Date(),
            isOneNightStand: this.profiles.get(fromPhone)?.oneNightStand || false
        };

        this.requests.set(requestId, request);
        this.saveDatingData();
        return request;
    }

    // Get pending requests for user
    getPendingRequests(phoneNumber) {
        return Array.from(this.requests.values())
            .filter(request => request.to === phoneNumber && request.status === 'pending');
    }

    // Accept connection request
    acceptRequest(requestId) {
        const request = this.requests.get(requestId);
        if (request) {
            request.status = 'accepted';
            request.acceptedAt = new Date();
            
            // Create connection
            this.createConnection(request.from, request.to);
            
            this.saveDatingData();
            return request;
        }
        return null;
    }

    // Reject connection request
    rejectRequest(requestId) {
        const request = this.requests.get(requestId);
        if (request) {
            request.status = 'rejected';
            this.saveDatingData();
            return request;
        }
        return null;
    }

    // Create connection between users
    createConnection(user1, user2) {
        const connectionId = [user1, user2].sort().join('-');
        
        const connection = {
            id: connectionId,
            users: [user1, user2],
            createdAt: new Date(),
            messages: [],
            isActive: true
        };

        this.connections.set(connectionId, connection);
        
        // Update profile stats
        this.incrementMatches(user1);
        this.incrementMatches(user2);
        
        this.saveDatingData();
        return connection;
    }

    // Increment match count for profile
    incrementMatches(phoneNumber) {
        const profile = this.profiles.get(phoneNumber);
        if (profile) {
            profile.matches = (profile.matches || 0) + 1;
            this.saveDatingData();
        }
    }

    // Get user connections
    getUserConnections(phoneNumber) {
        return Array.from(this.connections.values())
            .filter(connection => 
                connection.users.includes(phoneNumber) && connection.isActive);
    }

    // Send message through connection
    sendMessage(connectionId, fromPhone, message) {
        const connection = this.connections.get(connectionId);
        if (connection && connection.users.includes(fromPhone)) {
            const chatMessage = {
                from: fromPhone,
                message: message,
                timestamp: new Date(),
                read: false
            };

            connection.messages.push(chatMessage);
            this.saveDatingData();
            return chatMessage;
        }
        return null;
    }

    // Get connection messages
    getConnectionMessages(connectionId, phoneNumber) {
        const connection = this.connections.get(connectionId);
        if (connection && connection.users.includes(phoneNumber)) {
            return connection.messages;
        }
        return [];
    }

    // Get potential matches based on profile
    getPotentialMatches(phoneNumber, limit = 5) {
        const userProfile = this.profiles.get(phoneNumber);
        if (!userProfile) return [];

        const filters = {
            gender: userProfile.interestedIn || userProfile.gender === 'male' ? 'female' : 'male',
            ageMin: userProfile.age - 5,
            ageMax: userProfile.age + 5,
            location: userProfile.location,
            limit: limit
        };

        return this.searchProfiles(filters)
            .filter(profile => profile.phoneNumber !== phoneNumber);
    }

    // Increment profile views
    incrementProfileViews(phoneNumber) {
        const profile = this.profiles.get(phoneNumber);
        if (profile) {
            profile.profileViews = (profile.profileViews || 0) + 1;
            this.saveDatingData();
        }
    }

    // Get dating statistics
    getDatingStats(phoneNumber) {
        const profile = this.profiles.get(phoneNumber);
        if (!profile) return null;

        const connections = this.getUserConnections(phoneNumber);
        const requests = this.getPendingRequests(phoneNumber);

        return {
            profileViews: profile.profileViews || 0,
            matches: profile.matches || 0,
            activeConnections: connections.length,
            pendingRequests: requests.length,
            oneNightStandMode: profile.oneNightStand || false
        };
    }
}

module.exports = DatingManager;
