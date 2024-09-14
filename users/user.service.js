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
    logout,
    logActivity,
    getUserActivities,
    deactivate,
    reactivate,

    getPermission,
    createPermission
};

//===============================Simple CRUD========================================
async function getAll() {
    return await db.User.findAll();
}
async function getById(id) {
    return await getUser(id);
} 
async function create(params) {
    if (await db.User.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }
    
    const user = new db.User(params);
    user.passwordHash = await bcrypt.hash(params.password, 10);
    await user.save();
}
async function update(id, params) {
    const user = await getUser(id);
    const oldData = user.toJSON(); // Get current user data as a plain object
    const updatedFields = []; // Declare updatedFields array

    // Exclude `ipAddress` and `browserInfo` from comparison if they're not part of user data
    const nonUserFields = ['ipAddress', 'browserInfo'];

    const usernameChanged = params.username && user.username !== params.username;
    if (usernameChanged && await db.User.findOne({ where: { username: params.username } })) {
        throw 'Username "' + params.username + '" is already taken';
    }

    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }

    // Check which fields have changed, excluding `ipAddress` and `browserInfo` from comparison
    for (const key in params) {
        if (params.hasOwnProperty(key) && !nonUserFields.includes(key)) {
            if (oldData[key] !== params[key]) {
                updatedFields.push(`${key}: ${oldData[key]} -> ${params[key]}`);
            }
        }
    }

    Object.assign(user, params);

    try {

        await user.save();

        // Log activity with updated fields
        const updateDetails = updatedFields.length > 0 
            ? `Updated fields: ${updatedFields.join(', ')}` 
            : 'No fields changed';

        await logActivity(user.id, 'update', params.ipAddress || 'Unknown IP', params.browserInfo || 'Unknown Browser', updateDetails);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

// ------------------------------------ Delete user by ID --------------------------------
async function _delete(id) {
    const user = await getUser(id);
    await user.destroy();
}
async function getUser(id) {
    const user = await db.User.findByPk(id);
    if (!user) throw 'User ad found';
    return user;
}
//--------------------------Search functions-------------------------------------
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
//===================Preferences Get & Update Function===========================
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

    
    const isSamePassword = await bcrypt.compare(params.newPassword, user.passwordHash);
    if (isSamePassword) throw 'New password cannot be the same as the current password';

    
    if (params.newPassword !== params.confirmPassword) throw 'New password and confirm password do not match';

    
    user.passwordHash = await bcrypt.hash(params.newPassword, 10);

    user.lastDateChangePass = new Date();
    
    // Save the user
    await user.save();

    try {
        await logActivity(user.id, 'change pass', params.ipAddress || 'Unknown IP', params.browserInfo || 'Unknown Browser');
    } catch (error) {
        console.error('Error logging activity:', error);
    }
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

        try {
        await logActivity(user.id, 'login', params.ipAddress || 'Unknown IP', params.browserInfo || 'Unknown Browser');
    } catch (error) {
        console.error('Error logging activity:', error);
    }

    return { token };
}
//===================Logout function==============================
async function logout(id, params) {
    const user = await db.User.findByPk(id);
    if (!user) throw new Error('User not found');

    try {
        // Log the user logout activity with IP and browser info
        await logActivity(
            user.id,
            'logout',
            params.ipAddress || 'Unknown IP',
            params.browserInfo || 'Unknown Browser',
            'User logged out'
        );
    } catch (error) {
        console.error('Error logging activity:', error);
    }

    return { message: 'User logged out successfully' };
}
//===================Logging function==============================
async function logActivity(userId, actionType, ipAddress, browserInfo, updateDetails = '') {
    try {
        // Create a new log entry in the 'activity_log' table
        await db.ActivityLog.create({
            userId,
            actionType,
            actionDetails: `IP Address: ${ipAddress}, Browser Info: ${browserInfo}, Details: ${updateDetails}`,
            timestamp: new Date()
        });

        // Count the number of logs for the user
        const logCount = await db.ActivityLog.count({ where: { userId } });

        if (logCount > 10) {
            // Find and delete the oldest logs
            const logsToDelete = await db.ActivityLog.findAll({
                where: { userId },
                order: [['timestamp', 'ASC']], 
                limit: logCount - 10 
            });

            if (logsToDelete.length > 0) {
                const logIdsToDelete = logsToDelete.map(log => log.id);

                await db.ActivityLog.destroy({
                    where: {
                        id: {
                            [Op.in]: logIdsToDelete
                        }
                    }
                });
                console.log(`Deleted ${logIdsToDelete.length} oldest log(s) for user ${userId}.`);
            }
        }
    } catch (error) {
        console.error('Error logging activity:', error);
        throw error;
    }
}

async function getUserActivities(userId, filters = {}) {
    const user = await getUser(userId);
    if (!user) throw new Error('User not found');

    let whereClause = { userId };

    // Apply optional filters such as action type and timestamp range
    if (filters.actionType) {
        whereClause.actionType = { [Op.like]: `%${filters.actionType}%` }; // Use Op.like for partial match
    }
    if (filters.startDate || filters.endDate) {
        const startDate = filters.startDate ? new Date(filters.startDate) : new Date(0);
        const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
        whereClause.timestamp = { [Op.between]: [startDate, endDate] };
    }

    try {
        const activities = await db.ActivityLog.findAll({ where: whereClause });
        return activities;
    } catch (error) {
        console.error('Error retrieving activities:', error);
        throw new Error('Error retrieving activities');
    }
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