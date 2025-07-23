/**
 * Academic Year Management System for École Nid Douillet
 * 
 * French kindergarten system with Moroccan context
 * - Academic year: September 1 to June 30
 * - Enrollment periods and transitions
 * - Class level progressions
 */

const { format, addYears, startOfDay, endOfDay, isWithinInterval, parseISO, isValid } = require('date-fns');
const { fr } = require('date-fns/locale');
const pool = require('../config/database');

/**
 * Create a new academic year
 * @param {string} startYear - Starting year (e.g., "2024" for 2024-2025)
 * @param {Object} options - Additional options
 * @returns {Object} Created academic year information
 */
async function createAcademicYear(startYear, options = {}) {
  try {
    const year = parseInt(startYear);
    if (isNaN(year) || year < 2020 || year > 2050) {
      throw new Error('Invalid start year provided');
    }

    const name = `${year}-${year + 1}`;
    const startDate = new Date(year, 8, 1); // September 1
    const endDate = new Date(year + 1, 5, 30); // June 30
    
    // Default enrollment dates
    const enrollmentOpenDate = options.enrollmentOpenDate || new Date(year, 2, 1); // March 1
    const enrollmentCloseDate = options.enrollmentCloseDate || new Date(year, 6, 31); // July 31

    const query = `
      INSERT INTO academic_years (name, start_date, end_date, enrollment_open_date, enrollment_close_date, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      name,
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd'),
      format(enrollmentOpenDate, 'yyyy-MM-dd'),
      format(enrollmentCloseDate, 'yyyy-MM-dd'),
      options.isActive || false
    ];

    const result = await pool.query(query, values);
    
    return {
      success: true,
      academicYear: result.rows[0],
      message: `Année académique ${name} créée avec succès`
    };
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error(`L'année académique ${startYear}-${parseInt(startYear) + 1} existe déjà`);
    }
    throw new Error(`Erreur lors de la création de l'année académique: ${error.message}`);
  }
}

/**
 * Get current active academic year
 * @returns {Object} Current academic year information
 */
async function getCurrentAcademicYear() {
  try {
    const query = `
      SELECT * FROM academic_years 
      WHERE is_active = true 
      ORDER BY start_date DESC 
      LIMIT 1
    `;

    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      throw new Error('Aucune année académique active trouvée');
    }

    const academicYear = result.rows[0];
    
    return {
      success: true,
      academicYear,
      isEnrollmentOpen: isEnrollmentPeriodOpen(academicYear),
      daysUntilStart: getDaysUntilStart(academicYear),
      daysUntilEnd: getDaysUntilEnd(academicYear)
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération de l'année académique: ${error.message}`);
  }
}

/**
 * Set an academic year as active (deactivates others)
 * @param {string} academicYearId - Academic year ID
 * @returns {Object} Update result
 */
async function setActiveAcademicYear(academicYearId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Deactivate all academic years
    await client.query('UPDATE academic_years SET is_active = false');

    // Activate the specified academic year
    const query = `
      UPDATE academic_years 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(query, [academicYearId]);
    
    if (result.rows.length === 0) {
      throw new Error('Année académique non trouvée');
    }

    await client.query('COMMIT');
    
    return {
      success: true,
      academicYear: result.rows[0],
      message: `Année académique ${result.rows[0].name} activée avec succès`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de l'activation de l'année académique: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get all academic years with statistics
 * @param {Object} options - Query options
 * @returns {Object} Academic years list with statistics
 */
async function getAllAcademicYears(options = {}) {
  try {
    const { limit = 10, offset = 0, includeStats = true } = options;

    let query = `
      SELECT 
        ay.*,
        ${includeStats ? `
        (SELECT COUNT(*) FROM children WHERE academic_year_id = ay.id) as total_children,
        (SELECT COUNT(*) FROM enhanced_payments WHERE academic_year_id = ay.id) as total_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM enhanced_payments WHERE academic_year_id = ay.id AND status = 'PAID') as total_revenue
        ` : ''}
      FROM academic_years ay
      ORDER BY start_date DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM academic_years');
    const totalCount = parseInt(countResult.rows[0].count);

    const academicYears = result.rows.map(year => ({
      ...year,
      isEnrollmentOpen: isEnrollmentPeriodOpen(year),
      status: getAcademicYearStatus(year),
      daysUntilStart: getDaysUntilStart(year),
      daysUntilEnd: getDaysUntilEnd(year)
    }));

    return {
      success: true,
      academicYears,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des années académiques: ${error.message}`);
  }
}

/**
 * Update academic year information
 * @param {string} academicYearId - Academic year ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Update result
 */
async function updateAcademicYear(academicYearId, updates) {
  try {
    const allowedFields = ['enrollment_open_date', 'enrollment_close_date'];
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }

    values.push(academicYearId);

    const query = `
      UPDATE academic_years 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Année académique non trouvée');
    }

    return {
      success: true,
      academicYear: result.rows[0],
      message: 'Année académique mise à jour avec succès'
    };
  } catch (error) {
    throw new Error(`Erreur lors de la mise à jour de l'année académique: ${error.message}`);
  }
}

