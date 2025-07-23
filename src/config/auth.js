// École Nid Douillet - Authentication Configuration
// JWT and security configuration

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { logger } = require('./database');

// JWT Configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'ecole-nid-douillet-super-secret-key-change-in-production',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'ecole-nid-douillet-refresh-secret-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  issuer: 'ecole-nid-douillet',
  audience: 'ecole-nid-douillet-users'
};

// Password Configuration
const PASSWORD_CONFIG = {
  saltRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false // École context - keep simple for parents
};

// Role definitions for École Nid Douillet
const ROLES = {
  DIRECTOR: 'DIRECTOR',
  PARENT: 'PARENT'
};

// Permissions for each role
const PERMISSIONS = {
  [ROLES.DIRECTOR]: [
    // Children management
    'children:read',
    'children:create',
    'children:update',
    'children:delete',
    'children:export',
    
    // Parent management
    'parents:read',
    'parents:create',
    'parents:update',
    'parents:delete',
    'parents:export',
    
    // Academic year management
    'academic-years:read',
    'academic-years:create',
    'academic-years:update',
    'academic-years:delete',
    
    // Financial management
    'payments:read',
    'payments:create',
    'payments:update',
    'payments:delete',
    'payments:export',
    'expenses:read',
    'expenses:create',
    'expenses:update',
    'expenses:delete',
    'financial-reports:read',
    'financial-reports:export',
    
    // Care services
    'care-services:read',
    'care-services:create',
    'care-services:update',
    'care-services:delete',
    'care-services:manage-enrollment',
    
    // Analytics and reporting
    'analytics:read',
    'analytics:export',
    'reports:read',
    'reports:generate',
    'reports:export',
    'website-analytics:read',
    
    // Content management
    'content:read',
    'content:update',
    'content:publish',
    
    // Notifications
    'notifications:read',
    'notifications:send',
    'notifications:manage-templates',
    
    // System settings
    'settings:read',
    'settings:update',
    'users:manage'
  ],
  
  [ROLES.PARENT]: [
    // Own children only
    'own-children:read',
    'own-children:update-emergency-contacts',
    'own-children:update-pickup-authorizations',
    
    // Own family data
    'own-family:read',
    'own-family:update-contact-info',
    'own-family:update-preferences',
    
    // Care services for own children
    'own-care-services:read',
    'own-care-services:update-preferences',
    
    // Own payments
    'own-payments:read',
    'own-payments:download-receipts',
    
    // Communication
    'messages:read',
    'messages:send',
    
    // Public content
    'public-content:read'
  ]
};

// Generate JWT token
const generateToken = (payload, options = {}) => {
  const defaultOptions = {
    expiresIn: JWT_CONFIG.expiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  };
  
  return jwt.sign(payload, JWT_CONFIG.secret, { ...defaultOptions, ...options });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.refreshSecret, {
    expiresIn: JWT_CONFIG.refreshExpiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
  } catch (error) {
    logger.warn('JWT verification failed', { error: error.message });
    throw new Error('Invalid token');
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_CONFIG.refreshSecret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
  } catch (error) {
    logger.warn('Refresh token verification failed', { error: error.message });
    throw new Error('Invalid refresh token');
  }
};

// Hash password
const hashPassword = async (password) => {
  try {
    return await bcrypt.hash(password, PASSWORD_CONFIG.saltRounds);
  } catch (error) {
    logger.error('Password hashing failed', { error: error.message });
    throw new Error('Password hashing failed');
  }
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    logger.error('Password comparison failed', { error: error.message });
    throw new Error('Password comparison failed');
  }
};

// Validate password strength
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < PASSWORD_CONFIG.minLength) {
    errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_CONFIG.minLength} caractères`);
  }
  
  if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une lettre majuscule');
  }
  
  if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une lettre minuscule');
  }
  
  if (PASSWORD_CONFIG.requireNumbers && !/\d/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }
  
  if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Check if user has permission
const hasPermission = (userRole, requiredPermission) => {
  const userPermissions = PERMISSIONS[userRole] || [];
  return userPermissions.includes(requiredPermission);
};

// Check if user can access child data
const canAccessChild = (user, childId) => {
  // Directors can access all children
  if (user.role === ROLES.DIRECTOR) {
    return true;
  }
  
  // Parents can only access their own children
  if (user.role === ROLES.PARENT) {
    return user.childrenIds && user.childrenIds.includes(childId);
  }
  
  return false;
};

// Generate session data for user
const generateSessionData = (user, role) => {
  const sessionData = {
    userId: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role,
    permissions: PERMISSIONS[role] || [],
    loginTime: new Date().toISOString()
  };
  
  // Add role-specific data
  if (role === ROLES.PARENT && user.childrenIds) {
    sessionData.childrenIds = user.childrenIds;
  }
  
  return sessionData;
};

// Security headers configuration
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Rate limiting configuration
const RATE_LIMITS = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false
  },
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Trop de requêtes. Veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false
  },
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window for public endpoints
    message: 'Trop de requêtes. Veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false
  }
};

module.exports = {
  JWT_CONFIG,
  PASSWORD_CONFIG,
  ROLES,
  PERMISSIONS,
  SECURITY_HEADERS,
  RATE_LIMITS,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  validatePassword,
  hasPermission,
  canAccessChild,
  generateSessionData
};
