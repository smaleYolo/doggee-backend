const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user') // Импорт модели User

const Dog = sequelize.define(
	'Dog',
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		breed: {
			type: DataTypes.STRING,
		},
		birthdate: {
			type: DataTypes.DATE, // Поле даты рождения
			allowNull: true,
		},
		weight: {
			type: DataTypes.FLOAT, // Поле веса
			allowNull: true,
		},
		ownerId: {
			type: DataTypes.INTEGER,
			references: {
				model: User, // Определение связи с моделью User
				key: 'id',
			},
		},
	},
	{
		tableName: 'Dogs',
	}
)

Dog.belongsTo(User, { foreignKey: 'ownerId' })

module.exports = Dog
