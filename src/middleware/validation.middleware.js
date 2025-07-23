// École Nid Douillet - Validation Middleware
// Input validation using Joi for École-specific business rules

const Joi = require('joi');
const { logger } = require('../config/database');

// École Nid Douillet specific validation schemas
const schemas = {
  // Authentication schemas
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Format d\'email invalide',
      'any.required': 'L\'email est requis'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Le mot de passe doit contenir au moins 6 caractères',
      'any.required': 'Le mot de passe est requis'
    })
  }),

  // Director registration/update
  director: Joi.object({
    first_name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le prénom doit contenir au moins 2 caractères',
      'string.max': 'Le prénom ne peut pas dépasser 100 caractères',
      'any.required': 'Le prénom est requis'
    }),
    last_name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'string.max': 'Le nom ne peut pas dépasser 100 caractères',
      'any.required': 'Le nom est requis'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Format d\'email invalide',
      'any.required': 'L\'email est requis'
    }),
    phone: Joi.string().pattern(/^\+212[5-7]\d{8}$/).messages({
      'string.pattern.base': 'Numéro de téléphone marocain invalide (format: +212XXXXXXXXX)'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).messages({
      'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
    }),
    qualifications: Joi.array().items(Joi.string()).optional(),
    experience_years: Joi.number().integer().min(0).max(50).optional(),
    languages: Joi.array().items(Joi.string().valid('FRENCH', 'ARABIC', 'ENGLISH')).optional()
  }),

  // Parent registration/update
  parent: Joi.object({
    first_name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le prénom doit contenir au moins 2 caractères',
      'string.max': 'Le prénom ne peut pas dépasser 100 caractères',
      'any.required': 'Le prénom est requis'
    }),
    last_name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'string.max': 'Le nom ne peut pas dépasser 100 caractères',
      'any.required': 'Le nom est requis'
    }),
    first_name_arabic: Joi.string().max(100).optional(),
    last_name_arabic: Joi.string().max(100).optional(),
    email: Joi.string().email().required().messages({
      'string.email': 'Format d\'email invalide',
      'any.required': 'L\'email est requis'
    }),
    phone: Joi.string().pattern(/^\+212[5-7]\d{8}$/).required().messages({
      'string.pattern.base': 'Numéro de téléphone marocain invalide (format: +212XXXXXXXXX)',
      'any.required': 'Le numéro de téléphone est requis'
    }),
    address: Joi.string().max(500).optional(),
    city: Joi.string().max(100).default('Agadir'),
    preferred_language: Joi.string().valid('fr', 'ar').default('fr')
  }),

  // Child registration/update (École Nid Douillet specific)
  child: Joi.object({
    first_name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le prénom doit contenir au moins 2 caractères',
      'string.max': 'Le prénom ne peut pas dépasser 100 caractères',
      'any.required': 'Le prénom est requis'
    }),
    last_name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Le nom doit contenir au moins 2 caractères',
      'string.max': 'Le nom ne peut pas dépasser 100 caractères',
      'any.required': 'Le nom est requis'
    }),
    first_name_arabic: Joi.string().max(100).optional(),
    last_name_arabic: Joi.string().max(100).optional(),
    birth_date: Joi.date().max('now').required().messages({
      'date.max': 'La date de naissance ne peut pas être dans le futur',
      'any.required': 'La date de naissance est requise'
    }),
    gender: Joi.string().valid('BOY', 'GIRL').required().messages({
      'any.only': 'Le genre doit être "BOY" ou "GIRL"',
      'any.required': 'Le genre est requis'
    }),
    class_level_id: Joi.string().uuid().optional(),
    academic_year_id: Joi.string().uuid().required().messages({
      'string.uuid': 'ID année académique invalide',
      'any.required': 'L\'année académique est requise'
    }),
    enrollment_date: Joi.date().max('now').required().messages({
      'date.max': 'La date d\'inscription ne peut pas être dans le futur',
      'any.required': 'La date d\'inscription est requise'
    }),
    allergies: Joi.array().items(Joi.string()).optional(),
    medical_conditions: Joi.array().items(Joi.string()).optional(),
    medications: Joi.array().items(Joi.string()).optional(),
    doctor_name: Joi.string().max(200).optional(),
    doctor_phone: Joi.string().pattern(/^\+212[5-7]\d{8}$/).optional(),
    language_spoken_at_home: Joi.string().valid('FRENCH', 'ARABIC', 'BOTH', 'OTHER').default('FRENCH'),
    previous_school_experience: Joi.string().max(1000).optional(),
    special_needs: Joi.string().max(1000).optional(),
    additional_notes: Joi.string().max(1000).optional(),
    photo_permission: Joi.boolean().default(false),
    data_processing_consent: Joi.boolean().required().messages({
      'any.required': 'Le consentement de traitement des données est requis'
    })
  }),

  // Enhanced payment schema (École Nid Douillet)
  payment: Joi.object({
    child_id: Joi.string().uuid().required().messages({
      'string.uuid': 'ID enfant invalide',
      'any.required': 'L\'ID enfant est requis'
    }),
    academic_year_id: Joi.string().uuid().required().messages({
      'string.uuid': 'ID année académique invalide',
      'any.required': 'L\'année académique est requise'
    }),
    payment_date: Joi.date().max('now').required().messages({
      'date.max': 'La date de paiement ne peut pas être dans le futur',
      'any.required': 'La date de paiement est requise'
    }),
    due_date: Joi.date().optional(),
    type: Joi.string().valid('ENROLLMENT', 'MONTHLY', 'NORMAL', 'CARE_SERVICES', 'MIXED').required(),
    enrollment_fee: Joi.number().min(0).precision(2).default(0),
    monthly_fee: Joi.number().min(0).precision(2).default(0),
    normal_fee: Joi.number().min(0).precision(2).default(0),
    care_service_fee: Joi.number().min(0).precision(2).default(0),
    total_amount: Joi.number().min(0.01).precision(2).required().messages({
      'number.min': 'Le montant total doit être supérieur à 0',
      'any.required': 'Le montant total est requis'
    }),
    morning_care_fee: Joi.number().min(0).precision(2).default(0),
    lunch_service_fee: Joi.number().min(0).precision(2).default(0),
    wednesday_care_fee: Joi.number().min(0).precision(2).default(0),
    evening_care_fee: Joi.number().min(0).precision(2).default(0),
    payment_method: Joi.string().valid('CASH', 'BANK_TRANSFER', 'CHECK', 'CARD').optional(),
    receipt_number: Joi.string().max(100).optional(),
    notes: Joi.string().max(1000).optional()
  }).custom((value, helpers) => {
    // Validate fee breakdown equals total amount
    const feeSum = (value.enrollment_fee || 0) + (value.monthly_fee || 0) + 
                   (value.normal_fee || 0) + (value.care_service_fee || 0);
    
    if (Math.abs(feeSum - value.total_amount) > 0.01) {
      return helpers.error('custom.feeBreakdown');
    }
    
    // Validate care service fee breakdown
    const careServiceSum = (value.morning_care_fee || 0) + (value.lunch_service_fee || 0) + 
                          (value.wednesday_care_fee || 0) + (value.evening_care_fee || 0);
    
    if (Math.abs(careServiceSum - (value.care_service_fee || 0)) > 0.01) {
      return helpers.error('custom.careServiceBreakdown');
    }
    
    return value;
  }, 'Fee breakdown validation').messages({
    'custom.feeBreakdown': 'La somme des frais détaillés doit égaler le montant total',
    'custom.careServiceBreakdown': 'La somme des frais de garderie doit égaler le montant des services de garde'
  }),

  // Care services enrollment
  careServicesEnrollment: Joi.object({
    child_id: Joi.string().uuid().required(),
    academic_year_id: Joi.string().uuid().required(),
    morning_care: Joi.boolean().default(false),
    lunch_service: Joi.boolean().default(false),
    wednesday_care: Joi.boolean().default(false),
    evening_care: Joi.boolean().default(false),
    start_date: Joi.date().required(),
    end_date: Joi.date().greater(Joi.ref('start_date')).optional(),
    notes: Joi.string().max(1000).optional()
  }),

  // Academic year schema
  academicYear: Joi.object({
    name: Joi.string().pattern(/^\d{4}-\d{4}$/).required().messages({
      'string.pattern.base': 'Le nom doit être au format YYYY-YYYY (ex: 2024-2025)'
    }),
    start_date: Joi.date().required(),
    end_date: Joi.date().greater(Joi.ref('start_date')).required().messages({
      'date.greater': 'La date de fin doit être après la date de début'
    }),
    enrollment_open_date: Joi.date().optional(),
    enrollment_close_date: Joi.date().greater(Joi.ref('enrollment_open_date')).optional()
  }),

  // Enrollment form (public website)
  enrollmentForm: Joi.object({
    // Child information
    child_first_name: Joi.string().min(2).max(100).required(),
    child_last_name: Joi.string().min(2).max(100).required(),
    child_first_name_arabic: Joi.string().max(100).optional(),
    child_last_name_arabic: Joi.string().max(100).optional(),
    child_birth_date: Joi.date().max('now').required(),
    child_gender: Joi.string().valid('BOY', 'GIRL').required(),
    desired_class_level: Joi.string().valid('TPS', 'PS', 'MS', 'GS').required(),
    
    // Parent information
    parent_full_name: Joi.string().min(2).max(200).required(),
    parent_full_name_arabic: Joi.string().max(200).optional(),
    parent_email: Joi.string().email().required(),
    parent_phone: Joi.string().pattern(/^\+212[5-7]\d{8}$/).required(),
    parent_relationship: Joi.string().valid('MOTHER', 'FATHER', 'GUARDIAN').required(),
    
    // Emergency contact
    emergency_contact_name: Joi.string().min(2).max(200).required(),
    emergency_contact_phone: Joi.string().pattern(/^\+212[5-7]\d{8}$/).required(),
    emergency_contact_relationship: Joi.string().max(100).required(),
    
    // Health information
    allergies: Joi.string().max(1000).optional(),
    medical_conditions: Joi.string().max(1000).optional(),
    medications: Joi.string().max(1000).optional(),
    doctor_name: Joi.string().max(200).optional(),
    doctor_phone: Joi.string().pattern(/^\+212[5-7]\d{8}$/).optional(),
    
    // Care services interest
    interested_in_morning_care: Joi.boolean().default(false),
    interested_in_evening_care: Joi.boolean().default(false),
    interested_in_wednesday_care: Joi.boolean().default(false),
    
    // Additional information
    previous_school_experience: Joi.string().max(1000).optional(),
    special_needs: Joi.string().max(1000).optional(),
    language_spoken_at_home: Joi.string().valid('FRENCH', 'ARABIC', 'BOTH', 'OTHER').default('FRENCH'),
    additional_notes: Joi.string().max(1000).optional(),
    
    // Legal consents
    terms_accepted: Joi.boolean().valid(true).required().messages({
      'any.only': 'L\'acceptation des conditions est requise'
    }),
    photo_permission: Joi.boolean().default(false),
    data_processing_consent: Joi.boolean().valid(true).required().messages({
      'any.only': 'Le consentement de traitement des données est requis'
    })
  }),

  // Query parameters for filtering and pagination
  queryParams: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('asc'),
    search: Joi.string().max(100).optional(),
    status: Joi.string().optional(),
    class_level: Joi.string().valid('TPS', 'PS', 'MS', 'GS').optional(),
    academic_year_id: Joi.string().uuid().optional(),
    gender: Joi.string().valid('BOY', 'GIRL').optional(),
    start_date: Joi.date().optional(),
    end_date: Joi.date().min(Joi.ref('start_date')).optional()
  })
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation error', {
        property,
        errors,
        originalData: req[property]
      });

      return res.status(400).json({
        success: false,
        message: 'Données de validation invalides',
        code: 'VALIDATION_ERROR',
        errors
      });
    }

    // Replace the original data with validated and sanitized data
    req[property] = value;
    next();
  };
};

