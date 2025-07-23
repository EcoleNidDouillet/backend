// École Nid Douillet - Database Configuration
// PostgreSQL connection and query utilities

const { Pool } = require('pg');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ecole_nid_douillet',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait when connecting
  timezone: 'Africa/Casablanca' // Morocco timezone
};

// Create connection pool
const pool = new Pool(dbConfig);

// Pool event handlers
pool.on('connect', (client) => {
  logger.info('New database client connected');
  // Set timezone for this connection
  client.query('SET timezone = "Africa/Casablanca"');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Database query wrapper with logging and error handling
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Transaction wrapper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Health check function
const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// École Nid Douillet specific database utilities
const ecoleQueries = {
  // Get current academic year
  getCurrentAcademicYear: async () => {
    const result = await query(
      'SELECT * FROM academic_years WHERE is_active = true LIMIT 1'
    );
    return result.rows[0];
  },

  // Get class levels
  getClassLevels: async () => {
    const result = await query(
      'SELECT * FROM class_levels ORDER BY min_age_months ASC'
    );
    return result.rows;
  },

  // Calculate age on cutoff date
  calculateAgeOnCutoffDate: async (birthDate, academicYearId) => {
    const result = await query(
      'SELECT * FROM calculate_age_on_cutoff_date($1, $2)',
      [birthDate, academicYearId]
    );
    return result.rows[0];
  },

  // Determine class level by age
  determineClassLevelByAge: async (birthDate, academicYearId) => {
    const result = await query(
      'SELECT * FROM determine_class_level_by_age($1, $2)',
      [birthDate, academicYearId]
    );
    return result.rows[0];
  },

  // Map payment to academic month
  mapPaymentToAcademicMonth: async (paymentDate) => {
    const result = await query(
      'SELECT map_payment_to_academic_month($1) as academic_month',
      [paymentDate]
    );
    return result.rows[0].academic_month;
  },

  // Get care services utilization
  getCareServicesUtilization: async (academicYearId) => {
    const result = await query(
      'SELECT * FROM calculate_care_services_utilization($1)',
      [academicYearId]
    );
    return result.rows;
  },

  // Get enrollment stats by class
  getEnrollmentStatsByClass: async (academicYearId) => {
    const result = await query(
      'SELECT * FROM get_enrollment_stats_by_class($1)',
      [academicYearId]
    );
    return result.rows;
  },

  // Get monthly profit calculation
  getMonthlyProfit: async (academicYearId, month, year) => {
    const result = await query(
      'SELECT * FROM calculate_monthly_profit($1, $2, $3)',
      [academicYearId, month, year]
    );
    return result.rows[0];
  },

  // Get payment collection stats
  getPaymentCollectionStats: async (academicYearId) => {
    const result = await query(
      'SELECT * FROM get_payment_collection_stats($1)',
      [academicYearId]
    );
    return result.rows[0];
  },

  // Refresh dashboard stats
  refreshDashboardStats: async () => {
    await query('SELECT refresh_dashboard_stats()');
  },

  // Get dashboard stats
  getDashboardStats: async (academicYearId) => {
    const result = await query(
      'SELECT * FROM mv_dashboard_stats WHERE academic_year_id = $1',
      [academicYearId]
    );
    return result.rows[0];
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Closing database connections...');
  await pool.end();
  logger.info('Database connections closed.');
};

// Handle process termination
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  pool,
  query,
  transaction,
  healthCheck,
  ecoleQueries,
  gracefulShutdown,
  logger
};
