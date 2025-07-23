/**
 * Director Dashboard Controller - École Nid Douillet
 * 
 * Comprehensive dashboard functionality for school directors
 * Provides overview statistics, management tools, and reporting capabilities
 */

const { query } = require('../config/database');
const { getCurrentAcademicYear } = require('../utils/academicYear');
const { getChildrenStatistics } = require('../models/Child');
const { getParentStatistics } = require('../models/Parent');
const { format, startOfMonth, endOfMonth, subMonths } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Get comprehensive dashboard overview
 * Provides key metrics and statistics for the director
 */
const getDashboardOverview = async (req, res) => {
  try {
    const currentAcademicYear = await getCurrentAcademicYear();
    
    if (!currentAcademicYear.success) {
      return res.status(400).json({
        success: false,
        message: 'Aucune année académique active trouvée',
        code: 'NO_ACTIVE_ACADEMIC_YEAR'
      });
    }

    const academicYearId = currentAcademicYear.data.id;

    // Get children statistics
    const childrenStats = await getChildrenStatistics(academicYearId);
    
    // Get parent statistics
    const parentStats = await getParentStatistics();

    // Get enrollment statistics
    const enrollmentResult = await query(`
      SELECT 
        COUNT(*) as total_enrolled,
        COUNT(CASE WHEN c.gender = 'M' THEN 1 END) as boys_count,
        COUNT(CASE WHEN c.gender = 'F' THEN 1 END) as girls_count,
        COUNT(CASE WHEN c.created_at >= $1 THEN 1 END) as new_enrollments_this_month
      FROM children c
      WHERE c.academic_year_id = $2 
        AND c.deleted_at IS NULL
    `, [startOfMonth(new Date()), academicYearId]);

    const enrollmentStats = enrollmentResult.rows[0];

    // Get financial overview (current month)
    const currentMonth = new Date();
    const financialResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.payment_type = 'TUITION' THEN p.amount END), 0) as tuition_revenue,
        COALESCE(SUM(CASE WHEN p.payment_type = 'CARE_SERVICES' THEN p.amount END), 0) as care_services_revenue,
        COALESCE(SUM(CASE WHEN p.payment_type = 'OTHER' THEN p.amount END), 0) as other_revenue,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COUNT(CASE WHEN p.payment_status = 'PENDING' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN p.payment_status = 'OVERDUE' THEN 1 END) as overdue_payments
      FROM enhanced_payments p
      WHERE p.academic_year_id = $1
        AND p.payment_date >= $2
        AND p.payment_date <= $3
        AND p.deleted_at IS NULL
    `, [academicYearId, startOfMonth(currentMonth), endOfMonth(currentMonth)]);

    const financialStats = financialResult.rows[0];

    // Get expenses overview (current month)
    const expensesResult = await query(`
      SELECT 
        COALESCE(SUM(e.amount), 0) as total_expenses,
        COUNT(*) as expense_count,
        COALESCE(SUM(CASE WHEN e.category = 'STAFF' THEN e.amount END), 0) as staff_expenses,
        COALESCE(SUM(CASE WHEN e.category = 'SUPPLIES' THEN e.amount END), 0) as supplies_expenses,
        COALESCE(SUM(CASE WHEN e.category = 'UTILITIES' THEN e.amount END), 0) as utilities_expenses,
        COALESCE(SUM(CASE WHEN e.category = 'MAINTENANCE' THEN e.amount END), 0) as maintenance_expenses
      FROM expenses e
      WHERE e.expense_date >= $1
        AND e.expense_date <= $2
        AND e.deleted_at IS NULL
    `, [startOfMonth(currentMonth), endOfMonth(currentMonth)]);

    const expensesStats = expensesResult.rows[0];

    // Get care services statistics
    const careServicesResult = await query(`
      SELECT 
        COUNT(DISTINCT cse.child_id) as children_in_care,
        COUNT(*) as total_enrollments,
        COALESCE(SUM(csc.hourly_rate * cse.hours_per_week), 0) as weekly_care_revenue
      FROM care_services_enrollment cse
      JOIN care_services_config csc ON cse.service_id = csc.id
      JOIN children c ON cse.child_id = c.id
      WHERE c.academic_year_id = $1
        AND cse.is_active = true
        AND c.deleted_at IS NULL
    `, [academicYearId]);

    const careServicesStats = careServicesResult.rows[0];

    // Get recent activities (last 7 days)
    const recentActivitiesResult = await query(`
      SELECT 
        'child_enrollment' as activity_type,
        c.first_name || ' ' || c.last_name as description,
        c.created_at as activity_date,
        'Nouvel enfant inscrit' as activity_message
      FROM children c
      WHERE c.created_at >= NOW() - INTERVAL '7 days'
        AND c.academic_year_id = $1
        AND c.deleted_at IS NULL
      
      UNION ALL
      
      SELECT 
        'payment_received' as activity_type,
        'Paiement de ' || p.amount || ' MAD' as description,
        p.payment_date as activity_date,
        'Paiement reçu' as activity_message
      FROM enhanced_payments p
      WHERE p.payment_date >= NOW() - INTERVAL '7 days'
        AND p.payment_status = 'COMPLETED'
        AND p.academic_year_id = $1
        AND p.deleted_at IS NULL
      
      ORDER BY activity_date DESC
      LIMIT 10
    `, [academicYearId]);

    const recentActivities = recentActivitiesResult.rows;

    // Calculate profit/loss for current month
    const totalRevenue = parseFloat(financialStats.total_revenue) || 0;
    const totalExpenses = parseFloat(expensesStats.total_expenses) || 0;
    const monthlyProfit = totalRevenue - totalExpenses;

    // Get class distribution
    const classDistributionResult = await query(`
      SELECT 
        cl.level_name,
        cl.level_name_arabic,
        COUNT(c.id) as student_count,
        cl.max_capacity,
        ROUND((COUNT(c.id)::float / cl.max_capacity) * 100, 2) as occupancy_rate
      FROM class_levels cl
      LEFT JOIN children c ON c.class_level_id = cl.id 
        AND c.academic_year_id = $1 
        AND c.deleted_at IS NULL
      GROUP BY cl.id, cl.level_name, cl.level_name_arabic, cl.max_capacity
      ORDER BY cl.age_range_min
    `, [academicYearId]);

    const classDistribution = classDistributionResult.rows;

    // Prepare dashboard data
    const dashboardData = {
      academicYear: currentAcademicYear.data,
      overview: {
        totalChildren: parseInt(enrollmentStats.total_enrolled) || 0,
        totalParents: parentStats.success ? parentStats.data.totalParents : 0,
        newEnrollmentsThisMonth: parseInt(enrollmentStats.new_enrollments_this_month) || 0,
        childrenInCare: parseInt(careServicesStats.children_in_care) || 0
      },
      financial: {
        monthlyRevenue: totalRevenue,
        monthlyExpenses: totalExpenses,
        monthlyProfit: monthlyProfit,
        pendingPayments: parseInt(financialStats.pending_payments) || 0,
        overduePayments: parseInt(financialStats.overdue_payments) || 0,
        revenueBreakdown: {
          tuition: parseFloat(financialStats.tuition_revenue) || 0,
          careServices: parseFloat(financialStats.care_services_revenue) || 0,
          other: parseFloat(financialStats.other_revenue) || 0
        },
        expenseBreakdown: {
          staff: parseFloat(expensesStats.staff_expenses) || 0,
          supplies: parseFloat(expensesStats.supplies_expenses) || 0,
          utilities: parseFloat(expensesStats.utilities_expenses) || 0,
          maintenance: parseFloat(expensesStats.maintenance_expenses) || 0
        }
      },
      enrollment: {
        totalEnrolled: parseInt(enrollmentStats.total_enrolled) || 0,
        boysCount: parseInt(enrollmentStats.boys_count) || 0,
        girlsCount: parseInt(enrollmentStats.girls_count) || 0,
        genderDistribution: {
          boys: Math.round(((parseInt(enrollmentStats.boys_count) || 0) / (parseInt(enrollmentStats.total_enrolled) || 1)) * 100),
          girls: Math.round(((parseInt(enrollmentStats.girls_count) || 0) / (parseInt(enrollmentStats.total_enrolled) || 1)) * 100)
        }
      },
      classDistribution,
      careServices: {
        childrenInCare: parseInt(careServicesStats.children_in_care) || 0,
        totalEnrollments: parseInt(careServicesStats.total_enrollments) || 0,
        weeklyRevenue: parseFloat(careServicesStats.weekly_care_revenue) || 0
      },
      recentActivities: recentActivities.map(activity => ({
        ...activity,
        activity_date: format(new Date(activity.activity_date), 'dd/MM/yyyy HH:mm', { locale: fr })
      }))
    };

    res.json({
      success: true,
      message: 'Tableau de bord récupéré avec succès',
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du tableau de bord',
      code: 'DASHBOARD_ERROR'
    });
  }
};

/**
 * Get financial analytics for specified period
 */
const getFinancialAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, academicYearId } = req.query;
    
    let currentAcademicYear;
    if (academicYearId) {
      const academicYearResult = await query(
        'SELECT * FROM academic_years WHERE id = $1',
        [academicYearId]
      );
      if (academicYearResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Année académique non trouvée',
          code: 'ACADEMIC_YEAR_NOT_FOUND'
        });
      }
      currentAcademicYear = { success: true, data: academicYearResult.rows[0] };
    } else {
      currentAcademicYear = await getCurrentAcademicYear();
    }

    if (!currentAcademicYear.success) {
      return res.status(400).json({
        success: false,
        message: 'Aucune année académique active trouvée',
        code: 'NO_ACTIVE_ACADEMIC_YEAR'
      });
    }

    const yearId = currentAcademicYear.data.id;
    const start = startDate ? new Date(startDate) : startOfMonth(subMonths(new Date(), 5));
    const end = endDate ? new Date(endDate) : endOfMonth(new Date());

    // Monthly revenue and expenses
    const monthlyDataResult = await query(`
      WITH months AS (
        SELECT generate_series($1::date, $2::date, '1 month'::interval) AS month
      ),
      monthly_revenue AS (
        SELECT 
          DATE_TRUNC('month', p.payment_date) as month,
          SUM(p.amount) as revenue
        FROM enhanced_payments p
        WHERE p.payment_date >= $1 
          AND p.payment_date <= $2
          AND p.academic_year_id = $3
          AND p.payment_status = 'COMPLETED'
          AND p.deleted_at IS NULL
        GROUP BY DATE_TRUNC('month', p.payment_date)
      ),
      monthly_expenses AS (
        SELECT 
          DATE_TRUNC('month', e.expense_date) as month,
          SUM(e.amount) as expenses
        FROM expenses e
        WHERE e.expense_date >= $1 
          AND e.expense_date <= $2
          AND e.deleted_at IS NULL
        GROUP BY DATE_TRUNC('month', e.expense_date)
      )
      SELECT 
        m.month,
        COALESCE(mr.revenue, 0) as revenue,
        COALESCE(me.expenses, 0) as expenses,
        COALESCE(mr.revenue, 0) - COALESCE(me.expenses, 0) as profit
      FROM months m
      LEFT JOIN monthly_revenue mr ON DATE_TRUNC('month', m.month) = mr.month
      LEFT JOIN monthly_expenses me ON DATE_TRUNC('month', m.month) = me.month
      ORDER BY m.month
    `, [start, end, yearId]);

    const monthlyData = monthlyDataResult.rows.map(row => ({
      month: format(new Date(row.month), 'MMM yyyy', { locale: fr }),
      revenue: parseFloat(row.revenue) || 0,
      expenses: parseFloat(row.expenses) || 0,
      profit: parseFloat(row.profit) || 0
    }));

    // Payment status distribution
    const paymentStatusResult = await query(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM enhanced_payments
      WHERE academic_year_id = $1
        AND payment_date >= $2
        AND payment_date <= $3
        AND deleted_at IS NULL
      GROUP BY payment_status
    `, [yearId, start, end]);

    const paymentStatusDistribution = paymentStatusResult.rows;

    // Revenue by payment type
    const revenueByTypeResult = await query(`
      SELECT 
        payment_type,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM enhanced_payments
      WHERE academic_year_id = $1
        AND payment_date >= $2
        AND payment_date <= $3
        AND payment_status = 'COMPLETED'
        AND deleted_at IS NULL
      GROUP BY payment_type
    `, [yearId, start, end]);

    const revenueByType = revenueByTypeResult.rows;

    // Expense categories
    const expenseCategoriesResult = await query(`
      SELECT 
        category,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM expenses
      WHERE expense_date >= $1
        AND expense_date <= $2
        AND deleted_at IS NULL
      GROUP BY category
    `, [start, end]);

    const expenseCategories = expenseCategoriesResult.rows;

    res.json({
      success: true,
      message: 'Analyses financières récupérées avec succès',
      data: {
        period: {
          startDate: format(start, 'dd/MM/yyyy', { locale: fr }),
          endDate: format(end, 'dd/MM/yyyy', { locale: fr })
        },
        monthlyData,
        paymentStatusDistribution,
        revenueByType,
        expenseCategories,
        summary: {
          totalRevenue: monthlyData.reduce((sum, month) => sum + month.revenue, 0),
          totalExpenses: monthlyData.reduce((sum, month) => sum + month.expenses, 0),
          totalProfit: monthlyData.reduce((sum, month) => sum + month.profit, 0)
        }
      }
    });

  } catch (error) {
    console.error('Financial analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses financières',
      code: 'FINANCIAL_ANALYTICS_ERROR'
    });
  }
};

