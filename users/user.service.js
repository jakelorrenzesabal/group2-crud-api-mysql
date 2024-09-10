const jwt = require('jsonwebtoken');
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
    updatePreferences,

    changePass,

    login,
    logActivity,
    getUserActivities,
    deactivate,
    reactivate,

    getPermission,
    createPermission
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
    if (params.status) {
        whereClause.status = params.status;
    }
    if (params.dateCreated) {
        whereClause.createdAt = { [Op.eq]: new Date(params.dateCreated) }; 
    }

    if (params.lastDateLogin) {
        whereClause.lastDateLogin = { [Op.eq]: new Date(params.lastDateLogin) }; 
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
//===================Change Password function==============================
async function changePass(id, params) {
    const user = await db.User.scope('withHash').findOne({ where: { id } });
    if (!user) throw 'User does not exist';

    const isPasswordValid = await bcrypt.compare(params.currentPassword, user.passwordHash);
    if (!isPasswordValid) throw 'Current password is incorrect';
    user.passwordHash = await bcrypt.hash(params.newPassword, 10);

    await user.save();
}
//===================Login wht Token function==============================
async function login(params) {
    const user = await db.User.scope('withHash').findOne({ where: { email: params.email } });
    if (!user) throw 'User does not exist';
    
    // Check if the user's account is active
    if (user.status === 'deactivated') throw 'Account is deactivated';

    const isPasswordValid = await bcrypt.compare(params.password, user.passwordHash);
    if (!isPasswordValid) throw 'Password Incorrect';

    const token = jwt.sign({ id: params.id, email: params.email, firstName: params.firstName }, 
        process.env.SECRET, {});

        user.lastDateLogin = new Date();  // Set current date and time
        await user.save();
        
    await logActivity(user.id, 'login', params.ipAddress || 'Unknown IP', params.browserInfo || 'Unknown Browser');

    return { token };
}
//------------------------- Deactivate User -------------------------
async function deactivate(id) {
    const user = await getUser(id);
    if (!user) throw 'User not found';

    // Check if the user is already deactivated
    if (user.status === 'deactivated') throw 'User is already deactivated';

    // Set status to 'deactivated' and save
    user.status = 'deactivated';
    await user.save();
}

//------------------------- Reactivate User -------------------------
async function reactivate(id) {
    const user = await getUser(id);
    if (!user) throw 'User not found';

    // Check if the user is already active
    if (user.status === 'active') throw 'User is already active';

    // Set status to 'active' and save
    user.status = 'active';
    await user.save();
}
//===================Logging function==============================
async function logActivity(userId, action, ipAddress, browserInfo) {
    try {
        const user = await db.User.findByPk(userId);
        if (!user) throw 'User not found';

        // Create a new log entry
        const logEntry = {
            action,
            timestamp: new Date(),
            ipAddress,
            browserInfo
        };

        // Update the user's activity logs
        const updatedLogs = user.activityLogs || [];
        updatedLogs.push(logEntry);

        // Limit the log size if needed (e.g., keep only the latest 50 logs)
        if (updatedLogs.length > 50) {
            updatedLogs.shift(); // Remove the oldest log entry
        }

        user.activityLogs = updatedLogs;
        await user.save();
    } catch (error) {
        console.error('Error logging activity:', error);
        throw error;
    }
}
async function getUserActivities(userId, filters = {}) {
    const user = await getUser(userId);
    let activities = user.activityLogs || [];

    // Apply optional filters such as action type and timestamp range
    if (filters.action) {
        activities = activities.filter(log => log.action === filters.action);
    }
    if (filters.startDate || filters.endDate) {
        const startDate = filters.startDate ? new Date(filters.startDate) : new Date(0);
        const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
        activities = activities.filter(log => new Date(log.timestamp) >= startDate && new Date(log.timestamp) <= endDate);
    }

    return activities;
}

//++++++++++++++++++++Permission Function+++++++++++++++++++++++++++++++++++++++++
async function getPermission(id, params) {
    const permision = await db.User.findOne({ where: { id: id }, attributes: [ 'id', 'permission', 'privileges', 'securable'] });
    if (!permision) throw 'User not found';
    return permision;
}
async function createPermission(id, params) {
    const permision = await db.User.findOne({ where: { id } });
    if (!permision) throw 'User not found';

    Object.assign(permision, params);
    await permision.save();
}