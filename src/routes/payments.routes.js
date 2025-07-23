/**
 * Payments API Routes - École Nid Douillet
 * 
 * RESTful API endpoints for payment management and financial tracking
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { createPayment, getPaymentById, getAllPayments, updatePayment, processPayment, getPaymentStatistics } = require('../models/Payment');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       required:
 *         - childId
 *         - amount
 *         - paymentType
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the payment
 *         childId:
 *           type: string
 *           format: uuid
 *           description: Child ID
 *         academicYearId:
 *           type: string
 *           format: uuid
 *           description: Academic year ID
 *         paymentType:
 *           type: string
 *           enum: [TUITION, CARE_SERVICES, OTHER]
 *           description: Type of payment
 *         amount:
 *           type: number
 *           minimum: 0
 *           description: Payment amount
 *         currency:
 *           type: string
 *           default: MAD
 *           description: Payment currency
 *         paymentMethod:
 *           type: string
 *           enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *           description: Payment method
 *         paymentStatus:
 *           type: string
 *           enum: [PENDING, COMPLETED, OVERDUE, CANCELLED]
 *           description: Payment status
 *         paymentDate:
 *           type: string
 *           format: date
 *           description: Payment date
 *         dueDate:
 *           type: string
 *           format: date
 *           description: Payment due date
 *         description:
 *           type: string
 *           description: Payment description
 *         feeBreakdown:
 *           type: object
 *           description: Detailed fee breakdown
 *         careServicesBreakdown:
 *           type: object
 *           description: Care services fee breakdown
 *         discountApplied:
 *           type: number
 *           minimum: 0
 *           description: Discount amount applied
 *         discountReason:
 *           type: string
 *           description: Reason for discount
 *         lateFeeApplied:
 *           type: number
 *           minimum: 0
 *           description: Late fee amount applied
 *         notes:
 *           type: string
 *           description: Additional notes
 */

// Validation schemas
const createPaymentSchema = Joi.object({
  childId: Joi.string().uuid().required().messages({
    'string.guid': 'ID d\'enfant invalide',
    'any.required': 'L\'ID de l\'enfant est obligatoire'
  }),
  academicYearId: Joi.string().uuid().optional(),
  paymentType: Joi.string().valid('TUITION', 'CARE_SERVICES', 'OTHER').default('TUITION'),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être positif',
    'any.required': 'Le montant est obligatoire'
  }),
  currency: Joi.string().valid('MAD', 'EUR', 'USD').default('MAD'),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').default('CASH'),
  paymentStatus: Joi.string().valid('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED').default('PENDING'),
  paymentDate: Joi.date().iso().optional(),
  dueDate: Joi.date().iso().optional(),
  description: Joi.string().max(500).allow('').optional(),
  feeBreakdown: Joi.object().optional(),
  careServicesBreakdown: Joi.object().optional(),
  discountApplied: Joi.number().min(0).default(0),
  discountReason: Joi.string().max(200).allow('').optional(),
  lateFeeApplied: Joi.number().min(0).default(0),
  notes: Joi.string().max(1000).allow('').optional()
});

const updatePaymentSchema = Joi.object({
  paymentStatus: Joi.string().valid('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED').optional(),
  paymentDate: Joi.date().iso().optional(),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').optional(),
  amount: Joi.number().positive().optional(),
  description: Joi.string().max(500).allow('').optional(),
  feeBreakdown: Joi.object().optional(),
  careServicesBreakdown: Joi.object().optional(),
  discountApplied: Joi.number().min(0).optional(),
  discountReason: Joi.string().max(200).allow('').optional(),
  lateFeeApplied: Joi.number().min(0).optional(),
  notes: Joi.string().max(1000).allow('').optional()
});

const processPaymentSchema = Joi.object({
  paymentDate: Joi.date().iso().default(() => new Date()),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').required().messages({
    'any.required': 'La méthode de paiement est obligatoire'
  }),
  notes: Joi.string().max(1000).allow('').optional()
});

const queryPaymentsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  academicYearId: Joi.string().uuid().optional(),
  childId: Joi.string().uuid().optional(),
  paymentType: Joi.string().valid('TUITION', 'CARE_SERVICES', 'OTHER').optional(),
  paymentStatus: Joi.string().valid('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED').optional(),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  search: Joi.string().max(100).optional(),
  sortBy: Joi.string().valid('created_at', 'payment_date', 'due_date', 'amount', 'payment_status').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
});

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Payment'
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticate,
  requirePermission('payments:create'),
  validateRequest(createPaymentSchema),
  async (req, res) => {
    try {
      const result = await createPayment(req.body, req.user.userId);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'PAYMENT_CREATION_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments with filtering and pagination
 *     tags: [Payments]
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
 *         name: childId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [TUITION, CARE_SERVICES, OTHER]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, OVERDUE, CANCELLED]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, payment_date, due_date, amount, payment_status]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/',
  authenticate,
  requirePermission('payments:read'),
  validateRequest(queryPaymentsSchema, 'query'),
  async (req, res) => {
    try {
      const result = await getAllPayments(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'PAYMENTS_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/statistics:
 *   get:
 *     summary: Get payment statistics
 *     tags: [Payments]
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
  requirePermission('payments:read'),
  async (req, res) => {
    try {
      const result = await getPaymentStatistics(req.query.academicYearId);
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
 * /api/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
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
 *         description: Payment retrieved successfully
 *       404:
 *         description: Payment not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/:id',
  authenticate,
  requirePermission('payments:read'),
  async (req, res) => {
    try {
      const result = await getPaymentById(req.params.id);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PAYMENT_NOT_FOUND' : 'PAYMENT_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/{id}:
 *   put:
 *     summary: Update payment information
 *     tags: [Payments]
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
 *               paymentStatus:
 *                 type: string
 *                 enum: [PENDING, COMPLETED, OVERDUE, CANCELLED]
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               description:
 *                 type: string
 *               feeBreakdown:
 *                 type: object
 *               careServicesBreakdown:
 *                 type: object
 *               discountApplied:
 *                 type: number
 *                 minimum: 0
 *               discountReason:
 *                 type: string
 *               lateFeeApplied:
 *                 type: number
 *                 minimum: 0
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Payment not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:id',
  authenticate,
  requirePermission('payments:update'),
  validateRequest(updatePaymentSchema),
  async (req, res) => {
    try {
      const result = await updatePayment(req.params.id, req.body, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PAYMENT_NOT_FOUND' : 'PAYMENT_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/payments/{id}/process:
 *   post:
 *     summary: Process payment (mark as completed)
 *     tags: [Payments]
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
 *               - paymentMethod
 *             properties:
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       400:
 *         description: Validation error or payment already processed
 *       404:
 *         description: Payment not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/:id/process',
  authenticate,
  requirePermission('payments:update'),
  validateRequest(processPaymentSchema),
  async (req, res) => {
    try {
      const result = await processPayment(req.params.id, req.body, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvé') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'PAYMENT_NOT_FOUND' : 'PAYMENT_PROCESSING_FAILED'
      });
    }
  }
);

module.exports = router;
