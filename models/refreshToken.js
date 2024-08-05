const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const RefreshToken = sequelize.define('RefreshToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id'
        }
    }
}, {
    tableName: 'RefreshTokens'
});

RefreshToken.belongsTo(User, { foreignKey: 'userId' });

module.exports = RefreshToken;
