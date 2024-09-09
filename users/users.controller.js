const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const Role = require('_helpers/role');
const userService = require('./user.service');

router.get('/', getAll); 
router.get('/search', search);
router.get('/searchAll', searchAll);  
router.get('/:id', getById);
router.post('/', createSchema, create);
router.put('/:id', updateSchema, update);
router.delete('/:id', _delete);

router.put('/:id/role', updateRoleSchema, updateRole);
router.get('/:id/permissions', getById);

router.get('/:id/preferences', getPreferences);
router.put('/:id/preferences', updatePreferencesSchema, updatePreferences);

router.put('/:id/password', changePassSchema, changePass);

router.post('/login', loginSchema, login);
router.get('/:id/activity', getActivities);


module.exports = router;

function getAll(req, res, next) {
    userService.getAll()
        .then(users => res.json(users))
        .catch(next);
}
function getById(req, res, next) {
    userService.getById(req.params.id)
        .then(user => res.json(user))
        .catch(next);
}
function create(req, res, next) {
    userService.create(req.body)
        .then(() => res.json({ message: 'User created' }))
        .catch(next);
}
function update(req, res, next) {
    userService.update(req.params.id, req.body)
        .then(() => res.json({ message: 'User updated' }))
        .catch(next);
}
function _delete(req, res, next) {
    userService.delete(req.params.id)
        .then(() => res.json({ message: 'User deleted' }))
        .catch(next);
}
function createSchema(req, res, next) {
        const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        role: Joi.string().valid(Role.Admin, Role.User).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        profilePic: Joi.string().required()
    });
    validateRequest(req, next, schema);

}
function updateSchema(req, res, next) {
    const schema = Joi.object({
        title: Joi.string().empty(''),
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        email: Joi.string().email().empty(''),
        password: Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty(''),
        profilePic: Joi.string().empty('')
    }).with('password', 'confirmPassword');
    validateRequest(req, next, schema);
}

//==================================== Update role route ===============================================
function updateRole(req, res, next) {
    userService.update(req.params.id, req.body)
    .then(() => res.json({ message: 'Role updated' }))
    .catch(next);
}
function updateRoleSchema(req, res, next) {
    const schema = Joi.object({
        role: Joi.string().valid(Role.Admin, Role.User).empty('')
    })
    validateRequest(req, next, schema);
}
//====================Preferences Router Function=========================
function getPreferences(req, res, next) {
    userService.getPreferences(req.params.id)
        .then(preferences => res.json(preferences))
        .catch(next);
}
function updatePreferences(req, res, next) {
    userService.updatePreferences(req.params.id, req.body)
        .then(() => res.json({ message: 'Preferences updated successfully' }))
        .catch(next);
}
function updatePreferencesSchema(req, res, next) {
    const schema = Joi.object({
        theme: Joi.string().valid(Actions.Theme1, Actions.Theme2).optional(),
        notifications: Joi.boolean().optional(),
        language: Joi.string().valid(Actions.Lang1, Actions.Lang2).optional()
    });
    validateRequest(req, next, schema);
}

//===================Change Password Function=======================================
function changePass(req, res, next) {
    userService.changePass(req.params.id, req.body)
    .then(() => res.json({ message: 'Password updated' }))
    .catch(next);
}
function changePassSchema(req, res, next) {
    const schema = Joi.object({
        currentPassword: Joi.string().min(6).required(),
        newPassword: Joi.string().min(6).empty('').required(),
        confirmPassword: Joi.string().valid(Joi.ref('newPassword')).empty('').required()
    })
    validateRequest(req, next, schema);
}
//====================Login with Token Function=========================
function login(req, res, next) {
    userService.login(req.body)
        .then(({ token }) => res.json({ token }))
        .catch(next);
}
function loginSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}
//===================Logging Function=======================================
function getActivities(req, res, next) {
    const filters = {
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate
    };
    userService.getUserActivities(req.params.id, filters)
        .then(activities => res.json(activities))
        .catch(next);
}

//--------------------------------- search route ------------------------------------------

function search(req, res, next) {
    const { email, title, firstName, lastName, role, fullName } = req.query;

    if (!email && !title && !firstName && !lastName && !role && !fullName) {
        return res.status(400).json({ message: 'At least one search term is required' });
    }

    userService.search({ email, title, firstName, lastName, role, fullName })
        .then(users => res.json(users))  // 'users' will now include 'fullName'
        .catch(next);
}
function searchAll(req, res, next) {
    const query = req.query.query; 
    
    if (!query) {
        return res.status(400).json({ message: 'Search term is required' });
    }

    userService.searchAll(query)
        .then(users => res.json(users))
        .catch(next);
}


