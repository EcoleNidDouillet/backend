/**
 * Parent Portal API Routes - École Nid Douillet
 * 
 * Restricted access API endpoints for parent portal functionality
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
  getParentDashboard,
  getChildDetails,
  getPaymentHistory,
  updateParentProfile
} = require('../controllers/parent.controller');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     ParentProfile:
 *       type: object
 *       properties:
 *         phone:
 *           type: string
 *           pattern: '^(\+212|0)[5-7][0-9]{8}$'
 *           description: Moroccan phone number
 *         address:
 *           type: string
 *           maxLength: 500
 *           description: Parent address
 *         emergency_contact:
 *           type: string
 *           maxLength: 200
 *           description: Emergency contact information
 *         profession:
 *           type: string
 *           maxLength: 100
 *           description: Parent profession
 *         workplace:
 *           type: string
 *           maxLength: 200
 *           description: Parent workplace
 *         preferred_language:
 *           type: string
 *           enum: [FR, AR]
 *           description: Preferred language for communications
 *         communication_preferences:
 *           type: string
 *           enum: [EMAIL, SMS, BOTH]
 *           description: Preferred communication method
 *         notes:
 *           type: string
 *           maxLength: 1000
 *           description: Additional notes
 */

// Validation schemas
const updateProfileSchema = Joi.object({
  phone: Joi.string().pattern(/^(\+212|0)[5-7][0-9]{8}$/).optional().messages({
    'string.pattern.base': 'Numéro de téléphone marocain invalide'
  }),
  address: Joi.string().max(500).optional().messages({
    'string.max': 'L\'adresse ne peut pas dépasser 500 caractères'
  }),
  emergency_contact: Joi.string().max(200).optional().messages({
    'string.max': 'Le contact d\'urgence ne peut pas dépasser 200 caractères'
  }),
  profession: Joi.string().max(100).optional().messages({
    'string.max': 'La profession ne peut pas dépasser 100 caractères'
  }),
  workplace: Joi.string().max(200).optional().messages({
    'string.max': 'Le lieu de travail ne peut pas dépasser 200 caractères'
  }),
  preferred_language: Joi.string().valid('FR', 'AR').optional().messages({
    'any.only': 'Langue préférée invalide (FR ou AR)'
  }),
  communication_preferences: Joi.string().valid('EMAIL', 'SMS', 'BOTH').optional().messages({
    'any.only': 'Préférence de communication invalide (EMAIL, SMS ou BOTH)'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Les notes ne peuvent pas dépasser 1000 caractères'
  })
});

const paymentHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  childId: Joi.string().uuid().optional(),
  paymentStatus: Joi.string().valid('PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED').optional(),
  paymentType: Joi.string().valid('TUITION', 'CARE_SERVICES', 'OTHER').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

