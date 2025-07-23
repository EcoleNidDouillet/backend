/**
 * Tests for Academic Year Management System - École Nid Douillet
 * 
 * Testing French kindergarten academic year system with Moroccan context
 */

const {
  createAcademicYear,
  getCurrentAcademicYear,
  setActiveAcademicYear,
  getAllAcademicYears,
  updateAcademicYear,
  isEnrollmentPeriodOpen,
  getAcademicYearStatus,
  getDaysUntilStart,
  getDaysUntilEnd,
  generateAcademicYears,
  getAcademicYearByName,
  transitionToNextAcademicYear
} = require('../../src/utils/academicYear');

// Mock the database pool
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  }))
}));

const pool = require('../../src/config/database');

describe('Academic Year Management System', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAcademicYear', () => {
    test('should create academic year successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          name: '2024-2025',
          start_date: '2024-09-01',
          end_date: '2025-06-30',
          enrollment_open_date: '2024-03-01',
          enrollment_close_date: '2024-07-31',
          is_active: false
        }]
      };

      pool.query.mockResolvedValue(mockResult);

      const result = await createAcademicYear('2024');

      expect(result.success).toBe(true);
      expect(result.academicYear.name).toBe('2024-2025');
      expect(result.message).toContain('créée avec succès');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO academic_years'),
        expect.arrayContaining(['2024-2025', '2024-09-01', '2025-06-30'])
      );
    });

    test('should handle duplicate academic year error', async () => {
      const error = new Error('Duplicate key');
      error.code = '23505';
      pool.query.mockRejectedValue(error);

      await expect(createAcademicYear('2024')).rejects.toThrow('existe déjà');
    });

    test('should validate start year', async () => {
      await expect(createAcademicYear('invalid')).rejects.toThrow('Invalid start year');
      await expect(createAcademicYear('2019')).rejects.toThrow('Invalid start year');
      await expect(createAcademicYear('2051')).rejects.toThrow('Invalid start year');
    });

    test('should accept custom enrollment dates', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          name: '2024-2025',
          start_date: '2024-09-01',
          end_date: '2025-06-30',
          enrollment_open_date: '2024-02-01',
          enrollment_close_date: '2024-08-15',
          is_active: false
        }]
      };

      pool.query.mockResolvedValue(mockResult);

      const options = {
        enrollmentOpenDate: new Date(2024, 1, 1), // February 1
        enrollmentCloseDate: new Date(2024, 7, 15) // August 15
      };

      await createAcademicYear('2024', options);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO academic_years'),
        expect.arrayContaining(['2024-2025', '2024-09-01', '2025-06-30', '2024-02-01', '2024-08-15'])
      );
    });
  });

  describe('getCurrentAcademicYear', () => {
    test('should return current active academic year', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          name: '2024-2025',
          start_date: '2024-09-01',
          end_date: '2025-06-30',
          enrollment_open_date: '2024-03-01',
          enrollment_close_date: '2024-07-31',
          is_active: true
        }]
      };

      pool.query.mockResolvedValue(mockResult);

      const result = await getCurrentAcademicYear();

      expect(result.success).toBe(true);
      expect(result.academicYear.name).toBe('2024-2025');
      expect(result.academicYear.is_active).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true')
      );
    });

    test('should throw error when no active academic year found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(getCurrentAcademicYear()).rejects.toThrow('Aucune année académique active');
    });
  });

  describe('setActiveAcademicYear', () => {
    test('should set academic year as active', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // Deactivate all
        .mockResolvedValueOnce({ // Activate specific
          rows: [{
            id: 'test-id',
            name: '2024-2025',
            is_active: true
          }]
        })
        .mockResolvedValueOnce(); // COMMIT

      pool.connect.mockResolvedValue(mockClient);

      const result = await setActiveAcademicYear('test-id');

      expect(result.success).toBe(true);
      expect(result.academicYear.is_active).toBe(true);
      expect(result.message).toContain('activée avec succès');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('UPDATE academic_years SET is_active = false');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    test('should handle academic year not found', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // Deactivate all
        .mockResolvedValueOnce({ rows: [] }) // No rows found
        .mockResolvedValueOnce(); // ROLLBACK

      pool.connect.mockResolvedValue(mockClient);

      await expect(setActiveAcademicYear('invalid-id')).rejects.toThrow('non trouvée');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getAllAcademicYears', () => {
    test('should return all academic years with statistics', async () => {
      const mockAcademicYears = {
        rows: [{
          id: 'test-id-1',
          name: '2024-2025',
          start_date: '2024-09-01',
          end_date: '2025-06-30',
          total_children: 50,
          total_payments: 100,
          total_revenue: 25000
        }]
      };

      const mockCount = { rows: [{ count: '1' }] };

      pool.query
        .mockResolvedValueOnce(mockAcademicYears)
        .mockResolvedValueOnce(mockCount);

      const result = await getAllAcademicYears();

      expect(result.success).toBe(true);
      expect(result.academicYears).toHaveLength(1);
      expect(result.academicYears[0].total_children).toBe(50);
      expect(result.pagination.total).toBe(1);
    });

    test('should handle pagination options', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const options = { limit: 5, offset: 10, includeStats: false };
      await getAllAcademicYears(options);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [5, 10]
      );
    });
  });

  describe('updateAcademicYear', () => {
    test('should update academic year successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          name: '2024-2025',
          enrollment_open_date: '2024-02-01',
          enrollment_close_date: '2024-08-15'
        }]
      };

      pool.query.mockResolvedValue(mockResult);

      const updates = {
        enrollment_open_date: '2024-02-01',
        enrollment_close_date: '2024-08-15'
      };

      const result = await updateAcademicYear('test-id', updates);

      expect(result.success).toBe(true);
      expect(result.message).toContain('mise à jour avec succès');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE academic_years'),
        expect.arrayContaining(['2024-02-01', '2024-08-15', 'test-id'])
      );
    });

    test('should reject invalid fields', async () => {
      const updates = {
        invalid_field: 'value',
        name: 'should not be allowed'
      };

      await expect(updateAcademicYear('test-id', updates)).rejects.toThrow('Aucun champ valide');
    });

    test('should handle academic year not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const updates = { enrollment_open_date: '2024-02-01' };

      await expect(updateAcademicYear('invalid-id', updates)).rejects.toThrow('non trouvée');
    });
  });

  describe('isEnrollmentPeriodOpen', () => {
    test('should return true when enrollment is open', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const academicYear = {
        enrollment_open_date: yesterday.toISOString().split('T')[0],
        enrollment_close_date: tomorrow.toISOString().split('T')[0]
      };

      expect(isEnrollmentPeriodOpen(academicYear)).toBe(true);
    });

    test('should return false when enrollment is closed', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const academicYear = {
        enrollment_open_date: twoDaysAgo.toISOString().split('T')[0],
        enrollment_close_date: yesterday.toISOString().split('T')[0]
      };

      expect(isEnrollmentPeriodOpen(academicYear)).toBe(false);
    });

    test('should return false when dates are missing', () => {
      const academicYear = {
        enrollment_open_date: null,
        enrollment_close_date: null
      };

      expect(isEnrollmentPeriodOpen(academicYear)).toBe(false);
    });
  });

  describe('getAcademicYearStatus', () => {
    test('should return "upcoming" for future academic year', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const academicYear = {
        start_date: tomorrow.toISOString().split('T')[0],
        end_date: nextMonth.toISOString().split('T')[0],
        enrollment_open_date: null,
        enrollment_close_date: null
      };

      expect(getAcademicYearStatus(academicYear)).toBe('upcoming');
    });

    test('should return "current" for ongoing academic year', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const academicYear = {
        start_date: yesterday.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0]
      };

      expect(getAcademicYearStatus(academicYear)).toBe('current');
    });

    test('should return "past" for completed academic year', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const academicYear = {
        start_date: twoDaysAgo.toISOString().split('T')[0],
        end_date: yesterday.toISOString().split('T')[0]
      };

      expect(getAcademicYearStatus(academicYear)).toBe('past');
    });
  });

  describe('getDaysUntilStart', () => {
    test('should calculate days until start correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const academicYear = {
        start_date: tomorrow.toISOString().split('T')[0]
      };

      const days = getDaysUntilStart(academicYear);
      expect(days).toBe(1);
    });

    test('should return negative for started academic year', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const academicYear = {
        start_date: yesterday.toISOString().split('T')[0]
      };

      const days = getDaysUntilStart(academicYear);
      expect(days).toBe(-1);
    });
  });

  describe('getDaysUntilEnd', () => {
    test('should calculate days until end correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const academicYear = {
        end_date: tomorrow.toISOString().split('T')[0]
      };

      const days = getDaysUntilEnd(academicYear);
      expect(days).toBe(1);
    });
  });

  describe('getAcademicYearByName', () => {
    test('should return academic year by name', async () => {
      const mockResult = {
        rows: [{
          id: 'test-id',
          name: '2024-2025',
          start_date: '2024-09-01',
          end_date: '2025-06-30'
        }]
      };

      pool.query.mockResolvedValue(mockResult);

      const result = await getAcademicYearByName('2024-2025');

      expect(result.success).toBe(true);
      expect(result.academicYear.name).toBe('2024-2025');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name = $1'),
        ['2024-2025']
      );
    });

    test('should handle academic year not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(getAcademicYearByName('2030-2031')).rejects.toThrow('non trouvée');
    });
  });

  describe('generateAcademicYears', () => {
    test('should generate multiple academic years', async () => {
      // Mock successful creation for each year
      const mockResults = [
        { success: true, academicYear: { name: '2024-2025' } },
        { success: true, academicYear: { name: '2025-2026' } },
        { success: true, academicYear: { name: '2026-2027' } }
      ];

      // Mock the createAcademicYear function calls
      const originalCreateAcademicYear = require('../../src/utils/academicYear').createAcademicYear;
      const mockCreateAcademicYear = jest.fn()
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2]);

      // Replace the function temporarily
      require('../../src/utils/academicYear').createAcademicYear = mockCreateAcademicYear;

      const result = await generateAcademicYears(2024, 3);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(3);
      expect(result.academicYears).toHaveLength(3);

      // Restore original function
      require('../../src/utils/academicYear').createAcademicYear = originalCreateAcademicYear;
    });
  });
});
