// École Nid Douillet - Public Routes
// Routes for public website functionality

const express = require('express');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Public
 *   description: Public website endpoints
 */

/**
 * @swagger
 * /api/public/health:
 *   get:
 *     summary: Check public API health
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'École Nid Douillet Public API',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/public/info:
 *   get:
 *     summary: Get basic school information
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: School information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 address:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 */
router.get('/info', (req, res) => {
  res.json({
    name: 'École Nid Douillet',
    address: 'Tilila, Agadir, Maroc',
    phone: '+212 668 78 63 68',
    email: 'contact@ecoleniddouillet.com',
    description: 'École maternelle bilingue français-arabe',
    languages: ['français', 'arabe'],
    ageRange: '2-5 ans'
  });
});

module.exports = router;
