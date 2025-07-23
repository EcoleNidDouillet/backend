/**
 * Notification Service - École Nid Douillet
 * 
 * Comprehensive notification system for email and SMS communications
 * Supports automated triggers, templates, and multi-language support
 */

const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { query } = require('../config/database');
const { format } = require('date-fns');
const { fr } = require('date-fns/locale');

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Initialize Twilio client
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (error) {
    console.warn('Twilio initialization failed:', error.message);
    twilioClient = null;
  }
}

/**
 * Email templates for different notification types
 */
const emailTemplates = {
  welcome: {
    subject: 'Bienvenue à l\'École Nid Douillet',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1>École Nid Douillet</h1>
          <p>Maternelle Bilingue Français-Arabe</p>
        </div>
        <div style="padding: 20px;">
          <h2>Bienvenue ${data.parentName}!</h2>
          <p>Nous sommes ravis d'accueillir <strong>${data.childName}</strong> dans notre école maternelle.</p>
          <p><strong>Informations importantes:</strong></p>
          <ul>
            <li>Année académique: ${data.academicYear}</li>
            <li>Classe: ${data.classLevel}</li>
            <li>Date d'inscription: ${data.enrollmentDate}</li>
          </ul>
          <p>Vous pouvez accéder à votre portail parent à l'adresse: <a href="${process.env.FRONTEND_URL}/parent/login">Portail Parent</a></p>
          <p>Cordialement,<br>L'équipe de l'École Nid Douillet</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 12px;">
          <p>École Nid Douillet - Agadir, Maroc | contact@niddouillet.ma</p>
        </div>
      </div>
    `
  },
  
  payment_reminder: {
    subject: 'Rappel de paiement - École Nid Douillet',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1>Rappel de Paiement</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Cher(e) ${data.parentName},</h2>
          <p>Nous vous rappelons qu'un paiement est en attente pour <strong>${data.childName}</strong>.</p>
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Détails du paiement:</strong></p>
            <ul>
              <li>Montant: ${data.amount} ${data.currency}</li>
              <li>Type: ${data.paymentType}</li>
              <li>Date d'échéance: ${data.dueDate}</li>
              <li>Référence: ${data.paymentReference}</li>
            </ul>
          </div>
          <p>Veuillez effectuer ce paiement dans les plus brefs délais pour éviter tout désagrément.</p>
          <p>Pour toute question, n'hésitez pas à nous contacter.</p>
          <p>Cordialement,<br>L'équipe de l'École Nid Douillet</p>
        </div>
      </div>
    `
  },
  
  payment_overdue: {
    subject: 'Paiement en retard - École Nid Douillet',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1>Paiement en Retard</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Cher(e) ${data.parentName},</h2>
          <p>Nous vous informons qu'un paiement pour <strong>${data.childName}</strong> est maintenant en retard.</p>
          <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Détails du paiement en retard:</strong></p>
            <ul>
              <li>Montant: ${data.amount} ${data.currency}</li>
              <li>Type: ${data.paymentType}</li>
              <li>Date d'échéance: ${data.dueDate}</li>
              <li>Jours de retard: ${data.daysOverdue}</li>
              <li>Référence: ${data.paymentReference}</li>
            </ul>
          </div>
          <p><strong>Action requise:</strong> Veuillez régulariser ce paiement immédiatement.</p>
          <p>Des frais de retard peuvent s'appliquer selon notre politique de paiement.</p>
          <p>Cordialement,<br>L'équipe de l'École Nid Douillet</p>
        </div>
      </div>
    `
  },
  
  payment_confirmation: {
    subject: 'Confirmation de paiement - École Nid Douillet',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 20px; text-align: center;">
          <h1>Paiement Confirmé</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Cher(e) ${data.parentName},</h2>
          <p>Nous confirmons la réception de votre paiement pour <strong>${data.childName}</strong>.</p>
          <div style="background-color: #d1fae5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Détails du paiement:</strong></p>
            <ul>
              <li>Montant: ${data.amount} ${data.currency}</li>
              <li>Type: ${data.paymentType}</li>
              <li>Date de paiement: ${data.paymentDate}</li>
              <li>Méthode: ${data.paymentMethod}</li>
              <li>Référence: ${data.paymentReference}</li>
            </ul>
          </div>
          <p>Merci pour votre paiement ponctuel.</p>
          <p>Cordialement,<br>L'équipe de l'École Nid Douillet</p>
        </div>
      </div>
    `
  },
  
  general_announcement: {
    subject: 'Annonce importante - École Nid Douillet',
    template: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1>École Nid Douillet</h1>
          <p>Annonce Importante</p>
        </div>
        <div style="padding: 20px;">
          <h2>${data.title}</h2>
          <div style="line-height: 1.6;">
            ${data.content}
          </div>
          <p style="margin-top: 30px;">Cordialement,<br>L'équipe de l'École Nid Douillet</p>
        </div>
      </div>
    `
  }
};

/**
 * SMS templates for different notification types
 */
const smsTemplates = {
  payment_reminder: (data) => 
    `École Nid Douillet: Rappel de paiement pour ${data.childName}. Montant: ${data.amount} ${data.currency}. Échéance: ${data.dueDate}. Réf: ${data.paymentReference}`,
  
  payment_overdue: (data) => 
    `École Nid Douillet: URGENT - Paiement en retard pour ${data.childName}. Montant: ${data.amount} ${data.currency}. ${data.daysOverdue} jours de retard. Régularisez rapidement.`,
  
  payment_confirmation: (data) => 
    `École Nid Douillet: Paiement confirmé pour ${data.childName}. Montant: ${data.amount} ${data.currency}. Merci!`,
  
  general_announcement: (data) => 
    `École Nid Douillet: ${data.title}. ${data.content.substring(0, 100)}...`
};

/**
 * Send email notification
 */
const sendEmail = async (to, templateType, data, options = {}) => {
  try {
    const template = emailTemplates[templateType];
    if (!template) {
      throw new Error(`Template email non trouvé: ${templateType}`);
    }

    const mailOptions = {
      from: `"École Nid Douillet" <${process.env.GMAIL_USER}>`,
      to: to,
      subject: options.subject || template.subject,
      html: template.template(data),
      ...options
    };

    const result = await emailTransporter.sendMail(mailOptions);
    
    // Log notification in database
    await logNotification({
      type: 'EMAIL',
      recipient: to,
      template_type: templateType,
      subject: mailOptions.subject,
      content: JSON.stringify(data),
      status: 'SENT',
      external_id: result.messageId
    });

    return {
      success: true,
      message: 'Email envoyé avec succès',
      messageId: result.messageId
    };

  } catch (error) {
    // Log failed notification
    await logNotification({
      type: 'EMAIL',
      recipient: to,
      template_type: templateType,
      subject: emailTemplates[templateType]?.subject || 'Unknown',
      content: JSON.stringify(data),
      status: 'FAILED',
      error_message: error.message
    });

    throw new Error(`Erreur lors de l'envoi de l'email: ${error.message}`);
  }
};

/**
 * Send SMS notification
 */
const sendSMS = async (to, templateType, data, options = {}) => {
  try {
    if (!twilioClient) {
      throw new Error('Service SMS non configuré');
    }

    const template = smsTemplates[templateType];
    if (!template) {
      throw new Error(`Template SMS non trouvé: ${templateType}`);
    }

    // Format Moroccan phone number for Twilio
    let formattedPhone = to;
    if (to.startsWith('0')) {
      formattedPhone = '+212' + to.substring(1);
    } else if (!to.startsWith('+')) {
      formattedPhone = '+212' + to;
    }

    const message = options.customMessage || template(data);

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    // Log notification in database
    await logNotification({
      type: 'SMS',
      recipient: formattedPhone,
      template_type: templateType,
      subject: templateType,
      content: message,
      status: 'SENT',
      external_id: result.sid
    });

    return {
      success: true,
      message: 'SMS envoyé avec succès',
      messageId: result.sid
    };

  } catch (error) {
    // Log failed notification
    await logNotification({
      type: 'SMS',
      recipient: to,
      template_type: templateType,
      subject: templateType,
      content: smsTemplates[templateType]?.(data) || 'Unknown',
      status: 'FAILED',
      error_message: error.message
    });

    throw new Error(`Erreur lors de l'envoi du SMS: ${error.message}`);
  }
};

