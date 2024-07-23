'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Dogs', 'birthdate', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Dogs', 'weight', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Dogs', 'birthdate');
    await queryInterface.removeColumn('Dogs', 'weight');
  }
};