// Specific validation middleware for common use cases
const validateLogin = validate(schemas.login);
const validateDirector = validate(schemas.director);
const validateParent = validate(schemas.parent);
const validateChild = validate(schemas.child);
const validatePayment = validate(schemas.payment);
const validateCareServicesEnrollment = validate(schemas.careServicesEnrollment);
const validateAcademicYear = validate(schemas.academicYear);
const validateEnrollmentForm = validate(schemas.enrollmentForm);
const validateQueryParams = validate(schemas.queryParams, 'query');

// Custom validation for École-specific business rules
const validateAgeForClassLevel = async (req, res, next) => {
  try {
    if (req.body.birth_date && req.body.academic_year_id) {
      const { ecoleQueries } = require('../config/database');
      
      // Calculate age and determine suggested class level
      const ageResult = await ecoleQueries.calculateAgeOnCutoffDate(
        req.body.birth_date,
        req.body.academic_year_id
      );
      
      const classLevelResult = await ecoleQueries.determineClassLevelByAge(
        req.body.birth_date,
        req.body.academic_year_id
      );
      
      // Add calculated data to request for use in controller
      req.calculatedAge = ageResult;
      req.suggestedClassLevel = classLevelResult;
    }
    
    next();
  } catch (error) {
    logger.error('Age validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Erreur de validation de l\'âge',
      code: 'AGE_VALIDATION_ERROR'
    });
  }
};

