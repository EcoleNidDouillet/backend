/**
 * Notifications API Routes - École Nid Douillet
 * 
 * RESTful API endpoints for notification management and communication
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { sendNotification, sendBulkNotification, getNotificationHistory } = require('../services/notification.service');
const Joi = require('joi');

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - parentId
 *         - templateType
 *         - data
 *       properties:
 *         parentId:
 *           type: string
 *           format: uuid
 *           description: Parent ID to send notification to
 *         templateType:
 *           type: string
 *           enum: [welcome, payment_reminder, payment_overdue, payment_confirmation, general_announcement]
 *           description: Type of notification template
 *         data:
 *           type: object
 *           description: Data for notification template
 *         options:
 *           type: object
 *           properties:
 *             subject:
 *               type: string
 *               description: Custom email subject
 *             customMessage:
 *               type: string
 *               description: Custom SMS message
 *     BulkNotification:
 *       type: object
 *       required:
 *         - parentIds
 *         - templateType
 *         - data
 *       properties:
 *         parentIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Array of parent IDs
 *         templateType:
 *           type: string
 *           enum: [welcome, payment_reminder, payment_overdue, payment_confirmation, general_announcement]
 *           description: Type of notification template
 *         data:
 *           type: object
 *           description: Data for notification template
 *         options:
 *           type: object
 *           properties:
 *             subject:
 *               type: string
 *               description: Custom email subject
 *             customMessage:
 *               type: string
 *               description: Custom SMS message
 */

// Validation schemas
const sendNotificationSchema = Joi.object({
  parentId: Joi.string().uuid().required().messages({
    'string.guid': 'ID parent invalide',
    'any.required': 'L\'ID du parent est obligatoire'
  }),
  templateType: Joi.string().valid(
    'welcome', 'payment_reminder', 'payment_overdue', 
    'payment_confirmation', 'general_announcement'
  ).required().messages({
    'any.only': 'Type de template invalide',
    'any.required': 'Le type de template est obligatoire'
  }),
  data: Joi.object().required().messages({
    'any.required': 'Les données du template sont obligatoires'
  }),
  options: Joi.object({
    subject: Joi.string().max(200).optional(),
    customMessage: Joi.string().max(160).optional()
  }).optional()
});

const sendBulkNotificationSchema = Joi.object({
  parentIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required().messages({
    'array.min': 'Au moins un parent doit être spécifié',
    'array.max': 'Maximum 100 parents par envoi groupé',
    'any.required': 'Les IDs des parents sont obligatoires'
  }),
  templateType: Joi.string().valid(
    'welcome', 'payment_reminder', 'payment_overdue', 
    'payment_confirmation', 'general_announcement'
  ).required().messages({
    'any.only': 'Type de template invalide',
    'any.required': 'Le type de template est obligatoire'
  }),
  data: Joi.object().required().messages({
    'any.required': 'Les données du template sont obligatoires'
  }),
  options: Joi.object({
    subject: Joi.string().max(200).optional(),
    customMessage: Joi.string().max(160).optional()
  }).optional()
});

const notificationHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  type: Joi.string().valid('EMAIL', 'SMS').optional(),
  status: Joi.string().valid('SENT', 'FAILED', 'PENDING').optional(),
  templateType: Joi.string().valid(
    'welcome', 'payment_reminder', 'payment_overdue', 
    'payment_confirmation', 'general_announcement'
  ).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Send notification to a parent
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Notification'
 *           examples:
 *             payment_reminder:
 *               summary: Payment reminder notification
 *               value:
 *                 parentId: "123e4567-e89b-12d3-a456-426614174000"
 *                 templateType: "payment_reminder"
 *                 data:
 *                   childName: "Ahmed Alami"
 *                   amount: 1500
 *                   currency: "MAD"
 *                   paymentType: "TUITION"
 *                   dueDate: "15/02/2024"
 *                   paymentReference: "PAY-202402-ABC123"
 *             general_announcement:
 *               summary: General announcement
 *               value:
 *                 parentId: "123e4567-e89b-12d3-a456-426614174000"
 *                 templateType: "general_announcement"
 *                 data:
 *                   title: "Réunion parents-enseignants"
 *                   content: "Nous organisons une réunion parents-enseignants le 20 février 2024 à 18h00."
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [EMAIL, SMS]
 *                       success:
 *                         type: boolean
 *                       messageId:
 *                         type: string
 *                       error:
 *                         type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/send',
  authenticate,
  requirePermission('notifications:send'),
  validateRequest(sendNotificationSchema),
  async (req, res) => {
    try {
      const { parentId, templateType, data, options } = req.body;
      const result = await sendNotification(parentId, templateType, data, options);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'NOTIFICATION_SEND_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/send-bulk:
 *   post:
 *     summary: Send bulk notifications to multiple parents
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkNotification'
 *           example:
 *             parentIds: 
 *               - "123e4567-e89b-12d3-a456-426614174000"
 *               - "123e4567-e89b-12d3-a456-426614174001"
 *             templateType: "general_announcement"
 *             data:
 *               title: "Fermeture exceptionnelle"
 *               content: "L'école sera fermée le 25 février 2024 pour formation du personnel."
 *     responses:
 *       200:
 *         description: Bulk notifications processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       parentId:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                       results:
 *                         type: array
 *                       error:
 *                         type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     success:
 *                       type: integer
 *                     failure:
 *                       type: integer
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/send-bulk',
  authenticate,
  requirePermission('notifications:send'),
  validateRequest(sendBulkNotificationSchema),
  async (req, res) => {
    try {
      const { parentIds, templateType, data, options } = req.body;
      const result = await sendBulkNotification(parentIds, templateType, data, options);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'BULK_NOTIFICATION_SEND_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/history:
 *   get:
 *     summary: Get notification history with filtering
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EMAIL, SMS]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SENT, FAILED, PENDING]
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *           enum: [welcome, payment_reminder, payment_overdue, payment_confirmation, general_announcement]
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
 *         description: Notification history retrieved successfully
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
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           recipient:
 *                             type: string
 *                           template_type:
 *                             type: string
 *                           subject:
 *                             type: string
 *                           status:
 *                             type: string
 *                           sent_at:
 *                             type: string
 *                           sent_at_formatted:
 *                             type: string
 *                           error_message:
 *                             type: string
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
router.get('/history',
  authenticate,
  requirePermission('notifications:read'),
  validateRequest(notificationHistorySchema, 'query'),
  async (req, res) => {
    try {
      const result = await getNotificationHistory(req.query);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'NOTIFICATION_HISTORY_FAILED'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/templates:
 *   get:
 *     summary: Get available notification templates
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available templates retrieved successfully
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
 *                     templates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           requiredFields:
 *                             type: array
 *                             items:
 *                               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/templates',
  authenticate,
  requirePermission('notifications:read'),
  async (req, res) => {
    try {
      const templates = [
        {
          type: 'welcome',
          name: 'Bienvenue',
          description: 'Message de bienvenue pour nouveaux parents',
          requiredFields: ['childName', 'academicYear', 'classLevel', 'enrollmentDate']
        },
        {
          type: 'payment_reminder',
          name: 'Rappel de paiement',
          description: 'Rappel pour paiement en attente',
          requiredFields: ['childName', 'amount', 'currency', 'paymentType', 'dueDate', 'paymentReference']
        },
        {
          type: 'payment_overdue',
          name: 'Paiement en retard',
          description: 'Notification pour paiement en retard',
          requiredFields: ['childName', 'amount', 'currency', 'paymentType', 'dueDate', 'daysOverdue', 'paymentReference']
        },
        {
          type: 'payment_confirmation',
          name: 'Confirmation de paiement',
          description: 'Confirmation de réception de paiement',
          requiredFields: ['childName', 'amount', 'currency', 'paymentType', 'paymentDate', 'paymentMethod', 'paymentReference']
        },
        {
          type: 'general_announcement',
          name: 'Annonce générale',
          description: 'Annonce ou communication générale',
          requiredFields: ['title', 'content']
        }
      ];

      res.json({
        success: true,
        data: { templates }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'TEMPLATES_RETRIEVAL_FAILED'
      });
    }
  }
);

module.exports = router;
