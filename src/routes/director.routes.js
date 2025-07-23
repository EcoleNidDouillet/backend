/**
 * Director Routes - École Nid Douillet
 * 
 * API endpoints for director dashboard and management functionality
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireDirector } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { getDashboardOverview, getFinancialAnalytics, getEnrollmentAnalytics } = require('../controllers/director.controller');
const Joi = require('joi');

// Validation schemas
const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  academicYearId: Joi.string().uuid().optional()
});

/**
 * @swagger
 * /api/director/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard overview
 *     tags: [Director]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                     academicYear:
 *                       type: object
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalChildren:
 *                           type: integer
 *                         totalParents:
 *                           type: integer
 *                         newEnrollmentsThisMonth:
 *                           type: integer
 *                         childrenInCare:
 *                           type: integer
 *                     financial:
 *                       type: object
 *                       properties:
 *                         monthlyRevenue:
 *                           type: number
 *                         monthlyExpenses:
 *                           type: number
 *                         monthlyProfit:
 *                           type: number
 *                         pendingPayments:
 *                           type: integer
 *                         overduePayments:
 *                           type: integer
 *                         revenueBreakdown:
 *                           type: object
 *                         expenseBreakdown:
 *                           type: object
 *                     enrollment:
 *                       type: object
 *                     classDistribution:
 *                       type: array
 *                     careServices:
 *                       type: object
 *                     recentActivities:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Director role required)
 *       500:
 *         description: Server error
 */
router.get('/dashboard',
  authenticate,
  requireDirector,
  getDashboardOverview
);

/**
 * @swagger
 * /api/director/analytics/financial:
 *   get:
 *     summary: Get financial analytics for specified period
 *     tags: [Director]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics period
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specific academic year ID
 *     responses:
 *       200:
 *         description: Financial analytics retrieved successfully
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
 *                     period:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                         endDate:
 *                           type: string
 *                     monthlyData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           revenue:
 *                             type: number
 *                           expenses:
 *                             type: number
 *                           profit:
 *                             type: number
 *                     paymentStatusDistribution:
 *                       type: array
 *                     revenueByType:
 *                       type: array
 *                     expenseCategories:
 *                       type: array
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                         totalExpenses:
 *                           type: number
 *                         totalProfit:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Director role required)
 *       404:
 *         description: Academic year not found
 *       500:
 *         description: Server error
 */
router.get('/analytics/financial',
  authenticate,
  requireDirector,
  validateRequest(analyticsQuerySchema, 'query'),
  getFinancialAnalytics
);

/**
 * @swagger
 * /api/director/analytics/enrollment:
 *   get:
 *     summary: Get enrollment analytics
 *     tags: [Director]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYearId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Specific academic year ID
 *     responses:
 *       200:
 *         description: Enrollment analytics retrieved successfully
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
 *                     academicYear:
 *                       type: object
 *                     enrollmentTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           newEnrollments:
 *                             type: integer
 *                     ageDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           age:
 *                             type: integer
 *                           count:
 *                             type: integer
 *                     classStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           level_name:
 *                             type: string
 *                           level_name_arabic:
 *                             type: string
 *                           max_capacity:
 *                             type: integer
 *                           current_enrollment:
 *                             type: integer
 *                           occupancy_rate:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalEnrolled:
 *                           type: integer
 *                         totalCapacity:
 *                           type: integer
 *                         averageOccupancy:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Director role required)
 *       404:
 *         description: Academic year not found
 *       500:
 *         description: Server error
 */
router.get('/analytics/enrollment',
  authenticate,
  requireDirector,
  validateRequest(analyticsQuerySchema, 'query'),
  getEnrollmentAnalytics
);

module.exports = router;
