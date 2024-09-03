const bcrypt = require('bcryptjs');
const db = require('_helpers/db');

module.exports = {
    getAll,
    getById,
    
    create,
    update,
    delete: _delete,
    search
};

async function getAll() {
    return await db.User.findAll();
}
async function getById(id) {
    return await getUser(id);
} 
async function search(query) {
    // Construct search conditions with `LIKE` for partial matches
    const where = {};

    if (query.email) {
        where.email = { [Sequelize.Op.iLike]: `%${query.email}%` }; // Case-insensitive match
    }
    if (query.firstName) {
        where.firstName = { [Sequelize.Op.iLike]: `%${query.firstName}%` }; // Case-insensitive match
    }
    if (query.lastName) {
        where.lastName = { [Sequelize.Op.iLike]: `%${query.lastName}%` }; // Case-insensitive match
    }
    if (query.title) {
        where.title = { [Sequelize.Op.iLike]: `%${query.title}%` }; // Case-insensitive match
    }
    if (query.role) {
        where.role = { [Sequelize.Op.iLike]: `%${query.role}%` }; // Case-insensitive match
    }
    if (query.profilePic) {
        where.profilePic = { [Sequelize.Op.iLike]: `%${query.profilePic}%` }; // Case-insensitive match
    }

    try {
        console.log('Search criteria:', where); // Debugging statement

        // Find all users that match the search criteria
        const users = await db.User.findAll({ where });
        console.log('Search results:', users); // Debugging statement

        return users;
    } catch (error) {
        console.error('Error:', error); // Debugging statement
        throw error;
    }
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

    const usernameChanged = params.username && user.username !== params.username;
    if (usernameChanged && await db.User.findOne({ where: { username: params.username } })) {
        throw 'Username "' + params.username + '" is already taken';
    }
    
    if (params.password) 
        params.passwordHash = await bcrypt.hash(params.password, 10);
    
    Object.assign(user, params);
    await user.save();
}
async function _delete(id) {
    const user = await getUser(id);
    await user.destroy();
}
async function getUser(id) {
    const user = await db.User.findByPk(id);
    if (!user) throw 'User not found';
    return user;
}