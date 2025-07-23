/**
 * Parent Portal Controller - École Nid Douillet
 * 
 * Restricted access portal for parents to view child information,
 * care services, payments, and communicate with the school
 */

const { query } = require('../config/database');
const { getCurrentAcademicYear } = require('../utils/academicYear');
const { calculateAge, determineClassLevel } = require('../utils/ageCalculation');
const { format, startOfMonth, endOfMonth } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Get parent dashboard overview
 * Shows summary information for all children linked to the parent
 */
const getParentDashboard = async (req, res) => {
  try {
    const parentId = req.user.userId;

    // Get current academic year
    const currentAcademicYear = await getCurrentAcademicYear();
    if (!currentAcademicYear.success) {
      return res.status(400).json({
        success: false,
        message: 'Aucune année académique active trouvée',
        code: 'NO_ACTIVE_ACADEMIC_YEAR'
      });
    }

    const academicYearId = currentAcademicYear.data.id;

    // Get parent information
    const parentResult = await query(`
      SELECT 
        id, first_name, last_name, email, phone, address,
        preferred_language, communication_preferences,
        created_at, last_login
      FROM parents 
      WHERE id = $1 AND deleted_at IS NULL
    `, [parentId]);

    if (parentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Informations parent non trouvées',
        code: 'PARENT_NOT_FOUND'
      });
    }

    const parent = parentResult.rows[0];

    // Get children linked to this parent
    const childrenResult = await query(`
      SELECT 
        c.id, c.first_name, c.last_name, c.birth_date, c.gender,
        c.enrollment_date, c.medical_conditions, c.allergies,
        cl.level_name, cl.level_name_arabic,
        ay.year_label as academic_year
      FROM children c
      JOIN parent_children pc ON c.id = pc.child_id
      JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN class_levels cl ON c.class_level_id = cl.id
      WHERE pc.parent_id = $1 
        AND c.academic_year_id = $2
      ORDER BY c.first_name
    `, [parentId, academicYearId]);

    const children = childrenResult.rows.map(child => ({
      ...child,
      age: calculateAge(child.birth_date),
      birth_date_formatted: format(new Date(child.birth_date), 'dd/MM/yyyy', { locale: fr }),
      enrollment_date_formatted: format(new Date(child.enrollment_date), 'dd/MM/yyyy', { locale: fr })
    }));

    // Get payment summary for all children
    const paymentSummaryResult = await query(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_payments,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN total_amount END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN total_amount END), 0) as overdue_amount,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount END), 0) as paid_amount
      FROM enhanced_payments p
      JOIN children c ON p.child_id = c.id
      JOIN parent_children pc ON c.id = pc.child_id
      WHERE pc.parent_id = $1 
        AND p.academic_year_id = $2
    `, [parentId, academicYearId]);

    const paymentSummary = paymentSummaryResult.rows[0];

    // Get care services enrollment for children
    const careServicesResult = await query(`
      SELECT 
        c.first_name || ' ' || c.last_name as child_name,
        csc.service_name, csc.service_name_arabic,
        cse.hours_per_week, cse.start_date, cse.end_date,
        csc.hourly_rate, cse.is_active
      FROM care_services_enrollment cse
      JOIN care_services_config csc ON cse.service_id = csc.id
      JOIN children c ON cse.child_id = c.id
      JOIN parent_children pc ON c.id = pc.child_id
      WHERE pc.parent_id = $1 
        AND c.academic_year_id = $2
      ORDER BY c.first_name, csc.service_name
    `, [parentId, academicYearId]);

    const careServices = careServicesResult.rows.map(service => ({
      ...service,
      start_date_formatted: format(new Date(service.start_date), 'dd/MM/yyyy', { locale: fr }),
      end_date_formatted: service.end_date ? format(new Date(service.end_date), 'dd/MM/yyyy', { locale: fr }) : null,
      weekly_cost: parseFloat(service.hourly_rate) * parseInt(service.hours_per_week)
    }));

    // Get recent notifications for this parent
    const notificationsResult = await query(`
      SELECT 
        type, template_type, subject, sent_at, status
      FROM notifications
      WHERE recipient = $1 OR recipient = $2
      ORDER BY sent_at DESC
      LIMIT 5
    `, [parent.email, parent.phone]);

    const recentNotifications = notificationsResult.rows.map(notification => ({
      ...notification,
      sent_at_formatted: format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    }));

    // Prepare dashboard data
    const dashboardData = {
      parent: {
        ...parent,
        last_login_formatted: parent.last_login ? format(new Date(parent.last_login), 'dd/MM/yyyy HH:mm', { locale: fr }) : null,
        created_at_formatted: format(new Date(parent.created_at), 'dd/MM/yyyy', { locale: fr })
      },
      academicYear: currentAcademicYear.data,
      children,
      paymentSummary: {
        totalPayments: parseInt(paymentSummary.total_payments) || 0,
        pendingPayments: parseInt(paymentSummary.pending_payments) || 0,
        overduePayments: parseInt(paymentSummary.overdue_payments) || 0,
        pendingAmount: parseFloat(paymentSummary.pending_amount) || 0,
        overdueAmount: parseFloat(paymentSummary.overdue_amount) || 0,
        paidAmount: parseFloat(paymentSummary.paid_amount) || 0
      },
      careServices,
      recentNotifications,
      summary: {
        totalChildren: children.length,
        activeCareServices: careServices.filter(s => s.is_active).length,
        urgentPayments: parseInt(paymentSummary.overdue_payments) || 0
      }
    };

    res.json({
      success: true,
      message: 'Tableau de bord parent récupéré avec succès',
      data: dashboardData
    });

  } catch (error) {
    console.error('Parent dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du tableau de bord',
      code: 'PARENT_DASHBOARD_ERROR'
    });
  }
};

/**
 * Get detailed information for a specific child
 * Only accessible if the child is linked to the requesting parent
 */
const getChildDetails = async (req, res) => {
  try {
    const parentId = req.user.userId;
    const childId = req.params.childId;

    // Verify parent has access to this child
    const accessResult = await query(`
      SELECT 'parent' as relationship_type, true as is_primary
      FROM parent_children pc
      WHERE pc.parent_id = $1 AND pc.child_id = $2
    `, [parentId, childId]);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cet enfant',
        code: 'CHILD_ACCESS_DENIED'
      });
    }

    // Get detailed child information
    const childResult = await query(`
      SELECT 
        c.id, c.first_name, c.last_name, c.birth_date, c.gender,
        c.enrollment_date, c.medical_conditions, c.allergies, 
        c.additional_notes, c.created_at,
        cl.level_name, cl.level_name_arabic, cl.age_range_min, cl.age_range_max,
        ay.year_label as academic_year, ay.start_date as academic_start,
        ay.end_date as academic_end
      FROM children c
      JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN class_levels cl ON c.class_level_id = cl.id
      WHERE c.id = $1
    `, [childId]);

    if (childResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enfant non trouvé',
        code: 'CHILD_NOT_FOUND'
      });
    }

    const child = childResult.rows[0];

    // Get child's payments
    const paymentsResult = await query(`
      SELECT 
        id, type as payment_type, total_amount as amount, 'MAD' as currency, status as payment_status,
        payment_date, due_date, receipt_number as payment_reference, notes as description,
        enrollment_fee, monthly_fee, care_service_fee, created_at
      FROM enhanced_payments
      WHERE child_id = $1
      ORDER BY created_at DESC
    `, [childId]);

    const payments = paymentsResult.rows.map(payment => ({
      ...payment,
      fee_breakdown: payment.fee_breakdown ? JSON.parse(payment.fee_breakdown) : null,
      care_services_breakdown: payment.care_services_breakdown ? JSON.parse(payment.care_services_breakdown) : null,
      payment_date_formatted: payment.payment_date ? format(new Date(payment.payment_date), 'dd/MM/yyyy', { locale: fr }) : null,
      due_date_formatted: format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: fr }),
      created_at_formatted: format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    }));

    // Get child's care services
    const careServicesResult = await query(`
      SELECT 
        cse.id, cse.hours_per_week, cse.start_date, cse.end_date,
        cse.is_active, cse.notes,
        csc.service_name, csc.service_name_arabic, csc.description,
        csc.hourly_rate, csc.is_available
      FROM care_services_enrollment cse
      JOIN care_services_config csc ON cse.service_id = csc.id
      WHERE cse.child_id = $1
      ORDER BY cse.start_date DESC
    `, [childId]);

    const careServices = careServicesResult.rows.map(service => ({
      ...service,
      start_date_formatted: format(new Date(service.start_date), 'dd/MM/yyyy', { locale: fr }),
      end_date_formatted: service.end_date ? format(new Date(service.end_date), 'dd/MM/yyyy', { locale: fr }) : null,
      weekly_cost: parseFloat(service.hourly_rate) * parseInt(service.hours_per_week)
    }));

    // Get other parents linked to this child
    const otherParentsResult = await query(`
      SELECT 
        p.first_name, p.last_name, p.email, p.phone,
        pcr.relationship_type, pcr.is_primary
      FROM parents p
      JOIN parent_child_relations pcr ON p.id = pcr.parent_id
      WHERE pcr.child_id = $1 AND p.id != $2 AND p.deleted_at IS NULL
      ORDER BY pcr.is_primary DESC, p.first_name
    `, [childId, parentId]);

    const otherParents = otherParentsResult.rows;

    // Prepare detailed child data
    const childDetails = {
      child: {
        ...child,
        age: calculateAge(child.birth_date),
        birth_date_formatted: format(new Date(child.birth_date), 'dd/MM/yyyy', { locale: fr }),
        enrollment_date_formatted: format(new Date(child.enrollment_date), 'dd/MM/yyyy', { locale: fr }),
        created_at_formatted: format(new Date(child.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
      },
      parentRelation: accessResult.rows[0],
      payments,
      careServices,
      otherParents,
      statistics: {
        totalPayments: payments.length,
        pendingPayments: payments.filter(p => p.payment_status === 'PENDING').length,
        overduePayments: payments.filter(p => p.payment_status === 'OVERDUE').length,
        activeCareServices: careServices.filter(s => s.is_active).length,
        totalPaid: payments
          .filter(p => p.payment_status === 'COMPLETED')
          .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      }
    };

    res.json({
      success: true,
      message: 'Détails de l\'enfant récupérés avec succès',
      data: childDetails
    });

  } catch (error) {
    console.error('Child details error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails de l\'enfant',
      code: 'CHILD_DETAILS_ERROR'
    });
  }
};

/**
 * Get parent's payment history
 */
const getPaymentHistory = async (req, res) => {
  try {
    const parentId = req.user.userId;
    const {
      limit = 20,
      offset = 0,
      childId,
      paymentStatus,
      paymentType,
      startDate,
      endDate
    } = req.query;

    let whereConditions = [
      'pcr.parent_id = $1',
      'p.deleted_at IS NULL',
      'c.deleted_at IS NULL'
    ];
    let queryParams = [parentId];
    let paramCount = 1;

    // Build WHERE conditions
    if (childId) {
      paramCount++;
      whereConditions.push(`p.child_id = $${paramCount}`);
      queryParams.push(childId);
    }

    if (paymentStatus) {
      paramCount++;
      whereConditions.push(`p.payment_status = $${paramCount}`);
      queryParams.push(paymentStatus);
    }

    if (paymentType) {
      paramCount++;
      whereConditions.push(`p.payment_type = $${paramCount}`);
      queryParams.push(paymentType);
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

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM enhanced_payments p
      JOIN children c ON p.child_id = c.id
      JOIN parent_child_relations pcr ON c.id = pcr.child_id
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
        p.id, p.payment_type, p.amount, p.currency, p.payment_status,
        p.payment_date, p.due_date, p.payment_reference, p.description,
        p.fee_breakdown, p.care_services_breakdown, p.discount_applied,
        p.late_fee_applied, p.created_at,
        c.first_name || ' ' || c.last_name as child_name,
        ay.year_label as academic_year
      FROM enhanced_payments p
      JOIN children c ON p.child_id = c.id
      JOIN parent_child_relations pcr ON c.id = pcr.child_id
      JOIN academic_years ay ON p.academic_year_id = ay.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.created_at DESC
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

    res.json({
      success: true,
      message: 'Historique des paiements récupéré avec succès',
      data: {
        payments,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique des paiements',
      code: 'PAYMENT_HISTORY_ERROR'
    });
  }
};

/**
 * Update parent profile information
 */
const updateParentProfile = async (req, res) => {
  try {
    const parentId = req.user.userId;
    const updates = req.body;

    // Validate allowed fields for parent self-update
    const allowedFields = [
      'phone', 'address', 'emergency_contact', 'profession', 'workplace',
      'preferred_language', 'communication_preferences', 'notes'
    ];

    const updateFields = Object.keys(updates).filter(field => allowedFields.includes(field));
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ valide à mettre à jour',
        code: 'NO_VALID_FIELDS'
      });
    }

    // Build update query
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const updateValues = updateFields.map(field => updates[field]);

    const updateQuery = `
      UPDATE parents 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, first_name, last_name, email, phone, address, 
                emergency_contact, profession, workplace, preferred_language,
                communication_preferences, notes, updated_at
    `;

    const updateResult = await query(updateQuery, [parentId, ...updateValues]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent non trouvé',
        code: 'PARENT_NOT_FOUND'
      });
    }

    const updatedParent = updateResult.rows[0];

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        ...updatedParent,
        updated_at_formatted: format(new Date(updatedParent.updated_at), 'dd/MM/yyyy HH:mm', { locale: fr })
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
};

module.exports = {
  getParentDashboard,
  getChildDetails,
  getPaymentHistory,
  updateParentProfile
};
