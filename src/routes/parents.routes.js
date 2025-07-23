/**
 * Parents API Routes - École Nid Douillet
 * 
 * RESTful API endpoints for parent management
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { createParent, getParentById, getAllParents, updateParent, linkParentToChild, unlinkParentFromChild, getParentStatistics, updateParentPassword } = require('../models/Parent');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     Parent:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - phone
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the parent
 *         firstName:
 *           type: string
 *           description: Parent's first name
 *         lastName:
 *           type: string
 *           description: Parent's last name
 *         email:
 *           type: string
 *           format: email
 *           description: Parent's email address
 *         phone:
 *           type: string
 *           description: Parent's phone number (Moroccan format)
 *         address:
 *           type: string
 *           description: Parent's address
 *         emergencyContact:
 *           type: string
 *           description: Emergency contact information
 *         profession:
 *           type: string
 *           description: Parent's profession
 *         workplace:
 *           type: string
 *           description: Parent's workplace
 *         relationshipToChild:
 *           type: string
 *           enum: [PARENT, GUARDIAN, OTHER]
 *           description: Relationship to child
 *         preferredLanguage:
 *           type: string
 *           enum: [fr, ar]
 *           description: Preferred language
 *         communicationPreferences:
 *           type: string
 *           enum: [EMAIL, SMS, BOTH]
 *           description: Communication preferences
 *         notes:
 *           type: string
 *           description: Additional notes
 */

// Validation schemas
const createParentSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Le prénom doit contenir au moins 2 caractères',
    'string.max': 'Le prénom ne peut pas dépasser 50 caractères',
    'any.required': 'Le prénom est obligatoire'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Le nom doit contenir au moins 2 caractères',
    'string.max': 'Le nom ne peut pas dépasser 50 caractères',
    'any.required': 'Le nom est obligatoire'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Format d\'email invalide',
    'any.required': 'L\'email est obligatoire'
  }),
  phone: Joi.string().pattern(/^(\+212|0)[5-7][0-9]{8}$/).required().messages({
    'string.pattern.base': 'Format de numéro de téléphone marocain invalide',
    'any.required': 'Le numéro de téléphone est obligatoire'
  }),
  password: Joi.string().min(8).optional().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères'
  }),
  address: Joi.string().max(200).allow('').optional(),
  emergencyContact: Joi.string().max(200).allow('').optional(),
  profession: Joi.string().max(100).allow('').optional(),
  workplace: Joi.string().max(100).allow('').optional(),
  relationshipToChild: Joi.string().valid('PARENT', 'GUARDIAN', 'OTHER').default('PARENT'),
  preferredLanguage: Joi.string().valid('fr', 'ar').default('fr'),
  communicationPreferences: Joi.string().valid('EMAIL', 'SMS', 'BOTH').default('EMAIL'),
  notes: Joi.string().max(1000).allow('').optional()
});

const updateParentSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^(\+212|0)[5-7][0-9]{8}$/).optional(),
  address: Joi.string().max(200).allow('').optional(),
  emergencyContact: Joi.string().max(200).allow('').optional(),
  profession: Joi.string().max(100).allow('').optional(),
  workplace: Joi.string().max(100).allow('').optional(),
  relationshipToChild: Joi.string().valid('PARENT', 'GUARDIAN', 'OTHER').optional(),
  preferredLanguage: Joi.string().valid('fr', 'ar').optional(),
  communicationPreferences: Joi.string().valid('EMAIL', 'SMS', 'BOTH').optional(),
  notes: Joi.string().max(1000).allow('').optional()
});

const queryParentsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  search: Joi.string().max(100).optional(),
  sortBy: Joi.string().valid('first_name', 'last_name', 'email', 'created_at').default('last_name'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
  includeChildren: Joi.boolean().default(false)
});

const linkParentChildSchema = Joi.object({
  childId: Joi.string().uuid().required().messages({
    'string.guid': 'ID d\'enfant invalide',
    'any.required': 'L\'ID de l\'enfant est obligatoire'
  })
});

const updatePasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
    'any.required': 'Le nouveau mot de passe est obligatoire'
  })
});

/**
 * @swagger
 * /api/parents:
 *   post:
 *     summary: Create a new parent
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Parent'
 *     responses:
 *       201:
 *         description: Parent created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticate,
  requirePermission('parents:create'),
  validateRequest(createParentSchema),
  async (req, res) => {
    try {
      const result = await createParent(req.body, req.user.userId);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'PARENT_CREATION_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents:
 *   get:
 *     summary: Get all parents with filtering and pagination
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [first_name, last_name, email, created_at]
 *           default: last_name
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *       - in: query
 *         name: includeChildren
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Parents retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/',
  authenticate,
  requirePermission('parents:read'),
  validateRequest(queryParentsSchema, 'query'),
  async (req, res) => {
    try {
      const result = await getAllParents(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'PARENTS_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents/statistics:
 *   get:
 *     summary: Get parent statistics
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/statistics',
  authenticate,
  requirePermission('parents:read'),
  async (req, res) => {
    try {
      const result = await getParentStatistics();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'STATISTICS_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents/{id}:
 *   get:
 *     summary: Get parent by ID
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Parent retrieved successfully
 *       404:
 *         description: Parent not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/:id',
  authenticate,
  requirePermission('parents:read'),
  async (req, res) => {
    try {
      const result = await getParentById(req.params.id);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PARENT_NOT_FOUND' : 'PARENT_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents/{id}:
 *   put:
 *     summary: Update parent information
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               emergencyContact:
 *                 type: string
 *               profession:
 *                 type: string
 *               workplace:
 *                 type: string
 *               relationshipToChild:
 *                 type: string
 *                 enum: [PARENT, GUARDIAN, OTHER]
 *               preferredLanguage:
 *                 type: string
 *                 enum: [fr, ar]
 *               communicationPreferences:
 *                 type: string
 *                 enum: [EMAIL, SMS, BOTH]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Parent updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Parent not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:id',
  authenticate,
  requirePermission('parents:update'),
  validateRequest(updateParentSchema),
  async (req, res) => {
    try {
      const result = await updateParent(req.params.id, req.body, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PARENT_NOT_FOUND' : 'PARENT_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents/{id}/password:
 *   put:
 *     summary: Update parent password
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Parent not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:id/password',
  authenticate,
  requirePermission('parents:update'),
  validateRequest(updatePasswordSchema),
  async (req, res) => {
    try {
      const result = await updateParentPassword(req.params.id, req.body.newPassword);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PARENT_NOT_FOUND' : 'PASSWORD_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents/{id}/children:
 *   post:
 *     summary: Link parent to child
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - childId
 *             properties:
 *               childId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Parent linked to child successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Parent or child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/:id/children',
  authenticate,
  requirePermission('parents:update'),
  validateRequest(linkParentChildSchema),
  async (req, res) => {
    try {
      const result = await linkParentToChild(req.params.id, req.body.childId, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PARENT_OR_CHILD_NOT_FOUND' : 'LINK_CREATION_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/parents/{id}/children/{childId}:
 *   delete:
 *     summary: Unlink parent from child
 *     tags: [Parents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Parent unlinked from child successfully
 *       404:
 *         description: Link not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.delete('/:id/children/:childId',
  authenticate,
  requirePermission('parents:update'),
  async (req, res) => {
    try {
      const result = await unlinkParentFromChild(req.params.id, req.params.childId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('Aucune liaison') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'LINK_NOT_FOUND' : 'LINK_DELETION_FAILED'
      });
    }
  }
);

module.exports = router;
