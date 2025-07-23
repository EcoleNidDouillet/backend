/**
 * Payment Model - École Nid Douillet
 * 
 * Enhanced payment management with French kindergarten business logic
 * Supports tuition, care services, and other payment types
 */

const { query } = require('../config/database');
const { getCurrentAcademicYear } = require('../utils/academicYear');
const { format, addDays, isBefore, isAfter } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Create a new payment record
 */
const createPayment = async (paymentData, createdBy) => {
  const client = await query.connect();
  
  try {
    await client.query('BEGIN');

    // Validate child exists and is active
    const childResult = await client.query(
      'SELECT id, first_name, last_name, academic_year_id FROM children WHERE id = $1 AND deleted_at IS NULL',
      [paymentData.childId]
    );

    if (childResult.rows.length === 0) {
      throw new Error('Enfant non trouvé ou inactif');
    }

    const child = childResult.rows[0];

    // Validate academic year if provided, otherwise use child's academic year
    const academicYearId = paymentData.academicYearId || child.academic_year_id;
    
    const academicYearResult = await client.query(
      'SELECT id, year_label FROM academic_years WHERE id = $1',
      [academicYearId]
    );

    if (academicYearResult.rows.length === 0) {
      throw new Error('Année académique non trouvée');
    }

    // Calculate due date if not provided
    let dueDate = paymentData.dueDate;
    if (!dueDate) {
      // Default: 30 days from creation for tuition, 7 days for care services
      const daysToAdd = paymentData.paymentType === 'CARE_SERVICES' ? 7 : 30;
      dueDate = addDays(new Date(), daysToAdd);
    }

    // Determine payment status based on due date
    let paymentStatus = paymentData.paymentStatus || 'PENDING';
    if (paymentStatus === 'PENDING' && isBefore(new Date(dueDate), new Date())) {
      paymentStatus = 'OVERDUE';
    }

    // Generate payment reference
    const paymentRef = `PAY-${format(new Date(), 'yyyyMM')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Insert payment record
    const paymentResult = await client.query(`
      INSERT INTO enhanced_payments (
        child_id, academic_year_id, payment_type, amount, currency,
        payment_method, payment_status, payment_date, due_date,
        payment_reference, description, fee_breakdown,
        care_services_breakdown, discount_applied, discount_reason,
        late_fee_applied, notes, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18
      ) RETURNING *
    `, [
      paymentData.childId,
      academicYearId,
      paymentData.paymentType || 'TUITION',
      paymentData.amount,
      paymentData.currency || 'MAD',
      paymentData.paymentMethod || 'CASH',
      paymentStatus,
      paymentData.paymentDate || null,
      dueDate,
      paymentRef,
      paymentData.description || '',
      paymentData.feeBreakdown ? JSON.stringify(paymentData.feeBreakdown) : null,
      paymentData.careServicesBreakdown ? JSON.stringify(paymentData.careServicesBreakdown) : null,
      paymentData.discountApplied || 0,
      paymentData.discountReason || null,
      paymentData.lateFeeApplied || 0,
      paymentData.notes || '',
      createdBy
    ]);

    const payment = paymentResult.rows[0];

    // Log payment creation in audit trail
    await client.query(`
      INSERT INTO audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_by, change_reason
      ) VALUES (
        'enhanced_payments', $1, 'CREATE', '{}', $2, $3, 'Payment created'
      )
    `, [
      payment.id,
      JSON.stringify(payment),
      createdBy
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Paiement créé avec succès',
      data: {
        ...payment,
        child_name: `${child.first_name} ${child.last_name}`,
        fee_breakdown: payment.fee_breakdown ? JSON.parse(payment.fee_breakdown) : null,
        care_services_breakdown: payment.care_services_breakdown ? JSON.parse(payment.care_services_breakdown) : null
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la création du paiement: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * Get payment by ID with full details
 */
const getPaymentById = async (paymentId) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        c.first_name || ' ' || c.last_name as child_name,
        c.birth_date as child_birth_date,
        ay.year_label as academic_year_label,
        cl.level_name as class_level_name,
        par.first_name || ' ' || par.last_name as parent_name,
        par.email as parent_email,
        par.phone as parent_phone
      FROM enhanced_payments p
      JOIN children c ON p.child_id = c.id
      JOIN academic_years ay ON p.academic_year_id = ay.id
      LEFT JOIN class_levels cl ON c.class_level_id = cl.id
      LEFT JOIN parent_child_relations pcr ON c.id = pcr.child_id AND pcr.is_primary = true
      LEFT JOIN parents par ON pcr.parent_id = par.id
      WHERE p.id = $1 AND p.deleted_at IS NULL
    `, [paymentId]);

    if (result.rows.length === 0) {
      throw new Error('Paiement non trouvé');
    }

    const payment = result.rows[0];

    return {
      success: true,
      data: {
        ...payment,
        fee_breakdown: payment.fee_breakdown ? JSON.parse(payment.fee_breakdown) : null,
        care_services_breakdown: payment.care_services_breakdown ? JSON.parse(payment.care_services_breakdown) : null,
        payment_date_formatted: payment.payment_date ? format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: fr }) : null,
        due_date_formatted: format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: fr }),
        created_at_formatted: format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération du paiement: ${error.message}`);
  }
};

/**
 * Get all payments with filtering and pagination
 */
const getAllPayments = async (filters = {}) => {
  try {
    const {
      limit = 20,
      offset = 0,
      academicYearId,
      childId,
      paymentType,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = filters;

    let whereConditions = ['p.deleted_at IS NULL'];
    let queryParams = [];
    let paramCount = 0;

    // Build WHERE conditions
    if (academicYearId) {
      paramCount++;
      whereConditions.push(`p.academic_year_id = $${paramCount}`);
      queryParams.push(academicYearId);
    }

    if (childId) {
      paramCount++;
      whereConditions.push(`p.child_id = $${paramCount}`);
      queryParams.push(childId);
    }

    if (paymentType) {
      paramCount++;
      whereConditions.push(`p.payment_type = $${paramCount}`);
      queryParams.push(paymentType);
    }

    if (paymentStatus) {
      paramCount++;
      whereConditions.push(`p.payment_status = $${paramCount}`);
      queryParams.push(paymentStatus);
    }

    if (paymentMethod) {
      paramCount++;
      whereConditions.push(`p.payment_method = $${paramCount}`);
      queryParams.push(paymentMethod);
    }

    if (startDate) {
      paramCount++;
      whereConditions.push(`p.created_at >= $${paramCount}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereConditions.push(`p.created_at <= $${paramCount}`);
      queryParams.push(endDate);
    }

    if (search) {
      paramCount++;
      whereConditions.push(`(
        c.first_name ILIKE $${paramCount} OR 
        c.last_name ILIKE $${paramCount} OR 
        p.payment_reference ILIKE $${paramCount} OR
        p.description ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['created_at', 'payment_date', 'due_date', 'amount', 'payment_status'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM enhanced_payments p
      JOIN children c ON p.child_id = c.id
      WHERE ${whereConditions.join(' AND ')}
    `;

    const countResult = await query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get payments with pagination
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const paymentsQuery = `
      SELECT 
        p.*,
        c.first_name || ' ' || c.last_name as child_name,
        ay.year_label as academic_year_label,
        cl.level_name as class_level_name
      FROM enhanced_payments p
      JOIN children c ON p.child_id = c.id
      JOIN academic_years ay ON p.academic_year_id = ay.id
      LEFT JOIN class_levels cl ON c.class_level_id = cl.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.${sortColumn} ${sortDirection}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const paymentsResult = await query(paymentsQuery, queryParams);

    const payments = paymentsResult.rows.map(payment => ({
      ...payment,
      fee_breakdown: payment.fee_breakdown ? JSON.parse(payment.fee_breakdown) : null,
      care_services_breakdown: payment.care_services_breakdown ? JSON.parse(payment.care_services_breakdown) : null,
      payment_date_formatted: payment.payment_date ? format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: fr }) : null,
      due_date_formatted: format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: fr }),
      created_at_formatted: format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    }));

    return {
      success: true,
      data: {
        payments,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit)
        }
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération des paiements: ${error.message}`);
  }
};

