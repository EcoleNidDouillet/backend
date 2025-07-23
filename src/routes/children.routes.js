/**
 * Children API Routes - École Nid Douillet
 * 
 * RESTful API endpoints for child management
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { createChild, getChildById, getAllChildren, updateChild, deleteChild, getChildrenStatistics, getChildrenByParent } = require('../models/Child');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     Child:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - birthDate
 *         - gender
 *         - academicYearId
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the child
 *         firstName:
 *           type: string
 *           description: Child's first name
 *         lastName:
 *           type: string
 *           description: Child's last name
 *         birthDate:
 *           type: string
 *           format: date
 *           description: Child's birth date
 *         gender:
 *           type: string
 *           enum: [M, F]
 *           description: Child's gender
 *         academicYearId:
 *           type: string
 *           format: uuid
 *           description: Academic year ID
 *         medicalInfo:
 *           type: string
 *           description: Medical information
 *         allergies:
 *           type: string
 *           description: Known allergies
 *         emergencyContact:
 *           type: string
 *           description: Emergency contact information
 *         notes:
 *           type: string
 *           description: Additional notes
 */

// Validation schemas
const createChildSchema = Joi.object({
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
  birthDate: Joi.date().iso().max('now').required().messages({
    'date.base': 'Format de date invalide',
    'date.max': 'La date de naissance ne peut pas être dans le futur',
    'any.required': 'La date de naissance est obligatoire'
  }),
  gender: Joi.string().valid('M', 'F').required().messages({
    'any.only': 'Le genre doit être M ou F',
    'any.required': 'Le genre est obligatoire'
  }),
  academicYearId: Joi.string().uuid().required().messages({
    'string.guid': 'ID d\'année académique invalide',
    'any.required': 'L\'année académique est obligatoire'
  }),
  medicalInfo: Joi.string().max(1000).allow('').optional(),
  allergies: Joi.string().max(500).allow('').optional(),
  emergencyContact: Joi.string().max(200).allow('').optional(),
  notes: Joi.string().max(1000).allow('').optional(),
  enrollmentDate: Joi.date().iso().optional()
});

const updateChildSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  medicalInfo: Joi.string().max(1000).allow('').optional(),
  allergies: Joi.string().max(500).allow('').optional(),
  emergencyContact: Joi.string().max(200).allow('').optional(),
  notes: Joi.string().max(1000).allow('').optional(),
  classLevelId: Joi.string().uuid().optional()
});

const queryChildrenSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  academicYearId: Joi.string().uuid().optional(),
  classLevelId: Joi.string().uuid().optional(),
  gender: Joi.string().valid('M', 'F').optional(),
  search: Joi.string().max(100).optional(),
  sortBy: Joi.string().valid('first_name', 'last_name', 'birth_date', 'created_at').default('last_name'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC')
});

/**
 * @swagger
 * /api/children:
 *   post:
 *     summary: Create a new child
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Child'
 *     responses:
 *       201:
 *         description: Child created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticate,
  requirePermission('children:create'),
  validateRequest(createChildSchema),
  async (req, res) => {
    try {
      const result = await createChild(req.body, req.user.userId);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'CHILD_CREATION_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/children:
 *   get:
 *     summary: Get all children with filtering and pagination
 *     tags: [Children]
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
 *         name: academicYearId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: classLevelId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [M, F]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [first_name, last_name, birth_date, created_at]
 *           default: last_name
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *     responses:
 *       200:
 *         description: Children retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/',
  authenticate,
  requirePermission('children:read'),
  validateRequest(queryChildrenSchema, 'query'),
  async (req, res) => {
    try {
      const result = await getAllChildren(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'CHILDREN_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/children/statistics:
 *   get:
 *     summary: Get children statistics
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *           format: uuid
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
  requirePermission('children:read'),
  async (req, res) => {
    try {
      const result = await getChildrenStatistics(req.query.academicYearId);
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
 * /api/children/{id}:
 *   get:
 *     summary: Get child by ID
 *     tags: [Children]
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
 *         description: Child retrieved successfully
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/:id',
  authenticate,
  requirePermission('children:read'),
  async (req, res) => {
    try {
      const result = await getChildById(req.params.id);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'CHILD_NOT_FOUND' : 'CHILD_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/children/{id}:
 *   put:
 *     summary: Update child information
 *     tags: [Children]
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
 *               medicalInfo:
 *                 type: string
 *               allergies:
 *                 type: string
 *               emergencyContact:
 *                 type: string
 *               notes:
 *                 type: string
 *               classLevelId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Child updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:id',
  authenticate,
  requirePermission('children:update'),
  validateRequest(updateChildSchema),
  async (req, res) => {
    try {
      const result = await updateChild(req.params.id, req.body, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'CHILD_NOT_FOUND' : 'CHILD_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/children/{id}:
 *   delete:
 *     summary: Delete child (soft delete)
 *     tags: [Children]
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
 *         description: Child deleted successfully
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.delete('/:id',
  authenticate,
  requirePermission('children:delete'),
  async (req, res) => {
    try {
      const result = await deleteChild(req.params.id, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'CHILD_NOT_FOUND' : 'CHILD_DELETION_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/children/parent/{parentId}:
 *   get:
 *     summary: Get children by parent ID
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Children retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/parent/:parentId',
  authenticate,
  requirePermission('children:read'),
  async (req, res) => {
    try {
      const result = await getChildrenByParent(req.params.parentId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'CHILDREN_RETRIEVAL_FAILED'
      });
    }
  }
);

module.exports = router;
