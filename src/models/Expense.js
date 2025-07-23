/**
 * Expense Model - École Nid Douillet
 * 
 * Expense management with categorization and financial tracking
 * Supports staff, supplies, utilities, maintenance, and other expenses
 */

const { query } = require('../config/database');
const { format, startOfMonth, endOfMonth } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Create a new expense record
 */
const createExpense = async (expenseData, createdBy) => {
  const client = await query.connect();
  
  try {
    await client.query('BEGIN');

    // Generate expense reference
    const expenseRef = `EXP-${format(new Date(), 'yyyyMM')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Insert expense record
    const expenseResult = await client.query(`
      INSERT INTO expenses (
        category, subcategory, description, amount, currency,
        expense_date, payment_method, vendor_name, receipt_number,
        expense_reference, is_recurring, recurring_frequency,
        academic_year_related, notes, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15
      ) RETURNING *
    `, [
      expenseData.category,
      expenseData.subcategory || null,
      expenseData.description,
      expenseData.amount,
      expenseData.currency || 'MAD',
      expenseData.expenseDate || new Date(),
      expenseData.paymentMethod || 'CASH',
      expenseData.vendorName || null,
      expenseData.receiptNumber || null,
      expenseRef,
      expenseData.isRecurring || false,
      expenseData.recurringFrequency || null,
      expenseData.academicYearRelated || true,
      expenseData.notes || '',
      createdBy
    ]);

    const expense = expenseResult.rows[0];

    // Log expense creation in audit trail
    await client.query(`
      INSERT INTO audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_by, change_reason
      ) VALUES (
        'expenses', $1, 'CREATE', '{}', $2, $3, 'Expense created'
      )
    `, [
      expense.id,
      JSON.stringify(expense),
      createdBy
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Dépense créée avec succès',
      data: expense
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la création de la dépense: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * Get expense by ID with full details
 */
const getExpenseById = async (expenseId) => {
  try {
    const result = await query(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `, [expenseId]);

    if (result.rows.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    const expense = result.rows[0];

    return {
      success: true,
      data: {
        ...expense,
        expense_date_formatted: format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: fr }),
        created_at_formatted: format(new Date(expense.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération de la dépense: ${error.message}`);
  }
};

/**
 * Get all expenses with filtering and pagination
 */
const getAllExpenses = async (filters = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category,
      subcategory,
      startDate,
      endDate,
      paymentMethod,
      isRecurring,
      search,
      sortBy = 'expense_date',
      sortOrder = 'DESC'
    } = filters;

    let whereConditions = ['e.deleted_at IS NULL'];
    let queryParams = [];
    let paramCount = 0;

    // Build WHERE conditions
    if (category) {
      paramCount++;
      whereConditions.push(`e.category = $${paramCount}`);
      queryParams.push(category);
    }

    if (subcategory) {
      paramCount++;
      whereConditions.push(`e.subcategory = $${paramCount}`);
      queryParams.push(subcategory);
    }

    if (startDate) {
      paramCount++;
      whereConditions.push(`e.expense_date >= $${paramCount}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereConditions.push(`e.expense_date <= $${paramCount}`);
      queryParams.push(endDate);
    }

    if (paymentMethod) {
      paramCount++;
      whereConditions.push(`e.payment_method = $${paramCount}`);
      queryParams.push(paymentMethod);
    }

    if (isRecurring !== undefined) {
      paramCount++;
      whereConditions.push(`e.is_recurring = $${paramCount}`);
      queryParams.push(isRecurring);
    }

    if (search) {
      paramCount++;
      whereConditions.push(`(
        e.description ILIKE $${paramCount} OR 
        e.vendor_name ILIKE $${paramCount} OR 
        e.expense_reference ILIKE $${paramCount} OR
        e.receipt_number ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['expense_date', 'created_at', 'amount', 'category'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'expense_date';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM expenses e
      WHERE ${whereConditions.join(' AND ')}
    `;

    const countResult = await query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get expenses with pagination
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const expensesQuery = `
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY e.${sortColumn} ${sortDirection}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const expensesResult = await query(expensesQuery, queryParams);

    const expenses = expensesResult.rows.map(expense => ({
      ...expense,
      expense_date_formatted: format(new Date(expense.expense_date), 'dd/MM/yyyy', { locale: fr }),
      created_at_formatted: format(new Date(expense.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    }));

    return {
      success: true,
      data: {
        expenses,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit)
        }
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération des dépenses: ${error.message}`);
  }
};

/**
 * Update expense information
 */
const updateExpense = async (expenseId, updates, updatedBy) => {
  const client = await query.connect();
  
  try {
    await client.query('BEGIN');

    // Get current expense data
    const currentResult = await client.query(
      'SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL',
      [expenseId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    const currentExpense = currentResult.rows[0];

    // Validate allowed fields for update
    const allowedFields = [
      'category', 'subcategory', 'description', 'amount', 'expense_date',
      'payment_method', 'vendor_name', 'receipt_number', 'is_recurring',
      'recurring_frequency', 'academic_year_related', 'notes'
    ];

    const updateFields = Object.keys(updates).filter(field => allowedFields.includes(field));
    
    if (updateFields.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }

    // Build update query
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const updateValues = updateFields.map(field => updates[field]);

    const updateQuery = `
      UPDATE expenses 
      SET ${setClause}, updated_by = $${updateFields.length + 2}, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, [expenseId, ...updateValues, updatedBy]);
    const updatedExpense = updateResult.rows[0];

    // Log expense update in audit trail
    await client.query(`
      INSERT INTO audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_by, change_reason
      ) VALUES (
        'expenses', $1, 'UPDATE', $2, $3, $4, 'Expense updated'
      )
    `, [
      expenseId,
      JSON.stringify(currentExpense),
      JSON.stringify(updatedExpense),
      updatedBy
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Dépense mise à jour avec succès',
      data: updatedExpense
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la mise à jour de la dépense: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * Delete expense (soft delete)
 */
const deleteExpense = async (expenseId, deletedBy) => {
  const client = await query.connect();
  
  try {
    await client.query('BEGIN');

    // Check if expense exists
    const expenseResult = await client.query(
      'SELECT id, description FROM expenses WHERE id = $1 AND deleted_at IS NULL',
      [expenseId]
    );

    if (expenseResult.rows.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    const expense = expenseResult.rows[0];

    // Soft delete the expense
    await client.query(`
      UPDATE expenses 
      SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
      WHERE id = $1
    `, [expenseId, deletedBy]);

    // Log expense deletion
    await client.query(`
      INSERT INTO audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_by, change_reason
      ) VALUES (
        'expenses', $1, 'DELETE', $2, '{}', $3, 'Expense deleted'
      )
    `, [
      expenseId,
      JSON.stringify(expense),
      deletedBy
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      message: `Dépense "${expense.description}" supprimée avec succès`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la suppression de la dépense: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * Get expense statistics
 */
const getExpenseStatistics = async (filters = {}) => {
  try {
    const {
      startDate = startOfMonth(new Date()),
      endDate = endOfMonth(new Date())
    } = filters;

    // Get comprehensive expense statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_expenses,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as average_amount,
        COUNT(CASE WHEN is_recurring = true THEN 1 END) as recurring_expenses,
        
        COALESCE(SUM(CASE WHEN category = 'STAFF' THEN amount END), 0) as staff_expenses,
        COALESCE(SUM(CASE WHEN category = 'SUPPLIES' THEN amount END), 0) as supplies_expenses,
        COALESCE(SUM(CASE WHEN category = 'UTILITIES' THEN amount END), 0) as utilities_expenses,
        COALESCE(SUM(CASE WHEN category = 'MAINTENANCE' THEN amount END), 0) as maintenance_expenses,
        COALESCE(SUM(CASE WHEN category = 'MARKETING' THEN amount END), 0) as marketing_expenses,
        COALESCE(SUM(CASE WHEN category = 'OTHER' THEN amount END), 0) as other_expenses
      FROM expenses
      WHERE expense_date >= $1 
        AND expense_date <= $2
        AND deleted_at IS NULL
    `, [startDate, endDate]);

    const stats = statsResult.rows[0];

    // Get category distribution
    const categoryDistributionResult = await query(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
      FROM expenses
      WHERE expense_date >= $1 
        AND expense_date <= $2
        AND deleted_at IS NULL
      GROUP BY category
      ORDER BY total_amount DESC
    `, [startDate, endDate]);

    const categoryDistribution = categoryDistributionResult.rows;

    // Get payment method distribution
    const paymentMethodResult = await query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM expenses
      WHERE expense_date >= $1 
        AND expense_date <= $2
        AND deleted_at IS NULL
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `, [startDate, endDate]);

    const paymentMethodDistribution = paymentMethodResult.rows;

    // Get monthly trends
    const monthlyTrendsResult = await query(`
      SELECT 
        DATE_TRUNC('month', expense_date) as month,
        COUNT(*) as expense_count,
        SUM(amount) as total_amount
      FROM expenses
      WHERE expense_date >= $1 
        AND expense_date <= $2
        AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('month', expense_date)
      ORDER BY month
    `, [startDate, endDate]);

    const monthlyTrends = monthlyTrendsResult.rows.map(row => ({
      month: format(new Date(row.month), 'MMM yyyy', { locale: fr }),
      expenseCount: parseInt(row.expense_count),
      totalAmount: parseFloat(row.total_amount)
    }));

    return {
      success: true,
      data: {
        period: {
          startDate: format(new Date(startDate), 'dd/MM/yyyy', { locale: fr }),
          endDate: format(new Date(endDate), 'dd/MM/yyyy', { locale: fr })
        },
        overview: {
          totalExpenses: parseInt(stats.total_expenses),
          totalAmount: parseFloat(stats.total_amount),
          averageAmount: parseFloat(stats.average_amount),
          recurringExpenses: parseInt(stats.recurring_expenses)
        },
        categoryBreakdown: {
          staff: parseFloat(stats.staff_expenses),
          supplies: parseFloat(stats.supplies_expenses),
          utilities: parseFloat(stats.utilities_expenses),
          maintenance: parseFloat(stats.maintenance_expenses),
          marketing: parseFloat(stats.marketing_expenses),
          other: parseFloat(stats.other_expenses)
        },
        categoryDistribution,
        paymentMethodDistribution,
        monthlyTrends
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération des statistiques de dépenses: ${error.message}`);
  }
};

module.exports = {
  createExpense,
  getExpenseById,
  getAllExpenses,
  updateExpense,
  deleteExpense,
  getExpenseStatistics
};
