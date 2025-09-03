const { Sequelize, DataTypes } = require('sequelize');

// Use your actual connection string
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dating_database_apr8_user:qbbPlW38kKD70Jt1W35rHysW5gt96e8H@dpg-d2pga7ur433s73d97540-a:5432/dating_database_apr8';

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

// UserProfile Model
const UserProfile = sequelize.define('UserProfile', {
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
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  interestedIn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
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
    defaultValue: 0
  },
  matches: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastActive: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user_profiles',
  timestamps: true
});

// Connection Model (for matches)
const Connection = sequelize.define('Connection', {
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
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending'
  },
  initiatorPhone: {  // ← Changed from 'initiator' to 'initiatorPhone'
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'connections',
  timestamps: true
});

// DatingMessage Model
const DatingMessage = sequelize.define('DatingMessage', {
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
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'dating_messages',
  timestamps: true
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
  as: 'initiatorProfile'  // ← Changed from 'initiator' to 'initiatorProfile'
});
Connection.belongsTo(UserProfile, { 
  foreignKey: 'user2', 
  as: 'receiverProfile'  // ← Changed from 'receiver' to 'receiverProfile' for consistency
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

// Initialize database
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync({ force: false });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  Sequelize,
  UserProfile,
  Connection,
  DatingMessage,
  initializeDatabase
};
