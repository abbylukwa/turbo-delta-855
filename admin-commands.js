class AdminCommands {
    constructor(userManager) {
        this.userManager = userManager;
    }

    // Generate OTP for user
    async generateUserOTP(sock, sender, phoneNumber, text) {
        if (!text.startsWith('!genotp ')) return false;

        const parts = text.split(' ');
        if (parts.length < 4) {
            await sock.sendMessage(sender, { text: "❌ Usage: !genotp <phone> <plan> <duration>" });
            return true;
        }

        const targetPhone = parts[1];
        const plan = parts[2];
        const duration = parseInt(parts[3]) * 24 * 60 * 60 * 1000; // Convert days to ms

        if (!['1week', '2weeks'].includes(plan) || isNaN(duration)) {
            await sock.sendMessage(sender, { text: "❌ Invalid plan or duration" });
            return true;
        }

        const otp = this.userManager.generateOTP(targetPhone, plan, duration);
        
        await sock.sendMessage(sender, { 
            text: `✅ OTP generated for ${targetPhone}\n\n🔑 OTP: ${otp}\n📅 Plan: ${plan}\n⏰ Duration: ${parts[3]} days\n\n💡 User must use: !otp ${otp}` 
        });

        return true;
    }

    // View user subscriptions
    async viewSubscriptions(sock, sender) {
        const subscriptions = Array.from(this.userManager.subscriptions.entries());
        
        if (subscriptions.length === 0) {
            await sock.sendMessage(sender, { text: "📊 No active subscriptions" });
            return;
        }

        let subText = "📊 Active Subscriptions:\n\n";
        subscriptions.forEach(([phone, sub], index) => {
            const isActive = sub.isActive && new Date() < sub.expiresAt;
            subText += `${index + 1}. ${phone}\n`;
            subText += `   📅 ${sub.plan}\n`;
            subText += `   ⏰ ${sub.expiresAt.toLocaleDateString()}\n`;
            subText += `   🎯 ${isActive ? 'Active' : 'Expired'}\n\n`;
        });

        await sock.sendMessage(sender, { text: subText });
    }
}

module.exports = AdminCommands;
