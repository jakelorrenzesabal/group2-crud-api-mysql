const bcrypt = require('bcryptjs');
const db = require('_helpers/db');

module.exports = {
    getAll,
    getById,
    getByEmail,
    create,
    update,
    delete: _delete
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
async function getByEmail(email) {
    const user = await db.User.findOne({
        where: { email }
    });
    if (!user) throw new Error('User not found');
    return user;
}