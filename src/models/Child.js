/**
 * Child Data Model and Business Logic - École Nid Douillet
 * 
 * Core business logic for child management in French kindergarten system
 */

const pool = require('../config/database');
const { calculateAge, determineClassLevel, validateEnrollmentEligibility } = require('../utils/ageCalculation');
const { getCurrentAcademicYear } = require('../utils/academicYear');
const { format, parseISO, isValid } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Create a new child record
 * @param {Object} childData - Child information
 * @param {string} createdBy - ID of user creating the record
 * @returns {Object} Created child with calculated information
 */
async function createChild(childData, createdBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'birthDate', 'gender', 'academicYearId'];
    for (const field of requiredFields) {
      if (!childData[field]) {
        throw new Error(`Le champ ${field} est obligatoire`);
      }
    }

    // Validate birth date
    const birthDate = parseISO(childData.birthDate);
    if (!isValid(birthDate)) {
      throw new Error('Date de naissance invalide');
    }

    // Get academic year information
    const academicYearQuery = 'SELECT * FROM academic_years WHERE id = $1';
    const academicYearResult = await client.query(academicYearQuery, [childData.academicYearId]);
    
    if (academicYearResult.rows.length === 0) {
      throw new Error('Année académique non trouvée');
    }

    const academicYear = academicYearResult.rows[0];

    // Calculate age and class level
    const ageInfo = calculateAge(birthDate, new Date(academicYear.start_date));
    const classInfo = determineClassLevel(birthDate, new Date(academicYear.start_date));
    const eligibility = validateEnrollmentEligibility(birthDate, academicYear.name);

    if (!eligibility.eligible) {
      throw new Error(`Enfant non éligible: ${eligibility.reasons.join(', ')}`);
    }

    // Get class level ID
    const classLevelQuery = 'SELECT id FROM class_levels WHERE code = $1';
    const classLevelResult = await client.query(classLevelQuery, [classInfo.classCode]);
    
    if (classLevelResult.rows.length === 0) {
      throw new Error(`Niveau de classe ${classInfo.classCode} non trouvé`);
    }

    const classLevelId = classLevelResult.rows[0].id;

    // Create child record
    const insertQuery = `
      INSERT INTO children (
        first_name, last_name, birth_date, gender, class_level_id, academic_year_id,
        age_at_enrollment, enrollment_date, medical_info, allergies, emergency_contact,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      childData.firstName,
      childData.lastName,
      format(birthDate, 'yyyy-MM-dd'),
      childData.gender,
      classLevelId,
      childData.academicYearId,
      ageInfo.formatted,
      childData.enrollmentDate || format(new Date(academicYear.start_date), 'yyyy-MM-dd'),
      childData.medicalInfo || null,
      childData.allergies || null,
      childData.emergencyContact || null,
      childData.notes || null,
      createdBy
    ];

    const result = await client.query(insertQuery, values);
    const child = result.rows[0];

    await client.query('COMMIT');

    // Return child with calculated information
    return {
      success: true,
      child: {
        ...child,
        ageInfo,
        classInfo,
        eligibility,
        academicYear: academicYear.name
      },
      message: `Enfant ${childData.firstName} ${childData.lastName} créé avec succès`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la création de l'enfant: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get child by ID with full information
 * @param {string} childId - Child ID
 * @returns {Object} Child information with calculated data
 */
async function getChildById(childId) {
  try {
    const query = `
      SELECT 
        c.*,
        cl.name as class_level_name,
        cl.code as class_level_code,
        ay.name as academic_year_name,
        ay.start_date as academic_year_start,
        ay.end_date as academic_year_end
      FROM children c
      JOIN class_levels cl ON c.class_level_id = cl.id
      JOIN academic_years ay ON c.academic_year_id = ay.id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [childId]);
    
    if (result.rows.length === 0) {
      throw new Error('Enfant non trouvé');
    }

    const child = result.rows[0];

    // Calculate current age and class information
    const currentAge = calculateAge(child.birth_date);
    const currentClassInfo = determineClassLevel(child.birth_date);

    return {
      success: true,
      child: {
        ...child,
        currentAge,
        currentClassInfo,
        enrollmentAge: child.age_at_enrollment
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération de l'enfant: ${error.message}`);
  }
}

/**
 * Get all children with filtering and pagination
 * @param {Object} options - Query options
 * @returns {Object} Children list with pagination
 */
async function getAllChildren(options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      academicYearId,
      classLevelId,
      gender,
      search,
      sortBy = 'last_name',
      sortOrder = 'ASC'
    } = options;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (academicYearId) {
      whereClause += ` AND c.academic_year_id = $${paramIndex}`;
      values.push(academicYearId);
      paramIndex++;
    }

    if (classLevelId) {
      whereClause += ` AND c.class_level_id = $${paramIndex}`;
      values.push(classLevelId);
      paramIndex++;
    }

    if (gender) {
      whereClause += ` AND c.gender = $${paramIndex}`;
      values.push(gender);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Main query
    const query = `
      SELECT 
        c.*,
        cl.name as class_level_name,
        cl.code as class_level_code,
        ay.name as academic_year_name
      FROM children c
      JOIN class_levels cl ON c.class_level_id = cl.id
      JOIN academic_years ay ON c.academic_year_id = ay.id
      ${whereClause}
      ORDER BY c.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM children c
      JOIN class_levels cl ON c.class_level_id = cl.id
      JOIN academic_years ay ON c.academic_year_id = ay.id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    // Calculate current age for each child
    const children = result.rows.map(child => ({
      ...child,
      currentAge: calculateAge(child.birth_date).formatted
    }));

    return {
      success: true,
      children,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des enfants: ${error.message}`);
  }
}

