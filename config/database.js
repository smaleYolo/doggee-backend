const { Sequelize } = require('sequelize');
require('dotenv').config(); // Импортируйте и настройте dotenv

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false // Отключение логов Sequelize
});

module.exports = sequelize;