/**
 * Check if enrollment period is open for an academic year
 * @param {Object} academicYear - Academic year object
 * @returns {boolean} True if enrollment is open
 */
function isEnrollmentPeriodOpen(academicYear) {
  if (!academicYear.enrollment_open_date || !academicYear.enrollment_close_date) {
    return false;
  }

  const now = new Date();
  const openDate = new Date(academicYear.enrollment_open_date);
  const closeDate = new Date(academicYear.enrollment_close_date);

  return isWithinInterval(now, { start: openDate, end: closeDate });
}

/**
 * Get academic year status
 * @param {Object} academicYear - Academic year object
 * @returns {string} Status (upcoming, current, past, enrollment_open)
 */
function getAcademicYearStatus(academicYear) {
  const now = new Date();
  const startDate = new Date(academicYear.start_date);
  const endDate = new Date(academicYear.end_date);

  if (now < startDate) {
    return isEnrollmentPeriodOpen(academicYear) ? 'enrollment_open' : 'upcoming';
  } else if (now > endDate) {
    return 'past';
  } else {
    return 'current';
  }
}

/**
 * Get days until academic year starts
 * @param {Object} academicYear - Academic year object
 * @returns {number} Days until start (negative if already started)
 */
function getDaysUntilStart(academicYear) {
  const now = new Date();
  const startDate = new Date(academicYear.start_date);
  return Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
}

/**
 * Get days until academic year ends
 * @param {Object} academicYear - Academic year object
 * @returns {number} Days until end (negative if already ended)
 */
function getDaysUntilEnd(academicYear) {
  const now = new Date();
  const endDate = new Date(academicYear.end_date);
  return Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
}

/**
 * Generate academic years for a range
 * @param {number} startYear - Starting year
 * @param {number} count - Number of years to generate
 * @returns {Array} Generated academic years
 */
async function generateAcademicYears(startYear, count = 5) {
  const results = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const year = startYear + i;
      const result = await createAcademicYear(year.toString());
      results.push(result);
    } catch (error) {
      // Skip if already exists
      if (error.message.includes('existe déjà')) {
        continue;
      }
      throw error;
    }
  }

  return {
    success: true,
    generated: results.length,
    academicYears: results,
    message: `${results.length} années académiques générées avec succès`
  };
}

/**
 * Get academic year by name
 * @param {string} name - Academic year name (e.g., "2024-2025")
 * @returns {Object} Academic year information
 */
async function getAcademicYearByName(name) {
  try {
    const query = `
      SELECT * FROM academic_years 
      WHERE name = $1
    `;

    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      throw new Error(`Année académique ${name} non trouvée`);
    }

    const academicYear = result.rows[0];
    
    return {
      success: true,
      academicYear: {
        ...academicYear,
        isEnrollmentOpen: isEnrollmentPeriodOpen(academicYear),
        status: getAcademicYearStatus(academicYear),
        daysUntilStart: getDaysUntilStart(academicYear),
        daysUntilEnd: getDaysUntilEnd(academicYear)
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération de l'année académique: ${error.message}`);
  }
}

/**
 * Transition to next academic year
 * @param {string} currentYearId - Current academic year ID
 * @returns {Object} Transition result
 */
async function transitionToNextAcademicYear(currentYearId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get current academic year
    const currentResult = await client.query(
      'SELECT * FROM academic_years WHERE id = $1',
      [currentYearId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Année académique actuelle non trouvée');
    }

    const currentYear = currentResult.rows[0];
    const [startYear] = currentYear.name.split('-').map(Number);
    const nextYearName = `${startYear + 1}-${startYear + 2}`;

    // Check if next year exists
    const nextResult = await client.query(
      'SELECT * FROM academic_years WHERE name = $1',
      [nextYearName]
    );

    let nextYear;
    if (nextResult.rows.length === 0) {
      // Create next academic year
      const createResult = await createAcademicYear((startYear + 1).toString());
      nextYear = createResult.academicYear;
    } else {
      nextYear = nextResult.rows[0];
    }

    // Deactivate current year and activate next year
    await client.query('UPDATE academic_years SET is_active = false WHERE id = $1', [currentYearId]);
    await client.query('UPDATE academic_years SET is_active = true WHERE id = $1', [nextYear.id]);

    // TODO: Handle class level progressions for children
    // This would involve updating children's class levels based on age

    await client.query('COMMIT');

    return {
      success: true,
      previousYear: currentYear,
      currentYear: nextYear,
      message: `Transition vers l'année académique ${nextYearName} effectuée avec succès`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la transition d'année académique: ${error.message}`);
  } finally {
    client.release();
  }
}

module.exports = {
  createAcademicYear,
  getCurrentAcademicYear,
  setActiveAcademicYear,
  getAllAcademicYears,
  updateAcademicYear,
  isEnrollmentPeriodOpen,
  getAcademicYearStatus,
  getDaysUntilStart,
  getDaysUntilEnd,
  generateAcademicYears,
  getAcademicYearByName,
  transitionToNextAcademicYear
};
