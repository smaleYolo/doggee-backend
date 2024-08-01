const { Sequelize } = require('sequelize');
const pg = require('pg'); // Импортируйте модуль pg
require('dotenv').config(); 

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectModule: pg,
    protocol: 'postgres',
    logging: false // Отключение логов Sequelize
});

module.exports = sequelize;
