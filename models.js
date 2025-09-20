const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

let sequelize;

// Use your actual connection string
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dating_database_apr8_user:qbbPlW38kKD70Jt1W35rHysW5gt96e8H@dpg-d2pga7ur433s73d97540-a:5432/dating_database_apr8';

// Initialize the database connection
function initSequelize() {
  if (!sequelize) {
    sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });
  }
  return sequelize;
}

// UserProfile Model
const UserProfile = initSequelize().define('UserProfile', {
  phoneNumber: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 18,
      max: 120
    }
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['male', 'female', 'other']]
    }
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  interestedIn: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['male', 'female', 'both']]
    }
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500] // Limit bio to 500 characters
    }
  },
  datingEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profileComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  profileViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  matches: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  lastActive: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'user',
    validate: {
      isIn: [['user', 'admin', 'moderator']]
    }
  }
}, {
  tableName: 'user_profiles',
  timestamps: true,
  indexes: [
    {
      fields: ['location']
    },
    {
      fields: ['gender']
    },
    {
      fields: ['interestedIn']
    },
    {
      fields: ['lastActive']
    }
  ]
});

// Connection Model (for matches)
const Connection = initSequelize().define('Connection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user1: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: UserProfile,
      key: 'phoneNumber'
    }
  },
  user2: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: UserProfile,
      key: 'phoneNumber'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'blocked'),
    defaultValue: 'pending'
  },
  initiatorPhone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  matchScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 100
    }
  }
}, {
  tableName: 'connections',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user1', 'user2']
    },
    {
      fields: ['status']
    },
    {
      fields: ['initiatorPhone']
    }
  ]
});

// DatingMessage Model
const DatingMessage = initSequelize().define('DatingMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sender: {
    type: DataTypes.STRING,
    allowNull: false
  },
  receiver: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  messageType: {
    type: DataTypes.ENUM('text', 'image', 'video', 'audio'),
    defaultValue: 'text'
  },
  mediaUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  conversationId: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: function() {
      // Generate a conversation ID based on sender and receiver
      const participants = [this.sender, this.receiver].sort();
      return participants.join('_');
    }
  }
}, {
  tableName: 'dating_messages',
  timestamps: true,
  indexes: [
    {
      fields: ['sender', 'receiver']
    },
    {
      fields: ['conversationId']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['isRead']
    }
  ]
});

// ActivationCode Model for bot activation
const ActivationCode = initSequelize().define('ActivationCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['user', 'admin', 'moderator']]
    }
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  usedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'activation_codes',
  timestamps: true,
  indexes: [
    {
      fields: ['code']
    },
    {
      fields: ['isUsed']
    }
  ]
});

// Group Model for WhatsApp groups
const Group = initSequelize().define('Group', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  jid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  memberCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  adminPhone: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'groups',
  timestamps: true,
  indexes: [
    {
      fields: ['jid']
    },
    {
      fields: ['isActive']
    }
  ]
});

// Define associations
UserProfile.hasMany(Connection, { 
  foreignKey: 'user1', 
  as: 'initiatedConnections' 
});
UserProfile.hasMany(Connection, { 
  foreignKey: 'user2', 
  as: 'receivedConnections' 
});
Connection.belongsTo(UserProfile, { 
  foreignKey: 'user1', 
  as: 'initiatorProfile'
});
Connection.belongsTo(UserProfile, { 
  foreignKey: 'user2', 
  as: 'receiverProfile'
});

UserProfile.hasMany(DatingMessage, { 
  foreignKey: 'sender', 
  as: 'sentMessages' 
});
UserProfile.hasMany(DatingMessage, { 
  foreignKey: 'receiver', 
  as: 'receivedMessages' 
});
DatingMessage.belongsTo(UserProfile, { 
  foreignKey: 'sender', 
  as: 'senderProfile' 
});
DatingMessage.belongsTo(UserProfile, { 
  foreignKey: 'receiver', 
  as: 'receiverProfile' 
});

UserProfile.hasMany(ActivationCode, {
  foreignKey: 'usedBy',
  as: 'activationCodes'
});
ActivationCode.belongsTo(UserProfile, {
  foreignKey: 'usedBy',
  as: 'user'
});

// Initialize database
async function initializeDatabase() {
  try {
    const sequelizeInstance = initSequelize();
    
    await sequelizeInstance.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync all models
    await sequelizeInstance.sync({ force: false });
    console.log('✅ Database synchronized successfully.');
    
    return {
      sequelize: sequelizeInstance,
      UserProfile,
      Connection,
      DatingMessage,
      ActivationCode,
      Group
    };
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
}

// Function to close database connection
async function closeDatabase() {
  if (sequelize) {
    await sequelize.close();
    console.log('✅ Database connection closed.');
  }
}

module.exports = {
  sequelize: initSequelize(),
  UserProfile,
  Connection,
  DatingMessage,
  ActivationCode,
  Group,
  initializeDatabase,
  closeDatabase
};