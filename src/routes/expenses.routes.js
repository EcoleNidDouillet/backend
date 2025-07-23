/**
 * Expenses API Routes - École Nid Douillet
 * 
 * RESTful API endpoints for expense management and financial tracking
 * Follows same logic as payments with currency support and profit calculations
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { createExpense, getExpenseById, getAllExpenses, updateExpense, deleteExpense, getExpenseStatistics } = require('../models/Expense');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     Expense:
 *       type: object
 *       required:
 *         - category
 *         - description
 *         - amount
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the expense
 *         category:
 *           type: string
 *           enum: [STAFF, SUPPLIES, UTILITIES, MAINTENANCE, MARKETING, OTHER]
 *           description: Expense category
 *         subcategory:
 *           type: string
 *           description: Expense subcategory
 *         description:
 *           type: string
 *           description: Expense description
 *         amount:
 *           type: number
 *           minimum: 0
 *           description: Expense amount
 *         currency:
 *           type: string
 *           default: MAD
 *           enum: [MAD, EUR, USD]
 *           description: Expense currency (same as payments)
 *         expenseDate:
 *           type: string
 *           format: date
 *           description: Expense date
 *         paymentMethod:
 *           type: string
 *           enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *           description: Payment method (same as payments)
 *         vendorName:
 *           type: string
 *           description: Vendor or supplier name
 *         receiptNumber:
 *           type: string
 *           description: Receipt or invoice number
 *         isRecurring:
 *           type: boolean
 *           default: false
 *           description: Whether expense is recurring
 *         recurringFrequency:
 *           type: string
 *           enum: [MONTHLY, QUARTERLY, YEARLY]
 *           description: Frequency for recurring expenses
 *         academicYearRelated:
 *           type: boolean
 *           default: true
 *           description: Whether expense is related to academic year
 *         notes:
 *           type: string
 *           description: Additional notes
 */

// Validation schemas
const createExpenseSchema = Joi.object({
  category: Joi.string().valid('STAFF', 'SUPPLIES', 'UTILITIES', 'MAINTENANCE', 'MARKETING', 'OTHER').required().messages({
    'any.only': 'Catégorie invalide',
    'any.required': 'La catégorie est obligatoire'
  }),
  subcategory: Joi.string().max(100).allow('').optional(),
  description: Joi.string().min(3).max(500).required().messages({
    'string.min': 'La description doit contenir au moins 3 caractères',
    'string.max': 'La description ne peut pas dépasser 500 caractères',
    'any.required': 'La description est obligatoire'
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être positif',
    'any.required': 'Le montant est obligatoire'
  }),
  currency: Joi.string().valid('MAD', 'EUR', 'USD').default('MAD'),
  expenseDate: Joi.date().iso().max('now').default(() => new Date()),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').default('CASH'),
  vendorName: Joi.string().max(200).allow('').optional(),
  receiptNumber: Joi.string().max(100).allow('').optional(),
  isRecurring: Joi.boolean().default(false),
  recurringFrequency: Joi.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY').optional(),
  academicYearRelated: Joi.boolean().default(true),
  notes: Joi.string().max(1000).allow('').optional()
});

const updateExpenseSchema = Joi.object({
  category: Joi.string().valid('STAFF', 'SUPPLIES', 'UTILITIES', 'MAINTENANCE', 'MARKETING', 'OTHER').optional(),
  subcategory: Joi.string().max(100).allow('').optional(),
  description: Joi.string().min(3).max(500).optional(),
  amount: Joi.number().positive().optional(),
  expenseDate: Joi.date().iso().max('now').optional(),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').optional(),
  vendorName: Joi.string().max(200).allow('').optional(),
  receiptNumber: Joi.string().max(100).allow('').optional(),
  isRecurring: Joi.boolean().optional(),
  recurringFrequency: Joi.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY').optional(),
  academicYearRelated: Joi.boolean().optional(),
  notes: Joi.string().max(1000).allow('').optional()
});

const queryExpensesSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  category: Joi.string().valid('STAFF', 'SUPPLIES', 'UTILITIES', 'MAINTENANCE', 'MARKETING', 'OTHER').optional(),
  subcategory: Joi.string().max(100).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  paymentMethod: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').optional(),
  isRecurring: Joi.boolean().optional(),
  search: Joi.string().max(100).optional(),
  sortBy: Joi.string().valid('expense_date', 'created_at', 'amount', 'category').default('expense_date'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
});

const statisticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

/**
 * @swagger
 * /api/expenses:
 *   post:
 *     summary: Create a new expense
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Expense'
 *     responses:
 *       201:
 *         description: Expense created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticate,
  requirePermission('expenses:create'),
  validateRequest(createExpenseSchema),
  async (req, res) => {
    try {
      const result = await createExpense(req.body, req.user.userId);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'EXPENSE_CREATION_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/expenses:
 *   get:
 *     summary: Get all expenses with filtering and pagination
 *     tags: [Expenses]
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
 *         name: category
 *         schema:
 *           type: string
 *           enum: [STAFF, SUPPLIES, UTILITIES, MAINTENANCE, MARKETING, OTHER]
 *       - in: query
 *         name: subcategory
 *         schema:
 *           type: string
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
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *       - in: query
 *         name: isRecurring
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [expense_date, created_at, amount, category]
 *           default: expense_date
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Expenses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     expenses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Expense'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/',
  authenticate,
  requirePermission('expenses:read'),
  validateRequest(queryExpensesSchema, 'query'),
  async (req, res) => {
    try {
      const result = await getAllExpenses(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'EXPENSES_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/expenses/statistics:
 *   get:
 *     summary: Get expense statistics with profit calculations
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics period
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully with profit calculations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: object
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalExpenses:
 *                           type: integer
 *                         totalAmount:
 *                           type: number
 *                           description: Total expense amount (used in profit = payments - expenses)
 *                         averageAmount:
 *                           type: number
 *                         recurringExpenses:
 *                           type: integer
 *                     categoryBreakdown:
 *                       type: object
 *                       properties:
 *                         staff:
 *                           type: number
 *                         supplies:
 *                           type: number
 *                         utilities:
 *                           type: number
 *                         maintenance:
 *                           type: number
 *                         marketing:
 *                           type: number
 *                         other:
 *                           type: number
 *                     categoryDistribution:
 *                       type: array
 *                     paymentMethodDistribution:
 *                       type: array
 *                     monthlyTrends:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/statistics',
  authenticate,
  requirePermission('expenses:read'),
  validateRequest(statisticsQuerySchema, 'query'),
  async (req, res) => {
    try {
      const result = await getExpenseStatistics(req.query);
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
 * /api/expenses/{id}:
 *   get:
 *     summary: Get expense by ID
 *     tags: [Expenses]
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
 *         description: Expense retrieved successfully
 *       404:
 *         description: Expense not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/:id',
  authenticate,
  requirePermission('expenses:read'),
  async (req, res) => {
    try {
      const result = await getExpenseById(req.params.id);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvée') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'EXPENSE_NOT_FOUND' : 'EXPENSE_RETRIEVAL_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/expenses/{id}:
 *   put:
 *     summary: Update expense information
 *     tags: [Expenses]
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
 *               category:
 *                 type: string
 *                 enum: [STAFF, SUPPLIES, UTILITIES, MAINTENANCE, MARKETING, OTHER]
 *               subcategory:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               expenseDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CHECK, CARD]
 *               vendorName:
 *                 type: string
 *               receiptNumber:
 *                 type: string
 *               isRecurring:
 *                 type: boolean
 *               recurringFrequency:
 *                 type: string
 *                 enum: [MONTHLY, QUARTERLY, YEARLY]
 *               academicYearRelated:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Expense updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Expense not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:id',
  authenticate,
  requirePermission('expenses:update'),
  validateRequest(updateExpenseSchema),
  async (req, res) => {
    try {
      const result = await updateExpense(req.params.id, req.body, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvée') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'EXPENSE_NOT_FOUND' : 'EXPENSE_UPDATE_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/expenses/{id}:
 *   delete:
 *     summary: Delete expense (soft delete)
 *     tags: [Expenses]
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
 *         description: Expense deleted successfully
 *       404:
 *         description: Expense not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.delete('/:id',
  authenticate,
  requirePermission('expenses:delete'),
  async (req, res) => {
    try {
      const result = await deleteExpense(req.params.id, req.user.userId);
      res.json(result);
    } catch (error) {
      const statusCode = error.message.includes('non trouvée') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: statusCode === 404 ? 'EXPENSE_NOT_FOUND' : 'EXPENSE_DELETION_FAILED'
      });
    }
  }
);

module.exports = router;
