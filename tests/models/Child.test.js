/**
 * Tests for Child Data Model - École Nid Douillet
 * 
 * Testing core child management business logic
 */

const {
  createChild,
  getChildById,
  getAllChildren,
  updateChild,
  deleteChild,
  getChildrenStatistics,
  getChildrenByParent
} = require('../../src/models/Child');

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));
jest.mock('../../src/utils/ageCalculation');
jest.mock('../../src/utils/academicYear');

const pool = require('../../src/config/database');
const { calculateAge, determineClassLevel, validateEnrollmentEligibility } = require('../../src/utils/ageCalculation');
const { getCurrentAcademicYear } = require('../../src/utils/academicYear');

describe('Child Data Model', () => {
  
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    pool.connect.mockResolvedValue(mockClient);
    pool.query.mockResolvedValue({ rows: [] });
  });

  describe('createChild', () => {
    const validChildData = {
      firstName: 'Ahmed',
      lastName: 'Benali',
      birthDate: '2021-06-15',
      gender: 'M',
      academicYearId: 'academic-year-id'
    };

    const mockAcademicYear = {
      id: 'academic-year-id',
      name: '2024-2025',
      start_date: '2024-09-01',
      end_date: '2025-06-30'
    };

    const mockAgeInfo = {
      years: 3,
      months: 3,
      formatted: '3 ans et 3 mois'
    };

    const mockClassInfo = {
      classLevel: 'Petite Section',
      classCode: 'PS',
      isEligible: true
    };

    const mockEligibility = {
      eligible: true,
      reasons: ['Éligible pour l\'inscription']
    };

    beforeEach(() => {
      calculateAge.mockReturnValue(mockAgeInfo);
      determineClassLevel.mockReturnValue(mockClassInfo);
      validateEnrollmentEligibility.mockReturnValue(mockEligibility);
    });

    test('should create child successfully', async () => {
      // Mock database responses
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [mockAcademicYear] }) // Academic year query
        .mockResolvedValueOnce({ rows: [{ id: 'class-level-id' }] }) // Class level query
        .mockResolvedValueOnce({ // Insert child
          rows: [{
            id: 'child-id',
            first_name: 'Ahmed',
            last_name: 'Benali',
            birth_date: '2021-06-15',
            gender: 'M',
            class_level_id: 'class-level-id',
            academic_year_id: 'academic-year-id'
          }]
        })
        .mockResolvedValueOnce(); // COMMIT

      const result = await createChild(validChildData, 'creator-id');

      expect(result.success).toBe(true);
      expect(result.child.first_name).toBe('Ahmed');
      expect(result.child.last_name).toBe('Benali');
      expect(result.message).toContain('créé avec succès');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    test('should validate required fields', async () => {
      const invalidData = { firstName: 'Ahmed' }; // Missing required fields

      await expect(createChild(invalidData, 'creator-id')).rejects.toThrow('obligatoire');
    });

    test('should validate birth date', async () => {
      const invalidData = {
        ...validChildData,
        birthDate: 'invalid-date'
      };

      await expect(createChild(invalidData, 'creator-id')).rejects.toThrow('Date de naissance invalide');
    });

    test('should check academic year exists', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Academic year not found

      await expect(createChild(validChildData, 'creator-id')).rejects.toThrow('Année académique non trouvée');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('should check enrollment eligibility', async () => {
      validateEnrollmentEligibility.mockReturnValue({
        eligible: false,
        reasons: ['Enfant trop jeune']
      });

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [mockAcademicYear] }); // Academic year query

      await expect(createChild(validChildData, 'creator-id')).rejects.toThrow('Enfant non éligible');
    });

    test('should handle class level not found', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [mockAcademicYear] }) // Academic year query
        .mockResolvedValueOnce({ rows: [] }); // Class level not found

      await expect(createChild(validChildData, 'creator-id')).rejects.toThrow('Niveau de classe PS non trouvé');
    });
  });

  describe('getChildById', () => {
    test('should return child with full information', async () => {
      const mockChild = {
        id: 'child-id',
        first_name: 'Ahmed',
        last_name: 'Benali',
        birth_date: '2021-06-15',
        class_level_name: 'Petite Section',
        class_level_code: 'PS',
        academic_year_name: '2024-2025'
      };

      pool.query.mockResolvedValue({ rows: [mockChild] });
      calculateAge.mockReturnValue({ years: 3, formatted: '3 ans' });
      determineClassLevel.mockReturnValue({ classLevel: 'Petite Section' });

      const result = await getChildById('child-id');

      expect(result.success).toBe(true);
      expect(result.child.first_name).toBe('Ahmed');
      expect(result.child.currentAge).toBeDefined();
      expect(result.child.currentClassInfo).toBeDefined();
    });

    test('should handle child not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await expect(getChildById('invalid-id')).rejects.toThrow('Enfant non trouvé');
    });
  });

  describe('getAllChildren', () => {
    test('should return children with pagination', async () => {
      const mockChildren = [
        {
          id: 'child-1',
          first_name: 'Ahmed',
          last_name: 'Benali',
          birth_date: '2021-06-15',
          class_level_name: 'Petite Section'
        }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: mockChildren }) // Main query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count query

      calculateAge.mockReturnValue({ formatted: '3 ans' });

      const result = await getAllChildren();

      expect(result.success).toBe(true);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].currentAge).toBe('3 ans');
      expect(result.pagination.total).toBe(1);
    });

    test('should handle filtering options', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const options = {
        academicYearId: 'academic-year-id',
        classLevelId: 'class-level-id',
        gender: 'M',
        search: 'Ahmed'
      };

      await getAllChildren(options);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND c.academic_year_id = $1'),
        expect.arrayContaining(['academic-year-id'])
      );
    });
  });

  describe('updateChild', () => {
    test('should update child successfully', async () => {
      const mockChild = {
        id: 'child-id',
        first_name: 'Ahmed',
        last_name: 'Benali'
      };

      // Mock getChildById for initial check
      pool.query.mockResolvedValueOnce({ rows: [mockChild] });

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [mockChild] }) // Update query
        .mockResolvedValueOnce(); // COMMIT

      // Mock getChildById for final result
      pool.query.mockResolvedValueOnce({ rows: [mockChild] });
      calculateAge.mockReturnValue({ formatted: '3 ans' });
      determineClassLevel.mockReturnValue({ classLevel: 'Petite Section' });

      const updates = { first_name: 'Ahmed Updated' };
      const result = await updateChild('child-id', updates, 'updater-id');

      expect(result.success).toBe(true);
      expect(result.message).toContain('mises à jour avec succès');
    });

    test('should validate allowed fields', async () => {
      const updates = { invalid_field: 'value' };

      await expect(updateChild('child-id', updates, 'updater-id')).rejects.toThrow('Aucun champ valide');
    });
  });

  describe('deleteChild', () => {
    test('should soft delete child successfully', async () => {
      const mockChild = {
        id: 'child-id',
        first_name: 'Ahmed',
        last_name: 'Benali'
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [mockChild] }) // Check child exists
        .mockResolvedValueOnce() // Soft delete
        .mockResolvedValueOnce(); // COMMIT

      const result = await deleteChild('child-id', 'deleter-id');

      expect(result.success).toBe(true);
      expect(result.message).toContain('supprimé avec succès');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE children SET deleted_at = NOW()'),
        ['child-id']
      );
    });

    test('should handle child not found', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Child not found

      await expect(deleteChild('invalid-id', 'deleter-id')).rejects.toThrow('Enfant non trouvé');
    });
  });

  describe('getChildrenStatistics', () => {
    test('should return children statistics', async () => {
      const mockStats = [
        {
          count_per_class: '15',
          boys: '8',
          girls: '7',
          class_level: 'Petite Section',
          class_code: 'PS'
        },
        {
          count_per_class: '12',
          boys: '6',
          girls: '6',
          class_level: 'Moyenne Section',
          class_code: 'MS'
        }
      ];

      pool.query.mockResolvedValue({ rows: mockStats });

      const result = await getChildrenStatistics();

      expect(result.success).toBe(true);
      expect(result.statistics.total).toBe(27);
      expect(result.statistics.boys).toBe(14);
      expect(result.statistics.girls).toBe(13);
      expect(result.statistics.byClass).toHaveLength(2);
    });
  });

  describe('getChildrenByParent', () => {
    test('should return children for a parent', async () => {
      const mockChildren = [
        {
          id: 'child-1',
          first_name: 'Ahmed',
          last_name: 'Benali',
          birth_date: '2021-06-15',
          class_level_name: 'Petite Section'
        }
      ];

      pool.query.mockResolvedValue({ rows: mockChildren });
      calculateAge.mockReturnValue({ formatted: '3 ans' });

      const result = await getChildrenByParent('parent-id');

      expect(result.success).toBe(true);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].currentAge).toBe('3 ans');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pc.parent_id = $1'),
        ['parent-id']
      );
    });
  });
});
