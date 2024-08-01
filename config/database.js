const { Sequelize } = require('sequelize');
const pg = require('pg');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectModule: pg,
    protocol: 'postgres',
    logging: false, // Отключение логов Sequelize
    pool: {
        max: 10, // Максимальное количество соединений в пуле
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

module.exports = sequelize;