/**
 * Send notification based on parent preferences
 */
const sendNotification = async (parentId, templateType, data, options = {}) => {
  try {
    // Get parent information and preferences
    const parentResult = await query(`
      SELECT 
        email, phone, communication_preferences, preferred_language,
        first_name, last_name
      FROM parents 
      WHERE id = $1 AND deleted_at IS NULL
    `, [parentId]);

    if (parentResult.rows.length === 0) {
      throw new Error('Parent non trouvé');
    }

    const parent = parentResult.rows[0];
    const results = [];

    // Add parent name to data
    const notificationData = {
      ...data,
      parentName: `${parent.first_name} ${parent.last_name}`
    };

    // Send email if preference allows
    if (parent.communication_preferences === 'EMAIL' || parent.communication_preferences === 'BOTH') {
      try {
        const emailResult = await sendEmail(parent.email, templateType, notificationData, options);
        results.push({ type: 'EMAIL', ...emailResult });
      } catch (error) {
        results.push({ type: 'EMAIL', success: false, error: error.message });
      }
    }

    // Send SMS if preference allows and phone is available
    if ((parent.communication_preferences === 'SMS' || parent.communication_preferences === 'BOTH') && parent.phone) {
      try {
        const smsResult = await sendSMS(parent.phone, templateType, notificationData, options);
        results.push({ type: 'SMS', ...smsResult });
      } catch (error) {
        results.push({ type: 'SMS', success: false, error: error.message });
      }
    }

    return {
      success: true,
      message: 'Notifications traitées',
      results
    };

  } catch (error) {
    throw new Error(`Erreur lors de l'envoi des notifications: ${error.message}`);
  }
};

