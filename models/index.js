// models/index.js
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Dog = require('./dog');
const RefreshToken = require('./refreshToken'); // Импорт модели RefreshToken

// Установка ассоциаций
User.hasMany(Dog, { foreignKey: 'ownerId' });
Dog.belongsTo(User, { foreignKey: 'ownerId' });
User.hasMany(RefreshToken, { foreignKey: 'userId' }); // Новая ассоциация
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

const db = {
  sequelize,
  Sequelize,
  User,
  Dog,
  RefreshToken // Экспорт новой модели
};

module.exports = db;
