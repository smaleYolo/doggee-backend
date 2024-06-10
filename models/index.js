const { Sequelize } = require('sequelize'); // Импортируйте Sequelize
const sequelize = require('../config/database');
const User = require('./user');
const Dog = require('./dog');

// Установка ассоциаций
User.hasMany(Dog, { foreignKey: 'ownerId' });
Dog.belongsTo(User, { foreignKey: 'ownerId' });

const db = {
    sequelize,
    Sequelize, // Экспортируйте Sequelize
    User,
    Dog
};

module.exports = db;