// Validate academic year dates (September-June)
const validateAcademicYearDates = (req, res, next) => {
  if (req.body.start_date && req.body.end_date) {
    const startDate = new Date(req.body.start_date);
    const endDate = new Date(req.body.end_date);
    
    // Check if start date is in September
    if (startDate.getMonth() !== 8) { // September is month 8 (0-indexed)
      return res.status(400).json({
        success: false,
        message: 'L\'année académique doit commencer en septembre',
        code: 'INVALID_ACADEMIC_YEAR_START'
      });
    }
    
    // Check if end date is in June of the following year
    if (endDate.getMonth() !== 5 || endDate.getFullYear() !== startDate.getFullYear() + 1) {
      return res.status(400).json({
        success: false,
        message: 'L\'année académique doit se terminer en juin de l\'année suivante',
        code: 'INVALID_ACADEMIC_YEAR_END'
      });
    }
  }
  
  next();
};

// Generic validation middleware that can be used with any Joi schema
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Validation error', {
        url: req.url,
        method: req.method,
        errors: errorDetails,
        userId: req.user?.userId
      });

      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        code: 'VALIDATION_ERROR',
        errors: errorDetails
      });
    }

    // Replace the original data with validated and sanitized data
    req[property] = value;
    next();
  };
};

module.exports = {
  schemas,
  validate,
  validateRequest,
  validateLogin,
  validateDirector,
  validateParent,
  validateChild,
  validatePayment,
  validateCareServicesEnrollment,
  validateAcademicYear,
  validateEnrollmentForm,
  validateQueryParams,
  validateAgeForClassLevel,
  validateAcademicYearDates
};
