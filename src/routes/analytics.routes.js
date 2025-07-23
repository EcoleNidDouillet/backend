/**
 * École Nid Douillet - Analytics Routes
 * 
 * Advanced analytics and reporting endpoints
 */

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { 
  getEnrollmentAnalytics,
  getFinancialAnalytics,
  getOperationalAnalytics,
  generateComprehensiveReport
} = require('../controllers/analytics.controller');
const { ROLES } = require('../config/auth');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const analyticsQuerySchema = Joi.object({
  academic_year_id: Joi.number().integer().positive().optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().optional(),
  timeframe: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').default('monthly'),
  class_level_id: Joi.number().integer().positive().optional(),
  include_projections: Joi.boolean().default(false)
});

const reportQuerySchema = Joi.object({
  academic_year_id: Joi.number().integer().positive().optional(),
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().optional(),
  format_type: Joi.string().valid('json', 'pdf', 'excel').default('json')
});

/**
 * @swagger
 * components:
 *   schemas:
 *     EnrollmentAnalytics:
 *       type: object
 *       properties:
 *         enrollment_stats:
 *           type: object
 *           properties:
 *             total_children:
 *               type: integer
 *               description: Nombre total d'enfants inscrits
 *             male_count:
 *               type: integer
 *               description: Nombre de garçons
 *             female_count:
 *               type: integer
 *               description: Nombre de filles
 *             average_age:
 *               type: number
 *               description: Âge moyen des enfants
 *             active_class_levels:
 *               type: integer
 *               description: Nombre de niveaux de classe actifs
 *             recent_enrollments:
 *               type: integer
 *               description: Inscriptions récentes (30 derniers jours)
 *         trends:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               period:
 *                 type: string
 *                 format: date-time
 *               enrollments:
 *                 type: integer
 *               male_enrollments:
 *                 type: integer
 *               female_enrollments:
 *                 type: integer
 *               avg_age_at_enrollment:
 *                 type: number
 *         class_distribution:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               level_name:
 *                 type: string
 *               student_count:
 *                 type: integer
 *               occupancy_rate:
 *                 type: number
 *         age_distribution:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               age:
 *                 type: integer
 *               count:
 *                 type: integer
 *               male_count:
 *                 type: integer
 *               female_count:
 *                 type: integer
 * 
 *     FinancialAnalytics:
 *       type: object
 *       properties:
 *         revenue_stats:
 *           type: object
 *           properties:
 *             total_revenue:
 *               type: number
 *               description: Chiffre d'affaires total
 *             completed_revenue:
 *               type: number
 *               description: Revenus encaissés
 *             pending_revenue:
 *               type: number
 *               description: Revenus en attente
 *             overdue_revenue:
 *               type: number
 *               description: Revenus en retard
 *         financial_summary:
 *           type: object
 *           properties:
 *             total_revenue:
 *               type: number
 *             total_expenses:
 *               type: number
 *             net_profit:
 *               type: number
 *             profit_margin:
 *               type: number
 *         revenue_trends:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               period:
 *                 type: string
 *                 format: date-time
 *               revenue:
 *                 type: number
 *               payment_count:
 *                 type: integer
 *               avg_payment:
 *                 type: number
 * 
 *     OperationalAnalytics:
 *       type: object
 *       properties:
 *         parent_engagement:
 *           type: object
 *           properties:
 *             total_parents:
 *               type: integer
 *             email_preferred:
 *               type: integer
 *             sms_preferred:
 *               type: integer
 *             both_preferred:
 *               type: integer
 *         notification_stats:
 *           type: object
 *           properties:
 *             total_notifications:
 *               type: integer
 *             delivered_count:
 *               type: integer
 *             failed_count:
 *               type: integer
 *             delivery_rate:
 *               type: number
 *         care_services_utilization:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               service_name:
 *                 type: string
 *               current_enrollment:
 *                 type: integer
 *               utilization_rate:
 *                 type: number
 *               monthly_revenue:
 *                 type: number
 */

