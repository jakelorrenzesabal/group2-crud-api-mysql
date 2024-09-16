const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        userId: { 
            type: DataTypes.INTEGER, 
            allowNull: false,
            references: {
                model: 'users', // Reference to User model
                key: 'id'
            }
        },
        actionType: { type: DataTypes.STRING, allowNull: false }, // Must not be null
        actionDetails: { type: DataTypes.TEXT, allowNull: true },
        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    };

    const options = {
        timestamps: false // No additional timestamps
    };

    return sequelize.define('ActivityLog', attributes, options);
}
