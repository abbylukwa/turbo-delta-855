class ActivationManager {
    constructor(userManager) {
        this.userManager = userManager;
    }

    async handleActivation(sock, sender, phoneNumber, username) {
        this.userManager.activateUser(phoneNumber, username);
        
        await sock.sendMessage(sender, { 
            text: `✅ Activation successful!\n\nWelcome ${username}! Your bot has been activated.\n\nFrom now on, I will automatically join any group links you send me.`
        });
        
        console.log(`✅ Activated ${username} (${phoneNumber})`);
    }
}

module.exports = ActivationManager;            [this.roles.ABBY]: `👋 Welcome ${username}! 🤖\n\n📊 Your Download Limits:\n• 🎥 Videos: 5/13 hours\n• 🖼️ Images: 10/13 hours\n\n💎 Subscription Plans:\n• 1 Week: 50¢ (Unlimited)\n• 2 Weeks: 75¢ (Unlimited)\n\n💡 Commands:\n• !search <query> - Find media\n• !download <number> - Download\n• !mystats - Your usage\n• !subscribe - Get premium\n• !help - Show help`,
            
            [this.roles.ADMIN]: `👑 Welcome Admin ${username}! 🌟\n\n⚡ ADMIN PRIVILEGES ACTIVATED ⚡\n\n🎯 Unlimited Downloads\n📊 Access to All Users\n🔧 System Management\n💰 OTP Generation\n\n💡 Admin Commands:\n• !search <query> - Search website media\n• !websearch <query> - Search entire web\n• !download <number> - Download any media\n• !users - View all users\n• !genotp <phone> <plan> <days> - Generate OTP\n• !userinfo <phone> - User details\n• !sysinfo - System statistics\n• !help - Show help`,
            
            [this.roles.NICCI]: `🛡️ Welcome Nicci ${username}! ⚡\n\n🌐 GROUP MANAGEMENT MODE ACTIVATED 🌐\n\n🤖 Auto-join group links\n📤 Send messages to all groups\n📊 Group statistics tracking\n🔗 Group link management\n👥 Member management\n\n💡 Nicci Commands:\n• !joingroup <link> - Join group from link\n• !creategroup <name> - Create new group\n• !createchannel <name> - Create channel\n• !groupstats - Group statistics\n• !grouplinks - Export group links\n• !sendall <message> - Send to all groups\n• !help - Show help\n\n⚡ Controlled by: +263717457592`
        };
        
        return messages[role] || `Welcome ${username}! Use !help for commands.`;
    }
}

module.exports = UserManager;