/**
 * Update payment information
 */
const updatePayment = async (paymentId, updates, updatedBy) => {
  const client = await query.connect();
  
  try {
    await client.query('BEGIN');

    // Get current payment data
    const currentResult = await client.query(
      'SELECT * FROM enhanced_payments WHERE id = $1 AND deleted_at IS NULL',
      [paymentId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Paiement non trouvé');
    }

    const currentPayment = currentResult.rows[0];

    // Validate allowed fields for update
    const allowedFields = [
      'payment_status', 'payment_date', 'payment_method', 'amount',
      'description', 'fee_breakdown', 'care_services_breakdown',
      'discount_applied', 'discount_reason', 'late_fee_applied', 'notes'
    ];

    const updateFields = Object.keys(updates).filter(field => allowedFields.includes(field));
    
    if (updateFields.length === 0) {
      throw new Error('Aucun champ valide à mettre à jour');
    }

    // Build update query
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const updateValues = updateFields.map(field => {
      if (field === 'fee_breakdown' || field === 'care_services_breakdown') {
        return updates[field] ? JSON.stringify(updates[field]) : null;
      }
      return updates[field];
    });

    const updateQuery = `
      UPDATE enhanced_payments 
      SET ${setClause}, updated_by = $${updateFields.length + 2}, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, [paymentId, ...updateValues, updatedBy]);
    const updatedPayment = updateResult.rows[0];

    // Log payment update in audit trail
    await client.query(`
      INSERT INTO audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_by, change_reason
      ) VALUES (
        'enhanced_payments', $1, 'UPDATE', $2, $3, $4, 'Payment updated'
      )
    `, [
      paymentId,
      JSON.stringify(currentPayment),
      JSON.stringify(updatedPayment),
      updatedBy
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Paiement mis à jour avec succès',
      data: {
        ...updatedPayment,
        fee_breakdown: updatedPayment.fee_breakdown ? JSON.parse(updatedPayment.fee_breakdown) : null,
        care_services_breakdown: updatedPayment.care_services_breakdown ? JSON.parse(updatedPayment.care_services_breakdown) : null
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors de la mise à jour du paiement: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * Process payment (mark as completed)
 */
const processPayment = async (paymentId, paymentData, processedBy) => {
  const client = await query.connect();
  
  try {
    await client.query('BEGIN');

    // Get current payment
    const currentResult = await client.query(
      'SELECT * FROM enhanced_payments WHERE id = $1 AND deleted_at IS NULL',
      [paymentId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Paiement non trouvé');
    }

    const currentPayment = currentResult.rows[0];

    if (currentPayment.payment_status === 'COMPLETED') {
      throw new Error('Ce paiement a déjà été traité');
    }

    // Update payment status to completed
    const updateResult = await client.query(`
      UPDATE enhanced_payments 
      SET 
        payment_status = 'COMPLETED',
        payment_date = $2,
        payment_method = $3,
        notes = $4,
        updated_by = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      paymentId,
      paymentData.paymentDate || new Date(),
      paymentData.paymentMethod || currentPayment.payment_method,
      paymentData.notes || currentPayment.notes,
      processedBy
    ]);

    const processedPayment = updateResult.rows[0];

    // Log payment processing
    await client.query(`
      INSERT INTO audit_logs (
        table_name, record_id, action, old_values, new_values,
        changed_by, change_reason
      ) VALUES (
        'enhanced_payments', $1, 'PROCESS', $2, $3, $4, 'Payment processed'
      )
    `, [
      paymentId,
      JSON.stringify(currentPayment),
      JSON.stringify(processedPayment),
      processedBy
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Paiement traité avec succès',
      data: processedPayment
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Erreur lors du traitement du paiement: ${error.message}`);
  } finally {
    client.release();
  }
};

/**
 * Get payment statistics
 */
const getPaymentStatistics = async (academicYearId) => {
  try {
    let currentAcademicYear;
    
    if (academicYearId) {
      const academicYearResult = await query(
        'SELECT * FROM academic_years WHERE id = $1',
        [academicYearId]
      );
      if (academicYearResult.rows.length === 0) {
        throw new Error('Année académique non trouvée');
      }
      currentAcademicYear = { success: true, data: academicYearResult.rows[0] };
    } else {
      currentAcademicYear = await getCurrentAcademicYear();
    }

    if (!currentAcademicYear.success) {
      throw new Error('Aucune année académique active trouvée');
    }

    const yearId = currentAcademicYear.data.id;

    // Get comprehensive payment statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN payment_status = 'COMPLETED' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN payment_status = 'PENDING' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN payment_status = 'OVERDUE' THEN 1 END) as overdue_payments,
        COUNT(CASE WHEN payment_status = 'CANCELLED' THEN 1 END) as cancelled_payments,
        
        COALESCE(SUM(CASE WHEN payment_status = 'COMPLETED' THEN amount END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'PENDING' THEN amount END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'OVERDUE' THEN amount END), 0) as overdue_amount,
        
        COALESCE(SUM(CASE WHEN payment_type = 'TUITION' AND payment_status = 'COMPLETED' THEN amount END), 0) as tuition_revenue,
        COALESCE(SUM(CASE WHEN payment_type = 'CARE_SERVICES' AND payment_status = 'COMPLETED' THEN amount END), 0) as care_services_revenue,
        COALESCE(SUM(CASE WHEN payment_type = 'OTHER' AND payment_status = 'COMPLETED' THEN amount END), 0) as other_revenue,
        
        COALESCE(AVG(CASE WHEN payment_status = 'COMPLETED' THEN amount END), 0) as average_payment_amount,
        COALESCE(SUM(discount_applied), 0) as total_discounts,
        COALESCE(SUM(late_fee_applied), 0) as total_late_fees
      FROM enhanced_payments
      WHERE academic_year_id = $1 AND deleted_at IS NULL
    `, [yearId]);

    const stats = statsResult.rows[0];

    // Get payment method distribution
    const methodDistributionResult = await query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM enhanced_payments
      WHERE academic_year_id = $1 
        AND payment_status = 'COMPLETED' 
        AND deleted_at IS NULL
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `, [yearId]);

    const methodDistribution = methodDistributionResult.rows;

    // Get monthly revenue trends
    const monthlyTrendsResult = await query(`
      SELECT 
        DATE_TRUNC('month', payment_date) as month,
        COUNT(*) as payment_count,
        SUM(amount) as total_amount
      FROM enhanced_payments
      WHERE academic_year_id = $1 
        AND payment_status = 'COMPLETED' 
        AND deleted_at IS NULL
        AND payment_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', payment_date)
      ORDER BY month
    `, [yearId]);

    const monthlyTrends = monthlyTrendsResult.rows.map(row => ({
      month: format(new Date(row.month), 'MMM yyyy', { locale: fr }),
      paymentCount: parseInt(row.payment_count),
      totalAmount: parseFloat(row.total_amount)
    }));

    return {
      success: true,
      data: {
        academicYear: currentAcademicYear.data,
        overview: {
          totalPayments: parseInt(stats.total_payments),
          completedPayments: parseInt(stats.completed_payments),
          pendingPayments: parseInt(stats.pending_payments),
          overduePayments: parseInt(stats.overdue_payments),
          cancelledPayments: parseInt(stats.cancelled_payments)
        },
        financial: {
          totalRevenue: parseFloat(stats.total_revenue),
          pendingAmount: parseFloat(stats.pending_amount),
          overdueAmount: parseFloat(stats.overdue_amount),
          averagePaymentAmount: parseFloat(stats.average_payment_amount),
          totalDiscounts: parseFloat(stats.total_discounts),
          totalLateFees: parseFloat(stats.total_late_fees)
        },
        revenueByType: {
          tuition: parseFloat(stats.tuition_revenue),
          careServices: parseFloat(stats.care_services_revenue),
          other: parseFloat(stats.other_revenue)
        },
        methodDistribution,
        monthlyTrends
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération des statistiques de paiement: ${error.message}`);
  }
};

module.exports = {
  createPayment,
  getPaymentById,
  getAllPayments,
  updatePayment,
  processPayment,
  getPaymentStatistics
};
