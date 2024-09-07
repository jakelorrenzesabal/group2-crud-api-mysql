const bcrypt = require('bcryptjs');
const db = require('_helpers/db');
const { Sequelize, Op } = require('sequelize');

module.exports = {
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    search,
    searchAll,

    getPreferences,
    updatePreferences
};

//----------------------------------- Get all users -----------------------------------
async function getAll() {
    return await db.User.findAll();
}

//----------------------------------- Get user by ID -----------------------------------
async function getById(id) {
    return await getUser(id);
} 

//------------------------------------ Create users ------------------------------------
async function create(params) {
    if (await db.User.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }
    
    const user = new db.User(params);
    user.passwordHash = await bcrypt.hash(params.password, 10);
    await user.save();
}

// ------------------------------------ Upadate user by Id ------------------------------
async function update(id, params) {
    const user = await getUser(id);

    const usernameChanged = params.username && user.username !== params.username;
    if (usernameChanged && await db.User.findOne({ where: { username: params.username } })) {
        throw 'Username "' + params.username + '" is already taken';
    }
    
    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }
    
    Object.assign(user, params);
    await user.save();
}

// ------------------------------------ Delete user by ID --------------------------------
async function _delete(id) {
    const user = await getUser(id);
    await user.destroy();
}
//------------------------------------- Get user by ID and show error message when user is not in the database  ------------------
async function getUser(id) {
    const user = await db.User.findByPk(id);
    if (!user) throw 'User ad found';
    return user;
}

//-------------------------------------- Search functions -----------------------------------

async function searchAll(query) {
    // Perform a case-insensitive search across multiple fields
    const users = await db.User.findAll({
        where: {
            [Op.or]: [
                { email: { [Op.like]: `%${query}%` } },
                { title: { [Op.like]: `%${query}%` } },
                { firstName: { [Op.like]: `%${query}%` } },
                { lastName: { [Op.like]: `%${query}%` } },
                { role: { [Op.like]: `%${query}%` } }
            ]
        }
    });

    if (users.length === 0) throw new Error('No users found matching the search criteria');
    return users;
}

async function search(params) {
    // Build dynamic query
    const whereClause = {};

    if (params.email) {
        whereClause.email = { [Op.like]: `%${params.email}%` };
    }
    if (params.title) {
        whereClause.title = { [Op.like]: `%${params.title}%` };
    }
    if (params.fullName) {
        whereClause[Op.or] = [
            Sequelize.where(Sequelize.fn('CONCAT', Sequelize.col('firstName'), ' ', Sequelize.col('lastName')), {
                [Op.like]: `%${params.fullName}%`
            })
        ];
    } else {
        // Search firstName and lastName individually if fullName isn't provided
        if (params.firstName) {
            whereClause.firstName = { [Op.like]: `%${params.firstName}%` };
        }
        if (params.lastName) {
            whereClause.lastName = { [Op.like]: `%${params.lastName}%` };
        }
    }
    
    if (params.role) {
        whereClause.role = { [Op.like]: `%${params.role}%` };
    }

    const users = await db.User.findAll({
        where: whereClause
    });

    if (users.length === 0) throw new Error('No users found matching the search criteria');
    return users;
}

//===============Preferences Get & Update Function===========================
async function getPreferences(id, params) {
    const preferences = await db.User.findOne({ where: { id: id }, attributes: [ 'id', 'theme', 'notifications', 'language' ] });
    if (!preferences) throw 'User not found';
    return preferences;
}
async function updatePreferences(id, params) {
    const preferences = await db.User.findOne({ where: { id } });
    if (!preferences) throw 'User not found';

    Object.assign(preferences, params);
    await preferences.save();
}