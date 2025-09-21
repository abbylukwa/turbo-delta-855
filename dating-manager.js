const { Pool } = require('pg');

class DatingManager {
  constructor(pool) {
    this.pool = pool;
  }

  async handleDatingCommand(sock, message, args, sender) {
    const command = args[0]?.toLowerCase() || 'help';
    
    switch (command) {
      case 'create':
        await this.createProfile(sock, message, args.slice(1), sender);
        break;
      case 'view':
        await this.viewProfile(sock, sender);
        break;
      case 'edit':
        await this.editProfile(sock, message, args.slice(1), sender);
        break;
      case 'search':
        await this.searchProfiles(sock, sender, args.slice(1));
        break;
      case 'matches':
        await this.viewMatches(sock, sender);
        break;
      case 'message':
        await this.sendMessage(sock, message, args.slice(1), sender);
        break;
      case 'inbox':
        await this.viewInbox(sock, sender);
        break;
      case 'help':
      default:
        await this.showHelp(sock, sender);
        break;
    }
  }

  async createProfile(sock, message, args, sender) {
    try {
      // Check if profile already exists
      const existingProfile = await this.pool.query(
        'SELECT * FROM dating_profiles WHERE phone_number = $1',
        [sender]
      );

      if (existingProfile.rows.length > 0) {
        await sock.sendMessage(sender, {
          text: '❌ You already have a dating profile. Use .dating edit to update it.'
        });
        return;
      }

      // Parse profile information from message
      const text = message.message.conversation || message.message.extendedTextMessage.text;
      const profileData = this.parseProfileData(text);

      // Insert into database
      await this.pool.query(
        `INSERT INTO dating_profiles 
         (phone_number, name, age, gender, location, bio, interests) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sender, profileData.name, profileData.age, profileData.gender, 
         profileData.location, profileData.bio, profileData.interests]
      );

      await sock.sendMessage(sender, {
        text: '✅ Dating profile created successfully! Use .dating view to see your profile.'
      });

    } catch (error) {
      console.error('Error creating dating profile:', error);
      await sock.sendMessage(sender, {
        text: '❌ Error creating dating profile. Please try again.'
      });
    }
  }

  async viewProfile(sock, sender) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM dating_profiles WHERE phone_number = $1',
        [sender]
      );

      if (result.rows.length === 0) {
        await sock.sendMessage(sender, {
          text: '❌ No dating profile found. Use .dating create to create one.'
        });
        return;
      }

      const profile = result.rows[0];
      const profileText = this.formatProfile(profile);

      await sock.sendMessage(sender, { text: profileText });

    } catch (error) {
      console.error('Error viewing dating profile:', error);
      await sock.sendMessage(sender, {
        text: '❌ Error retrieving dating profile.'
      });
    }
  }

  async searchProfiles(sock, sender, filters) {
    try {
      // Build search query based on filters
      let query = `
        SELECT * FROM dating_profiles 
        WHERE phone_number != $1 AND is_active = TRUE
      `;
      const queryParams = [sender];

      // Add filters if provided
      if (filters.length > 0) {
        const filterConditions = [];
        filters.forEach((filter, index) => {
          const [field, value] = filter.split(':');
          if (field && value) {
            filterConditions.push(`${field} ILIKE $${index + 2}`);
            queryParams.push(`%${value}%`);
          }
        });

        if (filterConditions.length > 0) {
          query += ` AND (${filterConditions.join(' OR ')})`;
        }
      }

      query += ' ORDER BY RANDOM() LIMIT 10';

      const result = await this.pool.query(query, queryParams);

      if (result.rows.length === 0) {
        await sock.sendMessage(sender, {
          text: '❌ No profiles found matching your criteria.'
        });
        return;
      }

      let response = '👥 Dating Profiles Found:\n\n';
      result.rows.forEach((profile, index) => {
        response += `${index + 1}. ${profile.name} (${profile.age})\n`;
        response += `   📍 ${profile.location}\n`;
        response += `   💬 ${profile.bio?.substring(0, 50)}...\n`;
        response += `   👉 Use .dating message ${index + 1} to message them\n\n`;
      });

      // Store search results for messaging
      this.lastSearchResults = result.rows;

      await sock.sendMessage(sender, { text: response });

    } catch (error) {
      console.error('Error searching dating profiles:', error);
      await sock.sendMessage(sender, {
        text: '❌ Error searching dating profiles.'
      });
    }
  }

  async sendMessage(sock, message, args, sender) {
    try {
      if (args.length < 2) {
        await sock.sendMessage(sender, {
          text: 'Usage: .dating message [profile_number] [your_message]'
        });
        return;
      }

      const profileIndex = parseInt(args[0]) - 1;
      const messageText = args.slice(1).join(' ');

      if (!this.lastSearchResults || !this.lastSearchResults[profileIndex]) {
        await sock.sendMessage(sender, {
          text: '❌ Invalid profile number. Please search again.'
        });
        return;
      }

      const receiver = this.lastSearchResults[profileIndex].phone_number;

      // Save message to database
      await this.pool.query(
        'INSERT INTO dating_messages (sender_phone, receiver_phone, message) VALUES ($1, $2, $3)',
        [sender, receiver, messageText]
      );

      await sock.sendMessage(sender, {
        text: '✅ Message sent successfully!'
      });

      // Notify receiver if they're online
      try {
        await sock.sendMessage(receiver, {
          text: `💌 You have a new dating message! Use .dating inbox to view it.`
        });
      } catch (error) {
        console.log('Could not notify receiver:', error.message);
      }

    } catch (error) {
      console.error('Error sending dating message:', error);
      await sock.sendMessage(sender, {
        text: '❌ Error sending message.'
      });
    }
  }

  async viewInbox(sock, sender) {
    try {
      const result = await this.pool.query(
        `SELECT m.*, p.name as sender_name 
         FROM dating_messages m 
         JOIN dating_profiles p ON m.sender_phone = p.phone_number 
         WHERE m.receiver_phone = $1 
         ORDER BY m.timestamp DESC 
         LIMIT 10`,
        [sender]
      );

      if (result.rows.length === 0) {
        await sock.sendMessage(sender, {
          text: '📭 Your dating inbox is empty.'
        });
        return;
      }

      let inboxText = '📬 Dating Inbox:\n\n';
      result.rows.forEach((message, index) => {
        inboxText += `From: ${message.sender_name}\n`;
        inboxText += `Time: ${new Date(message.timestamp).toLocaleString()}\n`;
        inboxText += `Message: ${message.message}\n`;
        inboxText += '─'.repeat(30) + '\n\n';
      });

      await sock.sendMessage(sender, { text: inboxText });

      // Mark messages as read
      await this.pool.query(
        'UPDATE dating_messages SET is_read = TRUE WHERE receiver_phone = $1',
        [sender]
      );

    } catch (error) {
      console.error('Error viewing dating inbox:', error);
      await sock.sendMessage(sender, {
        text: '❌ Error retrieving messages.'
      });
    }
  }

  parseProfileData(text) {
    // Simple parsing logic - in real implementation, you'd use a more robust method
    const lines = text.split('\n');
    const data = {
      name: '',
      age: null,
      gender: '',
      location: '',
      bio: '',
      interests: []
    };

    lines.forEach(line => {
      if (line.toLowerCase().includes('name:')) data.name = line.split(':')[1]?.trim();
      if (line.toLowerCase().includes('age:')) data.age = parseInt(line.split(':')[1]?.trim());
      if (line.toLowerCase().includes('gender:')) data.gender = line.split(':')[1]?.trim();
      if (line.toLowerCase().includes('location:')) data.location = line.split(':')[1]?.trim();
      if (line.toLowerCase().includes('bio:')) data.bio = line.split(':')[1]?.trim();
      if (line.toLowerCase().includes('interests:')) {
        data.interests = line.split(':')[1]?.split(',').map(i => i.trim()).filter(i => i);
      }
    });

    return data;
  }

  formatProfile(profile) {
    return `
👤 Dating Profile:
───────────────
📛 Name: ${profile.name || 'Not set'}
🎂 Age: ${profile.age || 'Not set'}
🚻 Gender: ${profile.gender || 'Not set'}
📍 Location: ${profile.location || 'Not set'}
💬 Bio: ${profile.bio || 'Not set'}
🎯 Interests: ${profile.interests?.join(', ') || 'Not set'}
───────────────
Use .dating edit to update your profile
    `.trim();
  }

  async showHelp(sock, sender) {
    const helpText = `
💕 Dating Commands:
─────────────────
.dating create - Create your dating profile
.dating view - View your dating profile
.dating edit - Edit your dating profile
.dating search - Search for other profiles
.dating matches - View your matches
.dating message [number] [msg] - Send a message
.dating inbox - View your messages
.dating help - Show this help
─────────────────
💡 Tips: Be honest in your profile and respectful in messages!
    `.trim();

    await sock.sendMessage(sender, { text: helpText });
  }
}

module.exports = DatingManager;