/**
 * Update child information
 * @param {string} childId - Child ID
 * @param {Object} updates - Fields to update
 * @param {string} updatedBy - ID of user making the update
 * @returns {Object} Updated child information
 */
async function updateChild(childId, updates, updatedBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get current child data
    const currentChild = await getChildById(childId);
    if (!currentChild.success) {
      throw new Error('Enfant non trouvé');
    }

    const allowedFields = [
      'first_name', 'last_name', 'medical_info', 'allergies', 
      'emergency_contact', 'notes', 'class_level_id'
    ];

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

    // Add updated_by and child_id
    setClause.push(`updated_at = NOW()`);
    values.push(childId);

    const query = `
      UPDATE children 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Enfant non trouvé');
    }

    await client.query('COMMIT');

    // Return updated child with full information
    const updatedChild = await getChildById(childId);
    
    return {
      success: true,
      child: updatedChild.child,
      message: 'Informations de l\'enfant mises à jour avec succès'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la mise à jour de l'enfant: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Delete child record (soft delete)
 * @param {string} childId - Child ID
 * @param {string} deletedBy - ID of user deleting the record
 * @returns {Object} Deletion result
 */
async function deleteChild(childId, deletedBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if child exists
    const childCheck = await client.query('SELECT id, first_name, last_name FROM children WHERE id = $1', [childId]);
    
    if (childCheck.rows.length === 0) {
      throw new Error('Enfant non trouvé');
    }

    const child = childCheck.rows[0];

    // Soft delete - mark as deleted
    const query = `
      UPDATE children 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `;

    await client.query(query, [childId]);

    await client.query('COMMIT');

    return {
      success: true,
      message: `Enfant ${child.first_name} ${child.last_name} supprimé avec succès`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la suppression de l'enfant: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get children statistics for dashboard
 * @param {string} academicYearId - Academic year ID (optional)
 * @returns {Object} Children statistics
 */
async function getChildrenStatistics(academicYearId = null) {
  try {
    let whereClause = 'WHERE c.deleted_at IS NULL';
    const values = [];

    if (academicYearId) {
      whereClause += ' AND c.academic_year_id = $1';
      values.push(academicYearId);
    }

    const query = `
      SELECT 
        COUNT(*) as total_children,
        COUNT(CASE WHEN c.gender = 'M' THEN 1 END) as boys,
        COUNT(CASE WHEN c.gender = 'F' THEN 1 END) as girls,
        cl.name as class_level,
        cl.code as class_code,
        COUNT(c.id) as count_per_class
      FROM children c
      JOIN class_levels cl ON c.class_level_id = cl.id
      ${whereClause}
      GROUP BY cl.id, cl.name, cl.code
      ORDER BY cl.min_age
    `;

    const result = await pool.query(query, values);

    // Calculate totals
    const totalChildren = result.rows.reduce((sum, row) => sum + parseInt(row.count_per_class), 0);
    const totalBoys = result.rows.reduce((sum, row) => sum + parseInt(row.boys), 0);
    const totalGirls = result.rows.reduce((sum, row) => sum + parseInt(row.girls), 0);

    return {
      success: true,
      statistics: {
        total: totalChildren,
        boys: totalBoys,
        girls: totalGirls,
        byClass: result.rows.map(row => ({
          classLevel: row.class_level,
          classCode: row.class_code,
          count: parseInt(row.count_per_class),
          boys: parseInt(row.boys),
          girls: parseInt(row.girls)
        }))
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
  }
}

/**
 * Get children by parent ID
 * @param {string} parentId - Parent ID
 * @returns {Object} Children list for the parent
 */
async function getChildrenByParent(parentId) {
  try {
    const query = `
      SELECT 
        c.*,
        cl.name as class_level_name,
        cl.code as class_level_code,
        ay.name as academic_year_name
      FROM children c
      JOIN class_levels cl ON c.class_level_id = cl.id
      JOIN academic_years ay ON c.academic_year_id = ay.id
      JOIN parent_children pc ON c.id = pc.child_id
      WHERE pc.parent_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.last_name, c.first_name
    `;

    const result = await pool.query(query, [parentId]);

    const children = result.rows.map(child => ({
      ...child,
      currentAge: calculateAge(child.birth_date).formatted
    }));

    return {
      success: true,
      children
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des enfants du parent: ${error.message}`);
  }
}

module.exports = {
  createChild,
  getChildById,
  getAllChildren,
  updateChild,
  deleteChild,
  getChildrenStatistics,
  getChildrenByParent
};
