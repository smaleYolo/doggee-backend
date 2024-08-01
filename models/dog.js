const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user')

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
			allowNull: false,
		},
		birthdate: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		weight: {
			type: DataTypes.FLOAT,
			allowNull: true,
		},
		ownerId: {
			type: DataTypes.INTEGER,
			references: {
				model: User,
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
