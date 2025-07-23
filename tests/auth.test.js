// École Nid Douillet - Authentication Tests
// Basic tests for authentication endpoints

const request = require('supertest');
const app = require('../src/app');

describe('Authentication Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body.service).toBe('École Nid Douillet API');
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('École Maternelle Nid Douillet API');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject login without credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });

    it('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });

    it('should reject login with short password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: '123'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('REFRESH_TOKEN_REQUIRED');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ENDPOINT_NOT_FOUND');
    });
  });
});

// Test utility functions
describe('Utility Functions', () => {
  const {
    formatPhoneNumber,
    isValidMoroccanPhone,
    formatCurrency,
    parseCurrency,
    getAcademicYear,
    generateSlug
  } = require('../src/utils/helpers');

  describe('Phone Number Utilities', () => {
    it('should format Moroccan phone numbers correctly', () => {
      expect(formatPhoneNumber('0612345678')).toBe('0612 34 56 78');
      expect(formatPhoneNumber('212612345678')).toBe('+212 6 12 34 56 78');
    });

    it('should validate Moroccan phone numbers', () => {
      expect(isValidMoroccanPhone('0612345678')).toBe(true);
      expect(isValidMoroccanPhone('212612345678')).toBe(true);
      expect(isValidMoroccanPhone('0512345678')).toBe(false);
      expect(isValidMoroccanPhone('invalid')).toBe(false);
    });
  });

  describe('Currency Utilities', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(12345)).toBe('123,45 MAD');
      expect(formatCurrency(12345, false)).toBe('123,45');
    });

    it('should parse currency correctly', () => {
      expect(parseCurrency('123.45')).toBe(12345);
      expect(parseCurrency('123,45 MAD')).toBe(12345);
      expect(parseCurrency(123.45)).toBe(12345);
    });
  });

  describe('Academic Year Utilities', () => {
    it('should determine academic year correctly', () => {
      expect(getAcademicYear(new Date('2024-09-15'))).toBe('2024-2025');
      expect(getAcademicYear(new Date('2024-03-15'))).toBe('2023-2024');
    });
  });

  describe('Slug Generation', () => {
    it('should generate URL-friendly slugs', () => {
      expect(generateSlug('École Nid Douillet')).toBe('ecole-nid-douillet');
      expect(generateSlug('Activité été 2024')).toBe('activite-ete-2024');
    });
  });
});
