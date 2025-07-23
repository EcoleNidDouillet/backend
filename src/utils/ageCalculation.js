/**
 * Age Calculation Algorithms for École Nid Douillet
 * 
 * French kindergarten system with Moroccan context
 * - Academic year: September 1 to June 30
 * - Age cutoff: December 31 of the academic year
 * - Class levels: Petite Section (PS), Moyenne Section (MS), Grande Section (GS)
 */

const { format, differenceInYears, differenceInMonths, differenceInDays, parseISO, isValid } = require('date-fns');
const { fr } = require('date-fns/locale');

/**
 * Calculate age at a specific reference date
 * @param {Date|string} birthDate - Child's birth date
 * @param {Date|string} referenceDate - Reference date for age calculation (default: December 31 of current academic year)
 * @returns {Object} Age object with years, months, days, and formatted string
 */
function calculateAge(birthDate, referenceDate = null) {
  try {
    // Parse birth date
    const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
    if (!isValid(birth)) {
      throw new Error('Invalid birth date provided');
    }

    // Set reference date (December 31 of current academic year if not provided)
    let reference;
    if (referenceDate) {
      reference = typeof referenceDate === 'string' ? parseISO(referenceDate) : referenceDate;
      if (!isValid(reference)) {
        throw new Error('Invalid reference date provided');
      }
    } else {
      reference = getAcademicYearCutoffDate();
    }

    // Calculate age components
    const years = differenceInYears(reference, birth);
    const months = differenceInMonths(reference, birth) % 12;
    const days = differenceInDays(reference, new Date(birth.getFullYear() + years, birth.getMonth() + months, birth.getDate()));

    // Format age string in French
    const ageString = formatAgeInFrench(years, months, days);

    return {
      years,
      months,
      days,
      totalMonths: differenceInMonths(reference, birth),
      totalDays: differenceInDays(reference, birth),
      formatted: ageString,
      referenceDate: format(reference, 'yyyy-MM-dd'),
      birthDate: format(birth, 'yyyy-MM-dd')
    };
  } catch (error) {
    throw new Error(`Age calculation failed: ${error.message}`);
  }
}

/**
 * Get the December 31 cutoff date for the current academic year
 * @param {Date|string} date - Optional date to determine academic year (default: today)
 * @returns {Date} December 31 of the current academic year
 */
function getAcademicYearCutoffDate(date = new Date()) {
  const currentDate = typeof date === 'string' ? parseISO(date) : date;
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = January)

  // If we're in September-December, cutoff is December 31 of current year
  // If we're in January-August, cutoff is December 31 of current year (same academic year)
  if (currentMonth >= 8) { // September or later
    return new Date(currentYear, 11, 31); // December 31 of current year
  } else {
    return new Date(currentYear, 11, 31); // December 31 of current year
  }
}

/**
 * Determine class level based on age at December 31 cutoff
 * @param {Date|string} birthDate - Child's birth date
 * @param {Date|string} academicYearStart - Academic year start date (optional)
 * @returns {Object} Class level information
 */
function determineClassLevel(birthDate, academicYearStart = null) {
  try {
    const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
    if (!isValid(birth)) {
      throw new Error('Invalid birth date provided');
    }

    // Get the cutoff date for age calculation
    const cutoffDate = academicYearStart ? 
      getAcademicYearCutoffDate(academicYearStart) : 
      getAcademicYearCutoffDate();

    const age = calculateAge(birth, cutoffDate);
    const ageInYears = age.years;

    // École Nid Douillet class level rules (French system)
    let classLevel, classCode, ageRange, description;

    if (ageInYears >= 2 && ageInYears < 4) {
      classLevel = 'Petite Section';
      classCode = 'PS';
      ageRange = '2-4 ans';
      description = 'Première année de maternelle - Développement de l\'autonomie et socialisation';
    } else if (ageInYears >= 4 && ageInYears < 5) {
      classLevel = 'Moyenne Section';
      classCode = 'MS';
      ageRange = '4-5 ans';
      description = 'Deuxième année de maternelle - Développement du langage et motricité fine';
    } else if (ageInYears >= 5 && ageInYears < 6) {
      classLevel = 'Grande Section';
      classCode = 'GS';
      ageRange = '5-6 ans';
      description = 'Troisième année de maternelle - Préparation à l\'école primaire';
    } else if (ageInYears < 2) {
      classLevel = 'Trop jeune';
      classCode = 'TJ';
      ageRange = 'Moins de 2 ans';
      description = 'L\'enfant est trop jeune pour l\'inscription en maternelle';
    } else {
      classLevel = 'Trop âgé';
      classCode = 'TA';
      ageRange = 'Plus de 6 ans';
      description = 'L\'enfant devrait être en école primaire';
    }

    return {
      classLevel,
      classCode,
      ageRange,
      description,
      ageAtCutoff: age,
      cutoffDate: format(cutoffDate, 'yyyy-MM-dd'),
      isEligible: ageInYears >= 2 && ageInYears < 6,
      academicYear: getAcademicYearName(cutoffDate)
    };
  } catch (error) {
    throw new Error(`Class level determination failed: ${error.message}`);
  }
}