/**
 * @swagger
 * /api/parent/dashboard:
 *   get:
 *     summary: Get parent dashboard overview
 *     tags: [Parent Portal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Parent dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     parent:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         preferred_language:
 *                           type: string
 *                         communication_preferences:
 *                           type: string
 *                         last_login_formatted:
 *                           type: string
 *                     academicYear:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         year_label:
 *                           type: string
 *                         is_current:
 *                           type: boolean
 *                     children:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           first_name:
 *                             type: string
 *                           last_name:
 *                             type: string
 *                           age:
 *                             type: integer
 *                           gender:
 *                             type: string
 *                           level_name:
 *                             type: string
 *                           relationship_type:
 *                             type: string
 *                           is_primary:
 *                             type: boolean
 *                     paymentSummary:
 *                       type: object
 *                       properties:
 *                         totalPayments:
 *                           type: integer
 *                         pendingPayments:
 *                           type: integer
 *                         overduePayments:
 *                           type: integer
 *                         pendingAmount:
 *                           type: number
 *                         overdueAmount:
 *                           type: number
 *                         paidAmount:
 *                           type: number
 *                     careServices:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           child_name:
 *                             type: string
 *                           service_name:
 *                             type: string
 *                           hours_per_week:
 *                             type: integer
 *                           weekly_cost:
 *                             type: number
 *                           is_active:
 *                             type: boolean
 *                     recentNotifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           template_type:
 *                             type: string
 *                           subject:
 *                             type: string
 *                           status:
 *                             type: string
 *                           sent_at_formatted:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalChildren:
 *                           type: integer
 *                         activeCareServices:
 *                           type: integer
 *                         urgentPayments:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/dashboard',
  authenticate,
  requireRole('PARENT'),
  getParentDashboard
);

/**
 * @swagger
 * /api/parent/children/{childId}:
 *   get:
 *     summary: Get detailed information for a specific child
 *     tags: [Parent Portal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Child ID
 *     responses:
 *       200:
 *         description: Child details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     child:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         first_name:
 *                           type: string
 *                         last_name:
 *                           type: string
 *                         age:
 *                           type: integer
 *                         gender:
 *                           type: string
 *                         birth_date_formatted:
 *                           type: string
 *                         enrollment_date_formatted:
 *                           type: string
 *                         level_name:
 *                           type: string
 *                         academic_year:
 *                           type: string
 *                         medical_info:
 *                           type: string
 *                         allergies:
 *                           type: string
 *                         emergency_contact:
 *                           type: string
 *                     parentRelation:
 *                       type: object
 *                       properties:
 *                         relationship_type:
 *                           type: string
 *                         is_primary:
 *                           type: boolean
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           payment_type:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           currency:
 *                             type: string
 *                           payment_status:
 *                             type: string
 *                           due_date_formatted:
 *                             type: string
 *                           payment_reference:
 *                             type: string
 *                     careServices:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           service_name:
 *                             type: string
 *                           hours_per_week:
 *                             type: integer
 *                           weekly_cost:
 *                             type: number
 *                           is_active:
 *                             type: boolean
 *                           start_date_formatted:
 *                             type: string
 *                           end_date_formatted:
 *                             type: string
 *                     otherParents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           first_name:
 *                             type: string
 *                           last_name:
 *                             type: string
 *                           relationship_type:
 *                             type: string
 *                           is_primary:
 *                             type: boolean
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalPayments:
 *                           type: integer
 *                         pendingPayments:
 *                           type: integer
 *                         overduePayments:
 *                           type: integer
 *                         activeCareServices:
 *                           type: integer
 *                         totalPaid:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Child access denied
 *       404:
 *         description: Child not found
 */
router.get('/children/:childId',
  authenticate,
  requireRole('PARENT'),
  getChildDetails
);

/**
 * @swagger
 * /api/parent/payments:
 *   get:
 *     summary: Get parent's payment history with filtering
 *     tags: [Parent Portal]
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
 *         name: childId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific child
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, OVERDUE, CANCELLED]
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: string
 *           enum: [TUITION, CARE_SERVICES, OTHER]
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
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           payment_type:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           currency:
 *                             type: string
 *                           payment_status:
 *                             type: string
 *                           payment_date_formatted:
 *                             type: string
 *                           due_date_formatted:
 *                             type: string
 *                           payment_reference:
 *                             type: string
 *                           child_name:
 *                             type: string
 *                           academic_year:
 *                             type: string
 *                           fee_breakdown:
 *                             type: object
 *                           care_services_breakdown:
 *                             type: object
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
router.get('/payments',
  authenticate,
  requireRole('PARENT'),
  validateRequest(paymentHistorySchema, 'query'),
  getPaymentHistory
);

/**
 * @swagger
 * /api/parent/profile:
 *   put:
 *     summary: Update parent profile information
 *     tags: [Parent Portal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ParentProfile'
 *           example:
 *             phone: "0661234567"
 *             address: "123 Rue Hassan II, Agadir"
 *             emergency_contact: "Fatima Alami - 0662345678"
 *             profession: "Ingénieur"
 *             workplace: "Société ABC"
 *             preferred_language: "FR"
 *             communication_preferences: "BOTH"
 *             notes: "Préfère être contacté le matin"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     address:
 *                       type: string
 *                     emergency_contact:
 *                       type: string
 *                     profession:
 *                       type: string
 *                     workplace:
 *                       type: string
 *                     preferred_language:
 *                       type: string
 *                     communication_preferences:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     updated_at_formatted:
 *                       type: string
 *       400:
 *         description: Validation error or no valid fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Parent not found
 */
router.put('/profile',
  authenticate,
  requireRole('PARENT'),
  validateRequest(updateProfileSchema),
  updateParentProfile
);

module.exports = router;
