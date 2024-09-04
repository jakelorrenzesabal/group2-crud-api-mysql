const bcrypt = require('bcryptjs');
const db = require('_helpers/db');
const { Op } = require('sequelize');

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
    
    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }
    
    Object.assign(user, params);
    await user.save();
}

async function _delete(id) {
    const user = await getUser(id);
    await user.destroy();
}

async function getUser(id) {
    const user = await db.User.findByPk(id);
    if (!user) throw 'User ad found';
    return user;
}


async function search(query) {
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