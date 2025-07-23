// École Nid Douillet - Utility Helper Functions
// Common utility functions for the École Nid Douillet API

const crypto = require('crypto');
const { logger } = require('../config/database');

/**
 * Generate a secure random string
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Format French phone number
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle Moroccan format
  if (cleaned.startsWith('212')) {
    // International format: +212 6XX XX XX XX
    const number = cleaned.substring(3);
    if (number.length === 9) {
      return `+212 ${number.substring(0, 1)} ${number.substring(1, 3)} ${number.substring(3, 5)} ${number.substring(5, 7)} ${number.substring(7, 9)}`;
    }
  } else if (cleaned.startsWith('0')) {
    // National format: 06XX XX XX XX
    if (cleaned.length === 10) {
      return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}`;
    }
  }
  
  return phone; // Return original if can't format
};

/**
 * Validate Moroccan phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid
 */
const isValidMoroccanPhone = (phone) => {
  if (!phone) return false;
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Check international format (+212 6XX XXX XXX)
  if (cleaned.startsWith('212')) {
    const number = cleaned.substring(3);
    return number.length === 9 && number.startsWith('6');
  }
  
  // Check national format (06XX XXX XXX)
  if (cleaned.startsWith('0')) {
    return cleaned.length === 10 && cleaned.startsWith('06');
  }
  
  return false;
};

/**
 * Format currency amount for École Nid Douillet (MAD)
 * @param {number} amount - Amount in centimes
 * @param {boolean} showCurrency - Whether to show currency symbol
 * @returns {string} Formatted amount
 */
const formatCurrency = (amount, showCurrency = true) => {
  if (typeof amount !== 'number') return '0,00';
  
  const formatted = (amount / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return showCurrency ? `${formatted} MAD` : formatted;
};

/**
 * Parse currency amount to centimes
 * @param {string|number} amount - Amount string or number
 * @returns {number} Amount in centimes
 */
const parseCurrency = (amount) => {
  if (typeof amount === 'number') return Math.round(amount * 100);
  if (typeof amount !== 'string') return 0;
  
  // Remove currency symbols and spaces
  const cleaned = amount.replace(/[^\d,.-]/g, '');
  const number = parseFloat(cleaned.replace(',', '.'));
  
  return isNaN(number) ? 0 : Math.round(number * 100);
};

/**
 * Calculate age in years, months, and days
 * @param {Date} birthDate - Birth date
 * @param {Date} referenceDate - Reference date (default: today)
 * @returns {Object} Age object with years, months, days
 */
const calculateAge = (birthDate, referenceDate = new Date()) => {
  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);
  
  let years = reference.getFullYear() - birth.getFullYear();
  let months = reference.getMonth() - birth.getMonth();
  let days = reference.getDate() - birth.getDate();
  
  if (days < 0) {
    months--;
    const lastMonth = new Date(reference.getFullYear(), reference.getMonth(), 0);
    days += lastMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return { years, months, days };
};

/**
 * Get academic year for a given date (September to June)
 * @param {Date} date - Date to check
 * @returns {string} Academic year (e.g., "2024-2025")
 */
const getAcademicYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  
  if (month >= 9) {
    // September to December: current year to next year
    return `${year}-${year + 1}`;
  } else {
    // January to June: previous year to current year
    return `${year - 1}-${year}`;
  }
};

/**
 * Check if a date is within the academic year
 * @param {Date} date - Date to check
 * @param {string} academicYear - Academic year (e.g., "2024-2025")
 * @returns {boolean} Is within academic year
 */
const isWithinAcademicYear = (date, academicYear) => {
  const [startYear, endYear] = academicYear.split('-').map(Number);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // September to December of start year
  if (year === startYear && month >= 9) return true;
  
  // January to June of end year
  if (year === endYear && month <= 6) return true;
  
  return false;
};

/**
 * Map payment month to academic month (July/August -> September)
 * @param {Date} paymentDate - Payment date
 * @returns {Date} Academic month date
 */
const mapPaymentToAcademicMonth = (paymentDate) => {
  const date = new Date(paymentDate);
  const month = date.getMonth() + 1;
  
  // July (7) and August (8) payments are mapped to September
  if (month === 7 || month === 8) {
    const academicYear = getAcademicYear(date);
    const [startYear] = academicYear.split('-').map(Number);
    return new Date(startYear, 8, 1); // September 1st
  }
  
  return date;
};

/**
 * Generate pagination metadata
 * @param {number} total - Total number of items
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const generatePagination = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null
  };
};

/**
 * Sanitize string for database queries
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Generate slug from string (for URLs)
 * @param {string} str - String to convert
 * @returns {string} URL-friendly slug
 */
const generateSlug = (str) => {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate initials from name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Initials
 */
const generateInitials = (firstName, lastName) => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last;
};

/**
 * Delay execution (for testing or rate limiting)
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback
 */
const safeJsonParse = (jsonString, fallback = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('JSON parse failed', { jsonString, error: error.message });
    return fallback;
  }
};

/**
 * Deep clone object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
};

module.exports = {
  generateSecureToken,
  formatPhoneNumber,
  isValidMoroccanPhone,
  formatCurrency,
  parseCurrency,
  calculateAge,
  getAcademicYear,
  isWithinAcademicYear,
  mapPaymentToAcademicMonth,
  generatePagination,
  sanitizeString,
  generateSlug,
  isValidEmail,
  generateInitials,
  delay,
  safeJsonParse,
  deepClone
};
