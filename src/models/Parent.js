/**
 * Parent Data Model and Business Logic - École Nid Douillet
 * 
 * Core business logic for parent management in French kindergarten system
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { format, parseISO, isValid } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Create a new parent record
 * @param {Object} parentData - Parent information
 * @param {string} createdBy - ID of user creating the record
 * @returns {Object} Created parent information
 */
async function createParent(parentData, createdBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'email', 'phone'];
    for (const field of requiredFields) {
      if (!parentData[field]) {
        throw new Error(`Le champ ${field} est obligatoire`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentData.email)) {
      throw new Error('Format d\'email invalide');
    }

    // Validate Moroccan phone number
    const phoneRegex = /^(\+212|0)[5-7][0-9]{8}$/;
    if (!phoneRegex.test(parentData.phone)) {
      throw new Error('Format de numéro de téléphone marocain invalide');
    }

    // Check if email already exists
    const emailCheck = await client.query('SELECT id FROM parents WHERE email = $1', [parentData.email]);
    if (emailCheck.rows.length > 0) {
      throw new Error('Un parent avec cet email existe déjà');
    }

    // Check if phone already exists
    const phoneCheck = await client.query('SELECT id FROM parents WHERE phone = $1', [parentData.phone]);
    if (phoneCheck.rows.length > 0) {
      throw new Error('Un parent avec ce numéro de téléphone existe déjà');
    }

    // Hash password if provided
    let hashedPassword = null;
    if (parentData.password) {
      hashedPassword = await bcrypt.hash(parentData.password, 12);
    }

    // Create parent record
    const insertQuery = `
      INSERT INTO parents (
        first_name, last_name, email, phone, password_hash, address,
        emergency_contact, profession, workplace, relationship_to_child,
        preferred_language, communication_preferences, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, last_name, email, phone, address, emergency_contact,
                profession, workplace, relationship_to_child, preferred_language,
                communication_preferences, notes, created_at, updated_at
    `;

    const values = [
      parentData.firstName,
      parentData.lastName,
      parentData.email,
      parentData.phone,
      hashedPassword,
      parentData.address || null,
      parentData.emergencyContact || null,
      parentData.profession || null,
      parentData.workplace || null,
      parentData.relationshipToChild || 'PARENT',
      parentData.preferredLanguage || 'fr',
      parentData.communicationPreferences || 'EMAIL',
      parentData.notes || null,
      createdBy
    ];

    const result = await client.query(insertQuery, values);
    const parent = result.rows[0];

    await client.query('COMMIT');

    return {
      success: true,
      parent,
      message: `Parent ${parentData.firstName} ${parentData.lastName} créé avec succès`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la création du parent: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get parent by ID with children information
 * @param {string} parentId - Parent ID
 * @returns {Object} Parent information with children
 */
async function getParentById(parentId) {
  try {
    const query = `
      SELECT 
        p.id, p.first_name, p.last_name, p.email, p.phone, p.address,
        p.emergency_contact, p.profession, p.workplace, p.relationship_to_child,
        p.preferred_language, p.communication_preferences, p.notes,
        p.created_at, p.updated_at
      FROM parents p
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [parentId]);
    
    if (result.rows.length === 0) {
      throw new Error('Parent non trouvé');
    }

    const parent = result.rows[0];

    // Get children information
    const childrenQuery = `
      SELECT 
        c.id, c.first_name, c.last_name, c.birth_date,
        cl.name as class_level_name, cl.code as class_level_code,
        ay.name as academic_year_name
      FROM children c
      JOIN parent_children pc ON c.id = pc.child_id
      JOIN class_levels cl ON c.class_level_id = cl.id
      JOIN academic_years ay ON c.academic_year_id = ay.id
      WHERE pc.parent_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.last_name, c.first_name
    `;

    const childrenResult = await pool.query(childrenQuery, [parentId]);

    return {
      success: true,
      parent: {
        ...parent,
        children: childrenResult.rows
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération du parent: ${error.message}`);
  }
}

/**
 * Get all parents with filtering and pagination
 * @param {Object} options - Query options
 * @returns {Object} Parents list with pagination
 */
async function getAllParents(options = {}) {
  try {
    const {
      limit = 20,
      offset = 0,
      search,
      sortBy = 'last_name',
      sortOrder = 'ASC',
      includeChildren = false
    } = options;

    let whereClause = 'WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (search) {
      whereClause += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.email ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Main query
    const query = `
      SELECT 
        p.id, p.first_name, p.last_name, p.email, p.phone, p.address,
        p.profession, p.workplace, p.relationship_to_child,
        p.preferred_language, p.communication_preferences,
        p.created_at, p.updated_at
        ${includeChildren ? `, 
        COUNT(pc.child_id) as children_count,
        STRING_AGG(c.first_name || ' ' || c.last_name, ', ') as children_names
        ` : ''}
      FROM parents p
      ${includeChildren ? `
      LEFT JOIN parent_children pc ON p.id = pc.parent_id
      LEFT JOIN children c ON pc.child_id = c.id AND c.deleted_at IS NULL
      ` : ''}
      ${whereClause}
      ${includeChildren ? 'GROUP BY p.id' : ''}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM parents p
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);

    return {
      success: true,
      parents: result.rows,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des parents: ${error.message}`);
  }
}