/**
 * @swagger
 * /api/analytics/enrollment:
 *   get:
 *     summary: Obtenir les analytiques d'inscription
 *     description: Récupère des statistiques détaillées sur les inscriptions des enfants
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academic_year_id
 *         schema:
 *           type: integer
 *         description: ID de l'année académique
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: monthly
 *         description: Période d'analyse
 *       - in: query
 *         name: class_level_id
 *         schema:
 *           type: integer
 *         description: ID du niveau de classe
 *     responses:
 *       200:
 *         description: Analytiques d'inscription récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytiques d'inscription récupérées avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/EnrollmentAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/enrollment',
  authenticate,
  requirePermission(ROLES.DIRECTOR),
  validateRequest({ query: analyticsQuerySchema }),
  getEnrollmentAnalytics
);

/**
 * @swagger
 * /api/analytics/financial:
 *   get:
 *     summary: Obtenir les analytiques financières
 *     description: Récupère des statistiques détaillées sur les revenus, dépenses et rentabilité
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academic_year_id
 *         schema:
 *           type: integer
 *         description: ID de l'année académique
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: monthly
 *         description: Période d'analyse
 *       - in: query
 *         name: include_projections
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Inclure les projections financières
 *     responses:
 *       200:
 *         description: Analytiques financières récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytiques financières récupérées avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/FinancialAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/financial',
  authenticate,
  requirePermission(ROLES.DIRECTOR),
  validateRequest({ query: analyticsQuerySchema }),
  getFinancialAnalytics
);

/**
 * @swagger
 * /api/analytics/operational:
 *   get:
 *     summary: Obtenir les analytiques opérationnelles
 *     description: Récupère des statistiques sur l'engagement des parents, notifications et services
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academic_year_id
 *         schema:
 *           type: integer
 *         description: ID de l'année académique
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin
 *     responses:
 *       200:
 *         description: Analytiques opérationnelles récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytiques opérationnelles récupérées avec succès"
 *                 data:
 *                   $ref: '#/components/schemas/OperationalAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/operational',
  authenticate,
  requirePermission(ROLES.DIRECTOR),
  validateRequest({ query: analyticsQuerySchema }),
  getOperationalAnalytics
);

/**
 * @swagger
 * /api/analytics/comprehensive-report:
 *   get:
 *     summary: Générer un rapport analytique complet
 *     description: Génère un rapport complet incluant toutes les analytiques avec recommandations
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academic_year_id
 *         schema:
 *           type: integer
 *         description: ID de l'année académique
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin
 *       - in: query
 *         name: format_type
 *         schema:
 *           type: string
 *           enum: [json, pdf, excel]
 *           default: json
 *         description: Format du rapport
 *     responses:
 *       200:
 *         description: Rapport complet généré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Rapport complet généré avec succès"
 *                 data:
 *                   type: object
 *                   properties:
 *                     report_info:
 *                       type: object
 *                       properties:
 *                         title:
 *                           type: string
 *                         generated_at:
 *                           type: string
 *                           format: date-time
 *                         generated_by:
 *                           type: string
 *                     executive_summary:
 *                       type: object
 *                       properties:
 *                         total_children:
 *                           type: integer
 *                         total_revenue:
 *                           type: number
 *                         net_profit:
 *                           type: number
 *                         profit_margin:
 *                           type: number
 *                     enrollment_analytics:
 *                       $ref: '#/components/schemas/EnrollmentAnalytics'
 *                     financial_analytics:
 *                       $ref: '#/components/schemas/FinancialAnalytics'
 *                     operational_analytics:
 *                       $ref: '#/components/schemas/OperationalAnalytics'
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                           priority:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           action:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/comprehensive-report',
  authenticate,
  requirePermission(ROLES.DIRECTOR),
  validateRequest({ query: reportQuerySchema }),
  generateComprehensiveReport
);

module.exports = router;
