/**
 * École Nid Douillet - Health Check Routes
 * 
 * System health and status endpoints
 */

const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Vérification de l'état du système
 *     description: Vérifie l'état de l'API et de la base de données
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Système en bonne santé
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
 *                   example: "Système opérationnel"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     database:
 *                       type: string
 *                       example: "connected"
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *       500:
 *         description: Erreur système
 */
router.get('/', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await query('SELECT NOW() as current_time');
    const dbStatus = dbResult.rows.length > 0 ? 'connected' : 'disconnected';
    
    res.json({
      success: true,
      message: 'Système opérationnel',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur système',
      code: 'SYSTEM_ERROR',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/health/database:
 *   get:
 *     summary: Vérification de la base de données
 *     description: Vérifie spécifiquement la connexion à la base de données
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Base de données accessible
 *       500:
 *         description: Erreur de base de données
 */
router.get('/database', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as version,
        NOW() as current_time
    `);
    
    res.json({
      success: true,
      message: 'Base de données accessible',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de base de données',
      code: 'DATABASE_ERROR',
      error: error.message
    });
  }
});

module.exports = router;