/**
 * Update parent information
 * @param {string} parentId - Parent ID
 * @param {Object} updates - Fields to update
 * @param {string} updatedBy - ID of user making the update
 * @returns {Object} Updated parent information
 */
async function updateParent(parentId, updates, updatedBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if parent exists
    const parentCheck = await client.query('SELECT id FROM parents WHERE id = $1', [parentId]);
    if (parentCheck.rows.length === 0) {
      throw new Error('Parent non trouvé');
    }

    const allowedFields = [
      'first_name', 'last_name', 'phone', 'address', 'emergency_contact',
      'profession', 'workplace', 'relationship_to_child', 'preferred_language',
      'communication_preferences', 'notes'
    ];

    const setClause = [];
    const values = [];
    let paramIndex = 1;

    // Validate email if being updated
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        throw new Error('Format d\'email invalide');
      }

      // Check if email already exists for another parent
      const emailCheck = await client.query('SELECT id FROM parents WHERE email = $1 AND id != $2', [updates.email, parentId]);
      if (emailCheck.rows.length > 0) {
        throw new Error('Un autre parent avec cet email existe déjà');
      }

      allowedFields.push('email');
    }

    // Validate phone if being updated
    if (updates.phone) {
      const phoneRegex = /^(\+212|0)[5-7][0-9]{8}$/;
      if (!phoneRegex.test(updates.phone)) {
        throw new Error('Format de numéro de téléphone marocain invalide');
      }

      // Check if phone already exists for another parent
      const phoneCheck = await client.query('SELECT id FROM parents WHERE phone = $1 AND id != $2', [updates.phone, parentId]);
      if (phoneCheck.rows.length > 0) {
        throw new Error('Un autre parent avec ce numéro de téléphone existe déjà');
      }
    }

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

    // Add updated_at and parent_id
    setClause.push(`updated_at = NOW()`);
    values.push(parentId);

    const query = `
      UPDATE parents 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, first_name, last_name, email, phone, address, emergency_contact,
                profession, workplace, relationship_to_child, preferred_language,
                communication_preferences, notes, created_at, updated_at
    `;

    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Parent non trouvé');
    }

    await client.query('COMMIT');

    return {
      success: true,
      parent: result.rows[0],
      message: 'Informations du parent mises à jour avec succès'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la mise à jour du parent: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Link parent to child
 * @param {string} parentId - Parent ID
 * @param {string} childId - Child ID
 * @param {string} createdBy - ID of user creating the link
 * @returns {Object} Link result
 */
async function linkParentToChild(parentId, childId, createdBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if parent exists
    const parentCheck = await client.query('SELECT id, first_name, last_name FROM parents WHERE id = $1', [parentId]);
    if (parentCheck.rows.length === 0) {
      throw new Error('Parent non trouvé');
    }

    // Check if child exists
    const childCheck = await client.query('SELECT id, first_name, last_name FROM children WHERE id = $1', [childId]);
    if (childCheck.rows.length === 0) {
      throw new Error('Enfant non trouvé');
    }

    // Check if link already exists
    const linkCheck = await client.query('SELECT id FROM parent_children WHERE parent_id = $1 AND child_id = $2', [parentId, childId]);
    if (linkCheck.rows.length > 0) {
      throw new Error('Ce parent est déjà lié à cet enfant');
    }

    // Create link
    const insertQuery = `
      INSERT INTO parent_children (parent_id, child_id, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    await client.query(insertQuery, [parentId, childId, createdBy]);

    await client.query('COMMIT');

    const parent = parentCheck.rows[0];
    const child = childCheck.rows[0];

    return {
      success: true,
      message: `Parent ${parent.first_name} ${parent.last_name} lié à l'enfant ${child.first_name} ${child.last_name} avec succès`
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la liaison parent-enfant: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Unlink parent from child
 * @param {string} parentId - Parent ID
 * @param {string} childId - Child ID
 * @returns {Object} Unlink result
 */
async function unlinkParentFromChild(parentId, childId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if link exists
    const linkCheck = await client.query('SELECT id FROM parent_children WHERE parent_id = $1 AND child_id = $2', [parentId, childId]);
    if (linkCheck.rows.length === 0) {
      throw new Error('Aucune liaison trouvée entre ce parent et cet enfant');
    }

    // Remove link
    await client.query('DELETE FROM parent_children WHERE parent_id = $1 AND child_id = $2', [parentId, childId]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Liaison parent-enfant supprimée avec succès'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la suppression de la liaison: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Get parent statistics for dashboard
 * @returns {Object} Parent statistics
 */
async function getParentStatistics() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_parents,
        COUNT(CASE WHEN p.preferred_language = 'fr' THEN 1 END) as french_speakers,
        COUNT(CASE WHEN p.preferred_language = 'ar' THEN 1 END) as arabic_speakers,
        COUNT(CASE WHEN p.communication_preferences = 'EMAIL' THEN 1 END) as email_preferred,
        COUNT(CASE WHEN p.communication_preferences = 'SMS' THEN 1 END) as sms_preferred,
        COUNT(CASE WHEN p.communication_preferences = 'BOTH' THEN 1 END) as both_preferred
      FROM parents p
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    return {
      success: true,
      statistics: {
        total: parseInt(stats.total_parents),
        languages: {
          french: parseInt(stats.french_speakers),
          arabic: parseInt(stats.arabic_speakers)
        },
        communication: {
          email: parseInt(stats.email_preferred),
          sms: parseInt(stats.sms_preferred),
          both: parseInt(stats.both_preferred)
        }
      }
    };
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des statistiques des parents: ${error.message}`);
  }
}

/**
 * Update parent password
 * @param {string} parentId - Parent ID
 * @param {string} newPassword - New password
 * @returns {Object} Update result
 */
async function updateParentPassword(parentId, newPassword) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if parent exists
    const parentCheck = await client.query('SELECT id FROM parents WHERE id = $1', [parentId]);
    if (parentCheck.rows.length === 0) {
      throw new Error('Parent non trouvé');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await client.query('UPDATE parents SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, parentId]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la mise à jour du mot de passe: ${error.message}`);
  } finally {
    client.release();
  }
}

module.exports = {
  createParent,
  getParentById,
  getAllParents,
  updateParent,
  linkParentToChild,
  unlinkParentFromChild,
  getParentStatistics,
  updateParentPassword
};
