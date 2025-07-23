/**
 * Tests for Age Calculation Algorithms - École Nid Douillet
 * 
 * Testing French kindergarten system with Moroccan context
 */

const {
  calculateAge,
  getAcademicYearCutoffDate,
  determineClassLevel,
  getAcademicYearName,
  formatAgeInFrench,
  calculateEnrollmentAge,
  validateEnrollmentEligibility
} = require('../../src/utils/ageCalculation');

describe('Age Calculation Algorithms', () => {
  
  describe('calculateAge', () => {
    test('should calculate age correctly for a 3-year-old', () => {
      const birthDate = '2021-06-15';
      const referenceDate = '2024-12-31';
      
      const result = calculateAge(birthDate, referenceDate);
      
      expect(result.years).toBe(3);
      expect(result.months).toBe(6);
      expect(result.formatted).toContain('3 ans');
      expect(result.formatted).toContain('6 mois');
    });

    test('should calculate age for newborn', () => {
      const birthDate = '2024-12-25';
      const referenceDate = '2024-12-31';
      
      const result = calculateAge(birthDate, referenceDate);
      
      expect(result.years).toBe(0);
      expect(result.months).toBe(0);
      expect(result.days).toBe(6);
      expect(result.formatted).toBe('6 jours');
    });

    test('should use academic year cutoff as default reference date', () => {
      const birthDate = '2021-06-15';
      
      const result = calculateAge(birthDate);
      
      expect(result.referenceDate).toMatch(/\d{4}-12-31/);
    });

    test('should handle string and Date inputs', () => {
      const birthDateString = '2021-06-15';
      const birthDateObject = new Date(2021, 5, 15); // Month is 0-based
      const referenceDate = '2024-12-31';
      
      const result1 = calculateAge(birthDateString, referenceDate);
      const result2 = calculateAge(birthDateObject, referenceDate);
      
      expect(result1.years).toBe(result2.years);
      expect(result1.months).toBe(result2.months);
    });

    test('should throw error for invalid birth date', () => {
      expect(() => {
        calculateAge('invalid-date');
      }).toThrow('Age calculation failed');
    });
  });

  describe('getAcademicYearCutoffDate', () => {
    test('should return December 31 of current year when in September', () => {
      const septemberDate = new Date(2024, 8, 15); // September 15, 2024
      
      const cutoff = getAcademicYearCutoffDate(septemberDate);
      
      expect(cutoff.getFullYear()).toBe(2024);
      expect(cutoff.getMonth()).toBe(11); // December (0-based)
      expect(cutoff.getDate()).toBe(31);
    });

    test('should return December 31 of current year when in January', () => {
      const januaryDate = new Date(2024, 0, 15); // January 15, 2024
      
      const cutoff = getAcademicYearCutoffDate(januaryDate);
      
      expect(cutoff.getFullYear()).toBe(2024);
      expect(cutoff.getMonth()).toBe(11); // December (0-based)
      expect(cutoff.getDate()).toBe(31);
    });
  });

  describe('determineClassLevel', () => {
    test('should assign Petite Section for 3-year-old', () => {
      const birthDate = '2021-06-15'; // Will be 3 years old on Dec 31, 2024
      const academicYearStart = '2024-09-01';
      
      const result = determineClassLevel(birthDate, academicYearStart);
      
      expect(result.classLevel).toBe('Petite Section');
      expect(result.classCode).toBe('PS');
      expect(result.isEligible).toBe(true);
      expect(result.ageRange).toBe('2-4 ans');
    });

    test('should assign Moyenne Section for 4-year-old', () => {
      const birthDate = '2020-06-15'; // Will be 4 years old on Dec 31, 2024
      const academicYearStart = '2024-09-01';
      
      const result = determineClassLevel(birthDate, academicYearStart);
      
      expect(result.classLevel).toBe('Moyenne Section');
      expect(result.classCode).toBe('MS');
      expect(result.isEligible).toBe(true);
      expect(result.ageRange).toBe('4-5 ans');
    });

    test('should assign Grande Section for 5-year-old', () => {
      const birthDate = '2019-06-15'; // Will be 5 years old on Dec 31, 2024
      const academicYearStart = '2024-09-01';
      
      const result = determineClassLevel(birthDate, academicYearStart);
      
      expect(result.classLevel).toBe('Grande Section');
      expect(result.classCode).toBe('GS');
      expect(result.isEligible).toBe(true);
      expect(result.ageRange).toBe('5-6 ans');
    });

    test('should mark as too young for 1-year-old', () => {
      const birthDate = '2023-06-15'; // Will be 1 year old on Dec 31, 2024
      const academicYearStart = '2024-09-01';
      
      const result = determineClassLevel(birthDate, academicYearStart);
      
      expect(result.classLevel).toBe('Trop jeune');
      expect(result.classCode).toBe('TJ');
      expect(result.isEligible).toBe(false);
    });

    test('should mark as too old for 6-year-old', () => {
      const birthDate = '2018-06-15'; // Will be 6 years old on Dec 31, 2024
      const academicYearStart = '2024-09-01';
      
      const result = determineClassLevel(birthDate, academicYearStart);
      
      expect(result.classLevel).toBe('Trop âgé');
      expect(result.classCode).toBe('TA');
      expect(result.isEligible).toBe(false);
    });

    test('should include academic year information', () => {
      const birthDate = '2021-06-15';
      const academicYearStart = '2024-09-01';
      
      const result = determineClassLevel(birthDate, academicYearStart);
      
      expect(result.academicYear).toBe('2024-2025');
      expect(result.cutoffDate).toBe('2024-12-31');
    });
  });

  describe('getAcademicYearName', () => {
    test('should return correct academic year for September', () => {
      const septemberDate = new Date(2024, 8, 15); // September 15, 2024
      
      const academicYear = getAcademicYearName(septemberDate);
      
      expect(academicYear).toBe('2024-2025');
    });

    test('should return correct academic year for January', () => {
      const januaryDate = new Date(2024, 0, 15); // January 15, 2024
      
      const academicYear = getAcademicYearName(januaryDate);
      
      expect(academicYear).toBe('2023-2024');
    });

    test('should return correct academic year for June', () => {
      const juneDate = new Date(2024, 5, 15); // June 15, 2024
      
      const academicYear = getAcademicYearName(juneDate);
      
      expect(academicYear).toBe('2023-2024');
    });
  });

  describe('formatAgeInFrench', () => {
    test('should format age with years and months', () => {
      const formatted = formatAgeInFrench(3, 6, 0);
      expect(formatted).toBe('3 ans et 6 mois');
    });

    test('should format single year', () => {
      const formatted = formatAgeInFrench(1, 0, 0);
      expect(formatted).toBe('1 an');
    });

    test('should format multiple years', () => {
      const formatted = formatAgeInFrench(5, 0, 0);
      expect(formatted).toBe('5 ans');
    });

    test('should format single month', () => {
      const formatted = formatAgeInFrench(0, 1, 0);
      expect(formatted).toBe('1 mois');
    });

    test('should format multiple months', () => {
      const formatted = formatAgeInFrench(0, 8, 0);
      expect(formatted).toBe('8 mois');
    });

    test('should format days only for babies', () => {
      const formatted = formatAgeInFrench(0, 0, 15);
      expect(formatted).toBe('15 jours');
    });

    test('should format newborn', () => {
      const formatted = formatAgeInFrench(0, 0, 0);
      expect(formatted).toBe('Nouveau-né');
    });

    test('should not show days when years are present', () => {
      const formatted = formatAgeInFrench(2, 3, 15);
      expect(formatted).toBe('2 ans et 3 mois');
      expect(formatted).not.toContain('jours');
    });
  });

  describe('calculateEnrollmentAge', () => {
    test('should calculate enrollment age for academic year', () => {
      const birthDate = '2021-06-15';
      const academicYear = '2024-2025';
      
      const result = calculateEnrollmentAge(birthDate, academicYear);
      
      expect(result.years).toBe(3);
      expect(result.classLevel).toBe('Petite Section');
      expect(result.academicYear).toBe('2024-2025');
      expect(result.enrollmentEligible).toBe(true);
      expect(result.enrollmentDate).toBe('2024-09-01');
    });

    test('should handle different academic years', () => {
      const birthDate = '2020-06-15';
      const academicYear = '2025-2026';
      
      const result = calculateEnrollmentAge(birthDate, academicYear);
      
      expect(result.years).toBe(5);
      expect(result.classLevel).toBe('Grande Section');
      expect(result.academicYear).toBe('2025-2026');
    });
  });

  describe('validateEnrollmentEligibility', () => {
    test('should validate eligible child', () => {
      const birthDate = '2021-06-15'; // Will be 3 years old
      const academicYear = '2024-2025';
      
      const result = validateEnrollmentEligibility(birthDate, academicYear);
      
      expect(result.eligible).toBe(true);
      expect(result.classLevel).toBe('Petite Section');
      expect(result.classCode).toBe('PS');
      expect(result.reasons).toContain('Éligible pour l\'inscription');
    });

    test('should reject too young child', () => {
      const birthDate = '2023-06-15'; // Will be 1 year old
      const academicYear = '2024-2025';
      
      const result = validateEnrollmentEligibility(birthDate, academicYear);
      
      expect(result.eligible).toBe(false);
      expect(result.classLevel).toBe('Trop jeune');
      expect(result.reasons).toContain('L\'enfant est trop jeune (moins de 2 ans au 31 décembre)');
    });

    test('should reject too old child', () => {
      const birthDate = '2018-06-15'; // Will be 6 years old
      const academicYear = '2024-2025';
      
      const result = validateEnrollmentEligibility(birthDate, academicYear);
      
      expect(result.eligible).toBe(false);
      expect(result.classLevel).toBe('Trop âgé');
      expect(result.reasons).toContain('L\'enfant est trop âgé (6 ans ou plus au 31 décembre)');
    });

    test('should include cutoff date information', () => {
      const birthDate = '2021-06-15';
      const academicYear = '2024-2025';
      
      const result = validateEnrollmentEligibility(birthDate, academicYear);
      
      expect(result.cutoffDate).toBe('2024-12-31');
      expect(result.academicYear).toBe('2024-2025');
    });
  });

  describe('Edge Cases', () => {
    test('should handle leap year birth dates', () => {
      const birthDate = '2020-02-29'; // Leap year
      const referenceDate = '2024-12-31';
      
      const result = calculateAge(birthDate, referenceDate);
      
      expect(result.years).toBe(4);
      expect(result.months).toBe(10);
    });

    test('should handle birth on cutoff date', () => {
      const birthDate = '2021-12-31'; // Born on cutoff date
      const academicYear = '2024-2025';
      
      const result = calculateEnrollmentAge(birthDate, academicYear);
      
      expect(result.years).toBe(3);
      expect(result.classLevel).toBe('Petite Section');
    });

    test('should handle birth one day after cutoff', () => {
      const birthDate = '2022-01-01'; // Born one day after cutoff
      const academicYear = '2024-2025';
      
      const result = calculateEnrollmentAge(birthDate, academicYear);
      
      expect(result.years).toBe(2);
      expect(result.classLevel).toBe('Petite Section');
    });
  });
});
