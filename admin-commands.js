class AdminCommands {
    constructor(userManager, imageDownloader, websiteScraper) {
        this.userManager = userManager;
        this.imageDownloader = imageDownloader;
        this.websiteScraper = websiteScraper;
    }

    // Check if message is admin command
    async handleAdminCommand(sock, sender, phoneNumber, username, text, message) {
        if (!this.userManager.hasPermission(phoneNumber, 'manage_subscriptions')) {
            return false;
        }

        const commands = [
            '!users', '!userinfo', '!genotp', '!sysinfo', 
            '!modifylimits', '!websearch', '!advanced'
        ];

        if (commands.some(cmd => text.startsWith(cmd))) {
            await this.processAdminCommand(sock, sender, phoneNumber, username, text, message);
            return true;
        }

        return false;
    }

    // Process admin commands
    async processAdminCommand(sock, sender, phoneNumber, username, text, message) {
        if (text === '!users') {
            await this.listAllUsers(sock, sender);
        } else if (text.startsWith('!userinfo ')) {
            await this.showUserInfo(sock, sender, text);
        } else if (text.startsWith('!genotp ')) {
            await this.generateOTP(sock, sender, text);
        } else if (text === '!sysinfo') {
            await this.showSystemInfo(sock, sender);
        } else if (text.startsWith('!modifylimits ')) {
            await this.modifyUserLimits(sock, sender, text);
        } else if (text.startsWith('!websearch ')) {
            await this.webSearch(sock, sender, phoneNumber, text);
        } else if (text.startsWith('!advanced ')) {
            await this.advancedSearch(sock, sender, phoneNumber, text);
        }
    }

    // List all users
    async listAllUsers(sock, sender) {
        const users = this.userManager.getAllUsers();
        
        if (users.length === 0) {
            await sock.sendMessage(sender, { text: "📊 No users registered yet." });
            return;
        }

        let usersText = "📊 ALL REGISTERED USERS\n\n";
        users.forEach((user, index) => {
            usersText += `${index + 1}. ${user.phoneNumber}\n`;
            usersText += `   👤 Role: ${user.role}\n`;
            usersText += `   📅 Joined: ${user.activatedAt.toLocaleDateString()}\n`;
            
            if (user.usage) {
                usersText += `   🎥 Videos: ${user.usage.videos?.used || 0}/${user.usage.videos?.limit || 0}\n`;
                usersText += `   🖼️ Images: ${user.usage.images?.used || 0}/${user.usage.images?.limit || 0}\n`;
            }
            
            if (user.subscription) {
                const status = user.subscription.isActive ? '✅ Active' : '❌ Expired';
                usersText += `   💎 Subscription: ${status}\n`;
                if (user.subscription.isActive) {
                    usersText += `   ⏰ Expires: ${user.subscription.expiresAt.toLocaleDateString()}\n`;
                }
            }
            
            usersText += "\n";
        });

        usersText += `\n📈 Total Users: ${users.length}`;

        await sock.sendMessage(sender, { text: usersText });
    }

    // Show user information
    async showUserInfo(sock, sender, text) {
        const targetPhone = text.replace('!userinfo ', '').trim();
        const userInfo = this.userManager.getUserInfo(targetPhone);

        if (!userInfo) {
            await sock.sendMessage(sender, { text: "❌ User not found." });
            return;
        }

        let infoText = `📋 USER INFORMATION\n\n`;
        infoText += `📞 Phone: ${userInfo.phoneNumber}\n`;
        infoText += `👤 Role: ${userInfo.role}\n`;
        infoText += `📅 Activated: ${userInfo.activatedAt.toLocaleDateString()}\n\n`;

        infoText += `📊 USAGE STATISTICS\n`;
        infoText += `🎥 Videos: ${userInfo.usage.videos.used}/${userInfo.usage.videos.limit}\n`;
        infoText += `🖼️ Images: ${userInfo.usage.images.used}/${userInfo.usage.images.limit}\n`;
        infoText += `⏰ Reset: ${userInfo.usage.videos.resetTime.toLocaleTimeString()}\n\n`;

        if (userInfo.subscription) {
            infoText += `💎 SUBSCRIPTION\n`;
            infoText += `📅 Plan: ${userInfo.subscription.plan}\n`;
            infoText += `🎯 Status: ${userInfo.subscription.isActive ? 'Active' : 'Expired'}\n`;
            if (userInfo.subscription.isActive) {
                infoText += `⏰ Expires: ${userInfo.subscription.expiresAt.toLocaleDateString()}\n`;
                infoText += `📆 Days left: ${userInfo.subscription.daysRemaining}\n`;
            }
        } else {
            infoText += `💎 No active subscription\n`;
        }

        await sock.sendMessage(sender, { text: infoText });
    }

    // Generate OTP for user
    async generateOTP(sock, sender, text) {
        const parts = text.split(' ');
        if (parts.length < 4) {
            await sock.sendMessage(sender, { text: "❌ Usage: !genotp <phone> <plan> <days>\nExample: !genotp 263123456789 2weeks 14" });
            return;
        }

        const targetPhone = parts[1];
        const plan = parts[2];
        const days = parseInt(parts[3]);

        if (!['1week', '2weeks'].includes(plan) || isNaN(days) || days <= 0) {
            await sock.sendMessage(sender, { text: "❌ Invalid plan or duration. Use: 1week or 2weeks, and valid days number." });
            return;
        }

        const duration = days * 24 * 60 * 60 * 1000;
        const otp = this.userManager.generateOTP(targetPhone, plan, duration);
        
        await sock.sendMessage(sender, { 
            text: `✅ OTP GENERATED SUCCESSFULLY\n\n📞 For: ${targetPhone}\n🔑 OTP Code: ${otp}\n📅 Plan: ${plan}\n⏰ Duration: ${days} days\n💰 Value: $${this.userManager.subscriptionPlans[plan].price}\n\n💡 User must use: !otp ${otp}` 
        });
    }

    // Show system information
    async showSystemInfo(sock, sender) {
        const stats = this.userManager.getSystemStats();
        
        let sysText = "🖥️ SYSTEM INFORMATION\n\n";
        sysText += `👥 Total Users: ${stats.totalUsers}\n`;
        sysText += `💎 Active Subscriptions: ${stats.activeSubscriptions}\n`;
        sysText += `📥 Total Downloads: ${stats.totalDownloads}\n\n`;
        
        sysText += `📊 Users by Role:\n`;
        sysText += `• Abby Users: ${stats.usersByRole.abby}\n`;
        sysText += `• Admin Users: ${stats.usersByRole.admin}\n`;
        sysText += `• Nicci Users: ${stats.usersByRole.nicci}\n\n`;
        
        sysText += `🔄 Last Updated: ${new Date().toLocaleString()}`;

        await sock.sendMessage(sender, { text: sysText });
    }

    // Modify user limits
    async modifyUserLimits(sock, sender, text) {
        const parts = text.split(' ');
        if (parts.length < 4) {
            await sock.sendMessage(sender, { text: "❌ Usage: !modifylimits <phone> <videos> <images>\nExample: !modifylimits 263123456789 10 20" });
            return;
        }

        const targetPhone = parts[1];
        const videos = parseInt(parts[2]);
        const images = parseInt(parts[3]);

        if (isNaN(videos) || isNaN(images) || videos < 0 || images < 0) {
            await sock.sendMessage(sender, { text: "❌ Invalid limits. Use positive numbers." });
            return;
        }

        const success = this.userManager.modifyUserLimits(targetPhone, {
            videos: videos,
            images: images
        });

        if (success) {
            await sock.sendMessage(sender, { 
                text: `✅ LIMITS UPDATED\n\n📞 User: ${targetPhone}\n🎥 New Video Limit: ${videos}\n🖼️ New Image Limit: ${images}\n\n⚡ Changes applied immediately.` 
            });
        } else {
            await sock.sendMessage(sender, { text: "❌ User not found or limits not updated." });
        }
    }

    // Web search functionality
    async webSearch(sock, sender, phoneNumber, text) {
        const query = text.replace('!websearch ', '').trim();
        if (!query) {
            await sock.sendMessage(sender, { text: "❌ Please provide a search query." });
            return;
        }

        await sock.sendMessage(sender, { text: `🌐 Searching the web for "${query}"...` });
        
        // This would integrate with a web search API
        // For now, we'll use the website scraper
        const results = await this.websiteScraper.scanWebsiteForImages();
        const filteredResults = results.filter(item => 
            item.filename.toLowerCase().includes(query.toLowerCase()) ||
            item.alt.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);

        if (filteredResults.length > 0) {
            this.imageDownloader.storeSearchResults(phoneNumber, filteredResults);
            
            let resultText = `🌍 Web Results for "${query}":\n\n`;
            filteredResults.forEach((result, index) => {
                resultText += `${index + 1}. ${result.filename}\n`;
                resultText += `   📝: ${result.alt}\n`;
                resultText += `   🌐: ${result.url}\n\n`;
            });
            resultText += "💡 Reply with !download <number> to download";

            await sock.sendMessage(sender, { text: resultText });
        } else {
            await sock.sendMessage(sender, { text: "❌ No web results found." });
        }
    }

    // Advanced search
    async advancedSearch(sock, sender, phoneNumber, text) {
        const query = text.replace('!advanced ', '').trim();
        if (!query) {
            await sock.sendMessage(sender, { text: "❌ Please provide a search query." });
            return;
        }

        await sock.sendMessage(sender, { text: `🔍 Advanced search for "${query}"...` });
        
        // Enhanced search with multiple criteria
        const results = await this.websiteScraper.scanWebsiteForImages();
        const filteredResults = results
            .filter(item => 
                item.filename.toLowerCase().includes(query.toLowerCase()) ||
                item.alt.toLowerCase().includes(query.toLowerCase())
            )
            .sort((a, b) => b.filename.length - a.filename.length) // Sort by relevance
            .slice(0, 5);

        if (filteredResults.length > 0) {
            this.imageDownloader.storeSearchResults(phoneNumber, filteredResults);
            
            let resultText = `🎯 Advanced Results for "${query}":\n\n`;
            filteredResults.forEach((result, index) => {
                resultText += `${index + 1}. ${result.filename}\n`;
                resultText += `   📝: ${result.alt}\n`;
                resultText += `   🔗: ${result.url}\n`;
                resultText += `   ⭐ Relevance: High\n\n`;
            });
            resultText += "💡 Reply with !download <number> to download";

            await sock.sendMessage(sender, { text: resultText });
        } else {
            await sock.sendMessage(sender, { text: "❌ No advanced results found." });
        }
    }
}

module.exports = AdminCommands;