/**
 * Send bulk notifications to multiple parents
 */
const sendBulkNotification = async (parentIds, templateType, data, options = {}) => {
  try {
    const results = [];
    
    for (const parentId of parentIds) {
      try {
        const result = await sendNotification(parentId, templateType, data, options);
        results.push({ parentId, ...result });
      } catch (error) {
        results.push({ parentId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return {
      success: true,
      message: `Notifications envoyées: ${successCount} succès, ${failureCount} échecs`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failure: failureCount
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de l'envoi des notifications en masse: ${error.message}`);
  }
};

/**
 * Log notification in database
 */
const logNotification = async (notificationData) => {
  try {
    await query(`
      INSERT INTO notifications (
        type, recipient, template_type, subject, content,
        status, external_id, error_message, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      notificationData.type,
      notificationData.recipient,
      notificationData.template_type,
      notificationData.subject,
      notificationData.content,
      notificationData.status,
      notificationData.external_id || null,
      notificationData.error_message || null
    ]);
  } catch (error) {
    console.error('Error logging notification:', error);
  }
};

/**
 * Get notification history
 */
const getNotificationHistory = async (filters = {}) => {
  try {
    const {
      limit = 50,
      offset = 0,
      type,
      status,
      templateType,
      startDate,
      endDate
    } = filters;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    if (templateType) {
      paramCount++;
      whereConditions.push(`template_type = $${paramCount}`);
      queryParams.push(templateType);
    }

    if (startDate) {
      paramCount++;
      whereConditions.push(`sent_at >= $${paramCount}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereConditions.push(`sent_at <= $${paramCount}`);
      queryParams.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM notifications ${whereClause}`;
    const countResult = await query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get notifications
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const notificationsQuery = `
      SELECT * FROM notifications 
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const notificationsResult = await query(notificationsQuery, queryParams);

    const notifications = notificationsResult.rows.map(notification => ({
      ...notification,
      sent_at_formatted: format(new Date(notification.sent_at), 'dd/MM/yyyy HH:mm', { locale: fr })
    }));

    return {
      success: true,
      data: {
        notifications,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(totalCount / limit)
        }
      }
    };

  } catch (error) {
    throw new Error(`Erreur lors de la récupération de l'historique des notifications: ${error.message}`);
  }
};

module.exports = {
  sendEmail,
  sendSMS,
  sendNotification,
  sendBulkNotification,
  getNotificationHistory,
  emailTemplates,
  smsTemplates
};
