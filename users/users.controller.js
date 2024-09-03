const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const Role = require('_helpers/role');
const userService = require('./user.service');


router.get('/', getAll);
router.get('/:id', getById);
router.post('/', createSchema, create);
router.put('/:id', updateSchema, update);
router.delete('/:id', _delete);

router.get('/search', searchUsers);
router.put('/:id/role', updateRoleSchema, updateRole);
router.get('/:id/permissions', getById);


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
    .then(() => res.json({ message: 'User created'}))
    .catch(next);
}
function searchUsers(req, res, next) {
    const query = req.query; // Get query parameters
    userService.search(query)
        .then(users => {
            if (users.length === 0) {
                res.status(404).json({ message: 'No jake found' });
            } else {
                res.json(users);
            }
        })
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
//=====================================================

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