// activation-manager.js
const fs = require('fs').promises;
const path = require('path');

class ActivationManager {
    constructor(userManager) {
        this.userManager = userManager;
        this.activationAttempts = new Map();
        this.activationCodes = {
            admin: 'Pretty0121',
            groupManager: 'Abner0121',
            general: 'Abbie0121'
        };
        this.initialize();
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        } catch (error) {
            console.error('Error initializing ActivationManager:', error);
        }
    }

    // Get activation codes
    getActivationCodes() {
        return { ...this.activationCodes };
    }

    // Validate activation code
    validateActivationCode(code) {
        return Object.values(this.activationCodes).includes(code);
    }

    // Get role from activation code
    getRoleFromCode(code) {
        for (const [role, activationCode] of Object.entries(this.activationCodes)) {
            if (activationCode === code) {
                return role;
            }
        }
        return 'user'; // Default role if code not found
    }

    // Check if user has exceeded activation attempts
    hasExceededAttempts(phoneNumber) {
        const now = Date.now();
        const attempts = this.activationAttempts.get(phoneNumber) || [];
        
        // Remove attempts older than 1 hour
        const recentAttempts = attempts.filter(timestamp => now - timestamp < 3600000);
        this.activationAttempts.set(phoneNumber, recentAttempts);
        
        return recentAttempts.length >= 5; // Max 5 attempts per hour
    }

    // Record activation attempt
    recordActivationAttempt(phoneNumber) {
        const attempts = this.activationAttempts.get(phoneNumber) || [];
        attempts.push(Date.now());
        this.activationAttempts.set(phoneNumber, attempts);
    }

    // Handle activation process
    async handleActivation(sock, sender, phoneNumber, username, code) {
        try {
            // Check rate limiting
            if (this.hasExceededAttempts(phoneNumber)) {
                // Don't send message, just return failure
                return {
                    success: false,
                    message: null // No message sent for failed attempts
                };
            }

            this.recordActivationAttempt(phoneNumber);

            // Validate activation code
            if (!this.validateActivationCode(code)) {
                // Don't send message for invalid codes
                return {
                    success: false,
                    message: null // No message sent for failed attempts
                };
            }

            // Get role from code
            const role = this.getRoleFromCode(code);

            // Check if user already exists
            const existingUser = await this.userManager.getUser(phoneNumber);
            
            if (existingUser) {
                if (existingUser.isActivated) {
                    // Don't send message for already activated users
                    return {
                        success: false,
                        message: null // No message sent for failed attempts
                    };
                } else {
                    // Update existing inactive user
                    const updateResult = await this.userManager.updateUser(phoneNumber, {
                        role: role,
                        activationCodeUsed: code,
                        username: username
                    });

                    if (updateResult.success) {
                        // Activate the user
                        const activationResult = await this.userManager.activateUser(phoneNumber);
                        
                        if (activationResult.success) {
                            console.log(`✅ User ${phoneNumber} activated successfully as ${role}`);
                            this.activationAttempts.delete(phoneNumber);
                            
                            // Only send message on successful activation
                            return {
                                success: true,
                                role: role,
                                message: `✅ Account activated successfully! You are now registered as ${role}.`
                            };
                        }
                    }
                    
                    // Don't send message for update failures
                    return {
                        success: false,
                        message: null // No message sent for failed attempts
                    };
                }
            } else {
                // Register and activate new user
                const registrationResult = await this.userManager.registerUser(
                    phoneNumber, 
                    username, 
                    code
                );

                if (registrationResult.success) {
                    // Activate the user
                    const activationResult = await this.userManager.activateUser(phoneNumber);
                    
                    if (activationResult.success) {
                        console.log(`✅ New user ${phoneNumber} registered and activated as ${role}`);
                        this.activationAttempts.delete(phoneNumber);
                        
                        // Only send message on successful activation
                        return {
                            success: true,
                            role: role,
                            message: `✅ Account registered and activated successfully! You are now registered as ${role}.`
                        };
                    }
                }
                
                // Don't send message for registration failures
                return {
                    success: false,
                    message: null // No message sent for failed attempts
                };
            }

        } catch (error) {
            console.error('Error in activation process:', error);
            // Don't send message for errors
            return {
                success: false,
                message: null // No message sent for failed attempts
            };
        }
    }

    // Reset activation attempts for a user
    resetActivationAttempts(phoneNumber) {
        this.activationAttempts.delete(phoneNumber);
    }

    // Get activation statistics
    async getActivationStats() {
        try {
            const users = await this.userManager.getAllUsers();
            const stats = {
                totalUsers: Object.keys(users).length,
                activatedUsers: 0,
                pendingActivation: 0,
                byRole: {
                    admin: 0,
                    groupManager: 0,
                    user: 0
                },
                recentAttempts: 0
            };

            const oneHourAgo = Date.now() - 3600000;
            
            // Count users
            for (const user of Object.values(users)) {
                if (user.isActivated) {
                    stats.activatedUsers++;
                    stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;
                } else {
                    stats.pendingActivation++;
                }
            }

            // Count recent attempts
            for (const attempts of this.activationAttempts.values()) {
                stats.recentAttempts += attempts.filter(timestamp => timestamp > oneHourAgo).length;
            }

            return stats;
        } catch (error) {
            console.error('Error getting activation stats:', error);
            return null;
        }
    }

    // Change activation codes (admin function)
    changeActivationCode(role, newCode) {
        if (this.activationCodes[role]) {
            const oldCode = this.activationCodes[role];
            this.activationCodes[role] = newCode;
            console.log(`🔄 Activation code for ${role} changed from ${oldCode} to ${newCode}`);
            return true;
        }
        return false;
    }

    // List all activation codes
    listActivationCodes() {
        return Object.entries(this.activationCodes).map(([role, code]) => ({
            role,
            code,
            description: this.getRoleDescription(role)
        }));
    }

    getRoleDescription(role) {
        const descriptions = {
            admin: 'Full system administrator with all permissions',
            groupManager: 'Can manage groups and user permissions',
            user: 'Regular user with basic access'
        };
        return descriptions[role] || 'Unknown role';
    }

    // Verify if a user can be activated
    async canActivateUser(phoneNumber) {
        try {
            const user = await this.userManager.getUser(phoneNumber);
            
            if (!user) {
                return {
                    canActivate: true,
                    reason: 'New user can be activated'
                };
            }

            if (user.isActivated) {
                return {
                    canActivate: false,
                    reason: 'User is already activated'
                };
            }

            // Check if user was recently created (within 24 hours)
            const registrationDate = new Date(user.registrationDate);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            if (registrationDate < twentyFourHoursAgo) {
                return {
                    canActivate: false,
                    reason: 'Registration expired (more than 24 hours old)'
                };
            }

            return {
                canActivate: true,
                reason: 'User can be activated'
            };

        } catch (error) {
            console.error('Error checking activation eligibility:', error);
            return {
                canActivate: false,
                reason: 'Error checking eligibility'
            };
        }
    }

    // Get user activation status
    async getUserActivationStatus(phoneNumber) {
        try {
            const user = await this.userManager.getUser(phoneNumber);
            
            if (!user) {
                return {
                    exists: false,
                    isActivated: false,
                    role: null,
                    registrationDate: null,
                    activationDate: null
                };
            }

            return {
                exists: true,
                isActivated: user.isActivated,
                role: user.role,
                registrationDate: user.registrationDate,
                activationDate: user.activationDate,
                activationCodeUsed: user.activationCodeUsed
            };

        } catch (error) {
            console.error('Error getting user activation status:', error);
            return {
                exists: false,
                isActivated: false,
                role: null,
                error: 'Failed to get status'
            };
        }
    }

    // Bulk activation check
    async bulkCheckActivationStatus(phoneNumbers) {
        const results = {};
        
        for (const phoneNumber of phoneNumbers) {
            results[phoneNumber] = await this.getUserActivationStatus(phoneNumber);
        }
        
        return results;
    }

    // Export activation data for reporting
    async exportActivationData() {
        try {
            const users = await this.userManager.getAllUsers();
            const activationData = [];
            
            for (const [phoneNumber, user] of Object.entries(users)) {
                activationData.push({
                    phoneNumber,
                    username: user.username,
                    role: user.role,
                    isActivated: user.isActivated,
                    registrationDate: user.registrationDate,
                    activationDate: user.activationDate,
                    activationCodeUsed: user.activationCodeUsed,
                    lastSeen: user.lastSeen
                });
            }
            
            return activationData;
        } catch (error) {
            console.error('Error exporting activation data:', error);
            return [];
        }
    }

    // Import activation data
    async importActivationData(data) {
        try {
            for (const item of data) {
                // Check if user exists
                const existingUser = await this.userManager.getUser(item.phoneNumber);
                
                if (existingUser) {
                    // Update existing user
                    await this.userManager.updateUser(item.phoneNumber, {
                        role: item.role,
                        isActivated: item.isActivated,
                        activationDate: item.activationDate,
                        activationCodeUsed: item.activationCodeUsed
                    });
                } else {
                    // Create new user
                    await this.userManager.registerUser(
                        item.phoneNumber,
                        item.username,
                        item.activationCodeUsed
                    );
                    
                    if (item.isActivated) {
                        await this.userManager.activateUser(item.phoneNumber);
                    }
                }
            }
            
            return { success: true, message: `Imported ${data.length} user records` };
        } catch (error) {
            console.error('Error importing activation data:', error);
            return { success: false, message: 'Import failed' };
        }
    }
}

module.exports = ActivationManager;
