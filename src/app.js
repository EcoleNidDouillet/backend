// École Nid Douillet - Main Express Application
// Bilingual Kindergarten Management System API

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Import configurations
const { logger, healthCheck, gracefulShutdown } = require('./config/database');
const { SECURITY_HEADERS, RATE_LIMITS } = require('./config/auth');

// Import routes
const authRoutes = require('./routes/auth.routes');
const childrenRoutes = require('./routes/children.routes');
const parentsRoutes = require('./routes/parents.routes');
const directorRoutes = require('./routes/director.routes');
const paymentsRoutes = require('./routes/payments.routes');
const expensesRoutes = require('./routes/expenses.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const publicRoutes = require('./routes/public.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const parentPortalRoutes = require('./routes/parent.routes');
const healthRoutes = require('./routes/health.routes');
const cmsRoutes = require('./routes/cms.routes');

// Create Express app
const app = express();

// Trust proxy (for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS configuration for École Nid Douillet
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:51111',
      /^http:\/\/127\.0\.0\.1:\d+$/,
      'https://niddouillet.ma',
      'https://www.niddouillet.ma'
    ];
    
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined' 
  : 'dev';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Rate limiting
const generalLimiter = rateLimit(RATE_LIMITS.api);
app.use('/api/', generalLimiter);

// Public endpoints rate limiting (more permissive)
const publicLimiter = rateLimit(RATE_LIMITS.public);
app.use('/api/public/', publicLimiter);

// Swagger API Documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'École Nid Douillet API',
      version: '1.0.0',
      description: 'API pour le système de gestion de l\'École Maternelle Nid Douillet - Maternelle Bilingue Français-Arabe',
      contact: {
        name: 'École Nid Douillet',
        email: 'contact@niddouillet.ma',
        url: 'https://niddouillet.ma'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:3000',
        description: 'Serveur de développement'
      },
      {
        url: 'https://api.niddouillet.ma',
        description: 'Serveur de production'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Authentification et gestion des sessions'
      },
      {
        name: 'Director',
        description: 'Endpoints pour la direction de l\'école'
      },
      {
        name: 'Parent',
        description: 'Endpoints pour les parents'
      },
      {
        name: 'Public',
        description: 'Endpoints publics (site web)'
      },
      {
        name: 'Children',
        description: 'Gestion des enfants'
      },
      {
        name: 'Payments',
        description: 'Gestion des paiements'
      },
      {
        name: 'Analytics',
        description: 'Analyses et rapports'
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger documentation only in development
if (process.env.NODE_ENV !== 'production' || process.env.API_DOCS_ENABLED === 'true') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'École Nid Douillet API Documentation'
  }));
  
  // Serve swagger.json
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'École Nid Douillet API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth,
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/directors', directorRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/parent', parentPortalRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/public', publicRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'École Maternelle Nid Douillet API',
    description: 'Système de gestion pour maternelle bilingue français-arabe',
    location: 'Tilila, Agadir, Maroc',
    version: '1.0.0',
    documentation: process.env.NODE_ENV !== 'production' ? '/api/docs' : undefined,
    health: '/health'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint non trouvé',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // CORS error
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Accès CORS non autorisé',
      code: 'CORS_ERROR'
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      code: 'VALIDATION_ERROR',
      details: error.details
    });
  }

  // Database errors
  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      message: 'Conflit de données (doublon)',
      code: 'DUPLICATE_ERROR'
    });
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Référence de données invalide',
      code: 'REFERENCE_ERROR'
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide',
      code: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expiré',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Default error response
  const statusCode = error.statusCode || error.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erreur interne du serveur' 
    : error.message;

  res.status(statusCode).json({
    success: false,
    message,
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`École Nid Douillet API started`, {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
    documentation: process.env.NODE_ENV !== 'production' ? `http://${HOST}:${PORT}/api/docs` : undefined
  });
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await gracefulShutdown();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

module.exports = app;
