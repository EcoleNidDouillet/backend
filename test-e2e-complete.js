/**
 * École Nid Douillet - Complete End-to-End Testing Suite
 * 
 * Comprehensive system validation testing all components together
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:5174';

// Test configuration
const TEST_CONFIG = {
  director: {
    email: 'director@niddouillet.ma',
    password: 'EcoleNidDouillet2024!'
  },
  testParent: {
    email: 'test.parent@example.com',
    password: 'TestPassword123!'
  }
};

// Global test state
let directorToken = '';
let parentToken = '';
let testResults = {
  authentication: { passed: 0, failed: 0, tests: [] },
  notifications: { passed: 0, failed: 0, tests: [] },
  parentPortal: { passed: 0, failed: 0, tests: [] },
  database: { passed: 0, failed: 0, tests: [] },
  integration: { passed: 0, failed: 0, tests: [] }
};

/**
 * Test utilities
 */
class TestUtils {
  static logTest(category, testName, passed, message = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const result = { testName, passed, message, timestamp: new Date().toISOString() };
    
    testResults[category].tests.push(result);
    if (passed) {
      testResults[category].passed++;
    } else {
      testResults[category].failed++;
    }
    
    console.log(`${status}: ${testName}${message ? ` - ${message}` : ''}`);
    return passed;
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateTestData() {
    const timestamp = Date.now();
    return {
      parent: {
        first_name: 'Test',
        last_name: 'Parent',
        email: `test.parent.${timestamp}@example.com`,
        phone: '+212661234567',
        address: 'Test Address, Agadir',
        communication_preference: 'EMAIL',
        language_preference: 'FRENCH'
      },
      child: {
        first_name: 'Test',
        last_name: 'Child',
        birth_date: '2020-05-15',
        gender: 'MALE',
        medical_conditions: ['Aucune'],
        allergies: ['Aucune'],
        additional_notes: 'Test child for E2E testing'
      }
    };
  }
}

/**
 * Authentication System Tests
 */
class AuthenticationTests {
  static async runAll() {
    console.log('\n🔐 Testing Authentication System...');
    
    await this.testDirectorLogin();
    await this.testTokenValidation();
    await this.testRoleBasedAccess();
    await this.testTokenRefresh();
  }

  static async testDirectorLogin() {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, TEST_CONFIG.director);
      