/**
 * Get academic year name from a date
 * @param {Date|string} date - Date within the academic year
 * @returns {string} Academic year name (e.g., "2024-2025")
 */
function getAcademicYearName(date = new Date()) {
  const currentDate = typeof date === 'string' ? parseISO(date) : date;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-based

  if (month >= 8) { // September or later
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Format age in French
 * @param {number} years - Years
 * @param {number} months - Months
 * @param {number} days - Days
 * @returns {string} Formatted age string in French
 */
function formatAgeInFrench(years, months, days) {
  const parts = [];

  if (years > 0) {
    parts.push(years === 1 ? '1 an' : `${years} ans`);
  }

  if (months > 0) {
    parts.push(months === 1 ? '1 mois' : `${months} mois`);
  }

  if (days > 0 && years === 0) { // Only show days if less than 1 year
    parts.push(days === 1 ? '1 jour' : `${days} jours`);
  }

  if (parts.length === 0) {
    return 'Nouveau-né';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return parts.join(' et ');
  }

  // For 3 parts (unlikely but possible)
  return parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1];
}

/**
 * Calculate age at enrollment for a specific academic year
 * @param {Date|string} birthDate - Child's birth date
 * @param {string} academicYear - Academic year (e.g., "2024-2025")
 * @returns {Object} Age and class level information for enrollment
 */
function calculateEnrollmentAge(birthDate, academicYear) {
  try {
    const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
    if (!isValid(birth)) {
      throw new Error('Invalid birth date provided');
    }

    // Parse academic year
    const [startYear] = academicYear.split('-').map(Number);
    const cutoffDate = new Date(startYear, 11, 31); // December 31 of start year

    const age = calculateAge(birth, cutoffDate);
    const classInfo = determineClassLevel(birth, new Date(startYear, 8, 1)); // September 1

    return {
      ...age,
      ...classInfo,
      academicYear,
      enrollmentEligible: classInfo.isEligible,
      enrollmentDate: format(new Date(startYear, 8, 1), 'yyyy-MM-dd') // September 1
    };
  } catch (error) {
    throw new Error(`Enrollment age calculation failed: ${error.message}`);
  }
}

/**
 * Validate if a child can be enrolled for a specific academic year
 * @param {Date|string} birthDate - Child's birth date
 * @param {string} academicYear - Academic year (e.g., "2024-2025")
 * @returns {Object} Validation result with eligibility and reasons
 */
function validateEnrollmentEligibility(birthDate, academicYear) {
  try {
    const enrollmentInfo = calculateEnrollmentAge(birthDate, academicYear);
    const reasons = [];

    if (!enrollmentInfo.enrollmentEligible) {
      if (enrollmentInfo.ageAtCutoff.years < 2) {
        reasons.push('L\'enfant est trop jeune (moins de 2 ans au 31 décembre)');
      } else if (enrollmentInfo.ageAtCutoff.years >= 6) {
        reasons.push('L\'enfant est trop âgé (6 ans ou plus au 31 décembre)');
      }
    }

    return {
      eligible: enrollmentInfo.enrollmentEligible,
      classLevel: enrollmentInfo.classLevel,
      classCode: enrollmentInfo.classCode,
      ageAtCutoff: enrollmentInfo.ageAtCutoff,
      reasons: reasons.length > 0 ? reasons : ['Éligible pour l\'inscription'],
      academicYear,
      cutoffDate: enrollmentInfo.cutoffDate
    };
  } catch (error) {
    throw new Error(`Enrollment eligibility validation failed: ${error.message}`);
  }
}

module.exports = {
  calculateAge,
  getAcademicYearCutoffDate,
  determineClassLevel,
  getAcademicYearName,
  formatAgeInFrench,
  calculateEnrollmentAge,
  validateEnrollmentEligibility
};
