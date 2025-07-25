// École Nid Douillet - Database Configuration
// MySQL connection and query utilities

const mysql = require('mysql2/promise');
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

// Database configuration for MySQL with comprehensive SSL handling
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'ecole_nid_douillet',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  // Comprehensive SSL configuration for Hostinger
  ssl: {
    rejectUnauthorized: false
  },
  insecureAuth: true, // Allow insecure authentication
  connectionLimit: 10, // Maximum number of connections in the pool
  acquireTimeout: 60000, // Maximum time to wait for a connection
  timeout: 60000, // Maximum time for a query
  reconnect: true, // Automatically reconnect
  timezone: '+01:00', // Morocco timezone (UTC+1)
  charset: 'utf8mb4',
  // Additional connection flags
  flags: ['-FOUND_ROWS'],
  // Enable multiple statements if needed
  multipleStatements: false
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Pool event handlers for MySQL
pool.on('connection', (connection) => {
  logger.info('New MySQL connection established');
  // Set timezone for this connection
  connection.query('SET time_zone = "+01:00"');
});

pool.on('error', (err) => {
  logger.error('MySQL pool error', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    logger.info('MySQL connection lost, will reconnect automatically');
  } else {
    logger.error('Unexpected MySQL error', err);
  }
});

// Database query wrapper with logging and error handling
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const [rows, fields] = await pool.execute(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Executed query', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        rows: rows.length
      });
    }
    
    // Return PostgreSQL-like result object for compatibility
    return {
      rows: rows,
      rowCount: rows.length,
      fields: fields
    };
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

// Transaction wrapper for MySQL
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Health check function for MySQL
const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, VERSION() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version,
      database: 'connected'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    };
  }
};

// École Nid Douillet specific database utilities
const ecoleQueries = {
  // Get current academic year
  getCurrentAcademicYear: async () => {
    const result = await query(
      'SELECT * FROM academic_years WHERE is_active = 1 LIMIT 1'
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

  // Calculate age on cutoff date (MySQL version)
  calculateAgeOnCutoffDate: async (birthDate, academicYearId) => {
    const result = await query(
      'SELECT TIMESTAMPDIFF(YEAR, ?, CONCAT(YEAR(CURDATE())+1, "-01-01") - INTERVAL 1 DAY) as age_years, TIMESTAMPDIFF(MONTH, ?, CONCAT(YEAR(CURDATE())+1, "-01-01") - INTERVAL 1 DAY) as age_months',
      [birthDate, birthDate]
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