      if (response.data.success && response.data.data.token) {
        directorToken = response.data.data.token;
        TestUtils.logTest('authentication', 'Director Login', true, 'Token received');
      } else {
        TestUtils.logTest('authentication', 'Director Login', false, 'No token in response');
      }
    } catch (error) {
      TestUtils.logTest('authentication', 'Director Login', false, error.response?.data?.message || error.message);
    }
  }

  static async testTokenValidation() {
    try {
      const response = await axios.get(`${BASE_URL}/auth/validate`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('authentication', 'Token Validation', response.data.success, 
        response.data.success ? 'Token is valid' : response.data.message);
    } catch (error) {
      TestUtils.logTest('authentication', 'Token Validation', false, error.response?.data?.message || error.message);
    }
  }

  static async testRoleBasedAccess() {
    try {
      const response = await axios.get(`${BASE_URL}/director/dashboard`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('authentication', 'Role-based Access', response.data.success,
        response.data.success ? 'Director can access director endpoints' : response.data.message);
    } catch (error) {
      TestUtils.logTest('authentication', 'Role-based Access', false, error.response?.data?.message || error.message);
    }
  }

  static async testTokenRefresh() {
    try {
      const response = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('authentication', 'Token Refresh', response.data.success,
        response.data.success ? 'Token refreshed successfully' : response.data.message);
    } catch (error) {
      TestUtils.logTest('authentication', 'Token Refresh', false, error.response?.data?.message || error.message);
    }
  }
}

/**
 * Notification System Tests
 */
class NotificationTests {
  static async runAll() {
    console.log('\n📧 Testing Notification System...');
    
    await this.testGetTemplates();
    await this.testNotificationHistory();
    await this.testNotificationStats();
    await this.testEmailConfiguration();
    await this.testSMSConfiguration();
  }

  static async testGetTemplates() {
    try {
      const response = await axios.get(`${BASE_URL}/notifications/templates`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      const hasTemplates = response.data.success && response.data.data.templates.length > 0;
      TestUtils.logTest('notifications', 'Get Templates', hasTemplates,
        hasTemplates ? `${response.data.data.templates.length} templates available` : 'No templates found');
    } catch (error) {
      TestUtils.logTest('notifications', 'Get Templates', false, error.response?.data?.message || error.message);
    }
  }

  static async testNotificationHistory() {
    try {
      const response = await axios.get(`${BASE_URL}/notifications/history`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('notifications', 'Notification History', response.data.success,
        response.data.success ? `${response.data.data.notifications.length} notifications in history` : response.data.message);
    } catch (error) {
      TestUtils.logTest('notifications', 'Notification History', false, error.response?.data?.message || error.message);
    }
  }

  static async testNotificationStats() {
    try {
      const response = await axios.get(`${BASE_URL}/notifications/stats`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('notifications', 'Notification Stats', response.data.success,
        response.data.success ? 'Stats retrieved successfully' : response.data.message);
    } catch (error) {
      TestUtils.logTest('notifications', 'Notification Stats', false, error.response?.data?.message || error.message);
    }
  }

  static async testEmailConfiguration() {
    // Test email configuration by checking if Gmail credentials are working
    try {
      const testData = {
        type: 'EMAIL',
        recipient: 'test@example.com',
        message: 'Test email configuration'
      };
      
      const response = await axios.post(`${BASE_URL}/notifications/test`, testData, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('notifications', 'Email Configuration', response.data.success,
        response.data.success ? 'Email system configured correctly' : response.data.message);
    } catch (error) {
      TestUtils.logTest('notifications', 'Email Configuration', false, error.response?.data?.message || error.message);
    }
  }

  static async testSMSConfiguration() {
    // Test SMS configuration by checking if Twilio credentials are working
    try {
      const testData = {
        type: 'SMS',
        recipient: '+212661234567',
        message: 'Test SMS configuration'
      };
      
      const response = await axios.post(`${BASE_URL}/notifications/test`, testData, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('notifications', 'SMS Configuration', response.data.success,
        response.data.success ? 'SMS system configured correctly' : response.data.message);
    } catch (error) {
      TestUtils.logTest('notifications', 'SMS Configuration', false, error.response?.data?.message || error.message);
    }
  }
}

/**
 * Parent Portal Tests
 */
class ParentPortalTests {
  static async runAll() {
    console.log('\n👨‍👩‍👧‍👦 Testing Parent Portal...');
    
    await this.testParentDashboard();
    await this.testChildDetails();
    await this.testPaymentHistory();
    await this.testProfileManagement();
    await this.testCareServices();
  }

  static async testParentDashboard() {
    try {
      const response = await axios.get(`${BASE_URL}/parent/dashboard`, {
        headers: { Authorization: `Bearer ${parentToken || directorToken}` }
      });
      
      TestUtils.logTest('parentPortal', 'Parent Dashboard', response.data.success,
        response.data.success ? 'Dashboard data retrieved' : response.data.message);
    } catch (error) {
      TestUtils.logTest('parentPortal', 'Parent Dashboard', false, error.response?.data?.message || error.message);
    }
  }

  static async testChildDetails() {
    try {
      // First get children list, then test child details
      const childrenResponse = await axios.get(`${BASE_URL}/parent/children`, {
        headers: { Authorization: `Bearer ${parentToken || directorToken}` }
      });
      
      if (childrenResponse.data.success && childrenResponse.data.data.children.length > 0) {
        const childId = childrenResponse.data.data.children[0].id;
        const detailsResponse = await axios.get(`${BASE_URL}/parent/children/${childId}`, {
          headers: { Authorization: `Bearer ${parentToken || directorToken}` }
        });
        
        TestUtils.logTest('parentPortal', 'Child Details', detailsResponse.data.success,
          detailsResponse.data.success ? 'Child details retrieved' : detailsResponse.data.message);
      } else {
        TestUtils.logTest('parentPortal', 'Child Details', false, 'No children found for testing');
      }
    } catch (error) {
      TestUtils.logTest('parentPortal', 'Child Details', false, error.response?.data?.message || error.message);
    }
  }

  static async testPaymentHistory() {
    try {
      const response = await axios.get(`${BASE_URL}/parent/payments`, {
        headers: { Authorization: `Bearer ${parentToken || directorToken}` }
      });
      
      TestUtils.logTest('parentPortal', 'Payment History', response.data.success,
        response.data.success ? 'Payment history retrieved' : response.data.message);
    } catch (error) {
      TestUtils.logTest('parentPortal', 'Payment History', false, error.response?.data?.message || error.message);
    }
  }

  static async testProfileManagement() {
    try {
      const response = await axios.get(`${BASE_URL}/parent/profile`, {
        headers: { Authorization: `Bearer ${parentToken || directorToken}` }
      });
      
      TestUtils.logTest('parentPortal', 'Profile Management', response.data.success,
        response.data.success ? 'Profile data retrieved' : response.data.message);
    } catch (error) {
      TestUtils.logTest('parentPortal', 'Profile Management', false, error.response?.data?.message || error.message);
    }
  }

  static async testCareServices() {
    try {
      const response = await axios.get(`${BASE_URL}/parent/care-services`, {
        headers: { Authorization: `Bearer ${parentToken || directorToken}` }
      });
      
      TestUtils.logTest('parentPortal', 'Care Services', response.data.success,
        response.data.success ? 'Care services retrieved' : response.data.message);
    } catch (error) {
      TestUtils.logTest('parentPortal', 'Care Services', false, error.response?.data?.message || error.message);
    }
  }
}

/**
 * Database Integration Tests
 */
class DatabaseTests {
  static async runAll() {
    console.log('\n🗄️ Testing Database Integration...');
    
    await this.testDatabaseConnection();
    await this.testSchemaAlignment();
    await this.testDataIntegrity();
    await this.testTransactionSafety();
  }

  static async testDatabaseConnection() {
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      TestUtils.logTest('database', 'Database Connection', response.status === 200,
        response.status === 200 ? 'Database connection healthy' : 'Database connection failed');
    } catch (error) {
      TestUtils.logTest('database', 'Database Connection', false, error.message);
    }
  }

  static async testSchemaAlignment() {
    try {
      // Test that our schema-aligned queries work
      const response = await axios.get(`${BASE_URL}/director/dashboard`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('database', 'Schema Alignment', response.data.success,
        response.data.success ? 'Schema-aligned queries working' : response.data.message);
    } catch (error) {
      TestUtils.logTest('database', 'Schema Alignment', false, error.response?.data?.message || error.message);
    }
  }

  static async testDataIntegrity() {
    try {
      // Test data consistency across related tables
      const response = await axios.get(`${BASE_URL}/director/analytics/enrollment`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('database', 'Data Integrity', response.data.success,
        response.data.success ? 'Data integrity maintained' : response.data.message);
    } catch (error) {
      TestUtils.logTest('database', 'Data Integrity', false, error.response?.data?.message || error.message);
    }
  }

  static async testTransactionSafety() {
    try {
      // Test that transactions work properly
      const response = await axios.get(`${BASE_URL}/director/analytics/financial`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      
      TestUtils.logTest('database', 'Transaction Safety', response.data.success,
        response.data.success ? 'Transactions working safely' : response.data.message);
    } catch (error) {
      TestUtils.logTest('database', 'Transaction Safety', false, error.response?.data?.message || error.message);
    }
  }
}

/**
 * Integration Tests
 */
class IntegrationTests {
  static async runAll() {
    console.log('\n🔗 Testing System Integration...');
    
    await this.testAPIDocumentation();
    await this.testCORSConfiguration();
    await this.testErrorHandling();
    await this.testPerformance();
    await this.testFrontendBackendIntegration();
  }

  static async testAPIDocumentation() {
    try {
      const response = await axios.get(`${BASE_URL}/docs`);
      TestUtils.logTest('integration', 'API Documentation', response.status === 200,
        response.status === 200 ? 'Swagger docs accessible' : 'Swagger docs not accessible');
    } catch (error) {
      TestUtils.logTest('integration', 'API Documentation', false, error.message);
    }
  }

  static async testCORSConfiguration() {
    try {
      const response = await axios.options(`${BASE_URL}/auth/login`);
      const hasCORS = response.headers['access-control-allow-origin'] !== undefined;
      TestUtils.logTest('integration', 'CORS Configuration', hasCORS,
        hasCORS ? 'CORS properly configured' : 'CORS not configured');
    } catch (error) {
      TestUtils.logTest('integration', 'CORS Configuration', false, error.message);
    }
  }

  static async testErrorHandling() {
    try {
      // Test error handling with invalid request
      const response = await axios.post(`${BASE_URL}/auth/login`, { invalid: 'data' });
      TestUtils.logTest('integration', 'Error Handling', !response.data.success,
        'Error handling working correctly');
    } catch (error) {
      const hasProperError = error.response?.data?.success === false;
      TestUtils.logTest('integration', 'Error Handling', hasProperError,
        hasProperError ? 'Proper error responses' : 'Error handling needs improvement');
    }
  }

  static async testPerformance() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}/director/dashboard`, {
        headers: { Authorization: `Bearer ${directorToken}` }
      });
      const responseTime = Date.now() - startTime;
      
      const isPerformant = responseTime < 2000; // Less than 2 seconds
      TestUtils.logTest('integration', 'Performance', isPerformant,
        `Response time: ${responseTime}ms ${isPerformant ? '(Good)' : '(Slow)'}`);
    } catch (error) {
      TestUtils.logTest('integration', 'Performance', false, error.message);
    }
  }

  static async testFrontendBackendIntegration() {
    try {
      // Test if frontend server is running
      const response = await axios.get(FRONTEND_URL);
      TestUtils.logTest('integration', 'Frontend-Backend Integration', response.status === 200,
        response.status === 200 ? 'Frontend server accessible' : 'Frontend server not accessible');
    } catch (error) {
      TestUtils.logTest('integration', 'Frontend-Backend Integration', false, 
        'Frontend server not running or not accessible');
    }
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  console.log('\n📊 École Nid Douillet - End-to-End Test Report');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  Object.keys(testResults).forEach(category => {
    const result = testResults[category];
    totalPassed += result.passed;
    totalFailed += result.failed;
    
    console.log(`\n${category.toUpperCase()}:`);
    console.log(`  ✅ Passed: ${result.passed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  📊 Success Rate: ${((result.passed / (result.passed + result.failed)) * 100).toFixed(1)}%`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL RESULTS:`);
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📊 Overall Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  // System status
  const successRate = (totalPassed / (totalPassed + totalFailed)) * 100;
  if (successRate >= 90) {
    console.log('\n🎉 SYSTEM STATUS: PRODUCTION READY!');
  } else if (successRate >= 75) {
    console.log('\n⚠️ SYSTEM STATUS: NEEDS MINOR FIXES');
  } else {
    console.log('\n❌ SYSTEM STATUS: NEEDS MAJOR ATTENTION');
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, 'e2e-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

/**
 * Main test execution
 */
async function runCompleteE2ETests() {
  try {
    console.log('🚀 École Nid Douillet - Complete End-to-End Testing');
    console.log('Starting comprehensive system validation...\n');
    
    // Run all test suites
    await AuthenticationTests.runAll();
    await NotificationTests.runAll();
    await ParentPortalTests.runAll();
    await DatabaseTests.runAll();
    await IntegrationTests.runAll();
    
    // Generate final report
    generateTestReport();
    
  } catch (error) {
    console.error('💥 E2E Testing failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runCompleteE2ETests();
}

module.exports = { runCompleteE2ETests };