/**
 * Get enrollment analytics
 */
const getEnrollmentAnalytics = async (req, res) => {
  try {
    const { academicYearId } = req.query;
    
    let currentAcademicYear;
    if (academicYearId) {
      const academicYearResult = await query(
        'SELECT * FROM academic_years WHERE id = $1',
        [academicYearId]
      );
      if (academicYearResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Année académique non trouvée',
          code: 'ACADEMIC_YEAR_NOT_FOUND'
        });
      }
      currentAcademicYear = { success: true, data: academicYearResult.rows[0] };
    } else {
      currentAcademicYear = await getCurrentAcademicYear();
    }

    if (!currentAcademicYear.success) {
      return res.status(400).json({
        success: false,
        message: 'Aucune année académique active trouvée',
        code: 'NO_ACTIVE_ACADEMIC_YEAR'
      });
    }

    const yearId = currentAcademicYear.data.id;

    // Monthly enrollment trends
    const enrollmentTrendsResult = await query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as new_enrollments
      FROM children
      WHERE academic_year_id = $1
        AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `, [yearId]);

    const enrollmentTrends = enrollmentTrendsResult.rows.map(row => ({
      month: format(new Date(row.month), 'MMM yyyy', { locale: fr }),
      newEnrollments: parseInt(row.new_enrollments)
    }));

    // Age distribution
    const ageDistributionResult = await query(`
      SELECT 
        EXTRACT(YEAR FROM AGE(birth_date)) as age,
        COUNT(*) as count
      FROM children
      WHERE academic_year_id = $1
        AND deleted_at IS NULL
      GROUP BY EXTRACT(YEAR FROM AGE(birth_date))
      ORDER BY age
    `, [yearId]);

    const ageDistribution = ageDistributionResult.rows;

    // Class level statistics
    const classStatsResult = await query(`
      SELECT 
        cl.level_name,
        cl.level_name_arabic,
        cl.max_capacity,
        COUNT(c.id) as current_enrollment,
        ROUND((COUNT(c.id)::float / cl.max_capacity) * 100, 2) as occupancy_rate
      FROM class_levels cl
      LEFT JOIN children c ON c.class_level_id = cl.id 
        AND c.academic_year_id = $1 
        AND c.deleted_at IS NULL
      GROUP BY cl.id, cl.level_name, cl.level_name_arabic, cl.max_capacity
      ORDER BY cl.age_range_min
    `, [yearId]);

    const classStats = classStatsResult.rows;

    res.json({
      success: true,
      message: 'Analyses d\'inscription récupérées avec succès',
      data: {
        academicYear: currentAcademicYear.data,
        enrollmentTrends,
        ageDistribution,
        classStats,
        summary: {
          totalEnrolled: classStats.reduce((sum, cls) => sum + parseInt(cls.current_enrollment), 0),
          totalCapacity: classStats.reduce((sum, cls) => sum + parseInt(cls.max_capacity), 0),
          averageOccupancy: Math.round(classStats.reduce((sum, cls) => sum + parseFloat(cls.occupancy_rate), 0) / classStats.length)
        }
      }
    });

  } catch (error) {
    console.error('Enrollment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses d\'inscription',
      code: 'ENROLLMENT_ANALYTICS_ERROR'
    });
  }
};

module.exports = {
  getDashboardOverview,
  getFinancialAnalytics,
  getEnrollmentAnalytics
};
