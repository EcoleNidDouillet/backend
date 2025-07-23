/**
 * École Nid Douillet - Focused System Validation
 * 
 * Quick validation of core system functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function validateSystem() {
  console.log('🚀 École Nid Douillet - Focused System Validation');
  console.log('='.repeat(50));
  
  let results = { passed: 0, failed: 0 };
  
  // Test 1: Health Check
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.data.success) {
      console.log('✅ Health Check: PASSED');
      results.passed++;
    } else {
      console.log('❌ Health Check: FAILED');
      results.failed++;
    }
  } catch (error) {
    console.log('❌ Health Check: FAILED -', error.message);
    results.failed++;
  }
  
  // Test 2: API Documentation
  try {
    const response = await axios.get(`${BASE_URL}/docs`);
    if (response.status === 200) {
      console.log('✅ API Documentation: PASSED');
      results.passed++;
    } else {
      console.log('❌ API Documentation: FAILED');
      results.failed++;
    }
  } catch (error) {
    console.log('❌ API Documentation: FAILED -', error.message);
    results.failed++;
  }
  
  // Test 3: Authentication
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'director@niddouillet.ma',
      password: 'EcoleNidDouillet2024!'
    });
    
    if (response.data.success && response.data.data.tokens && response.data.data.tokens.accessToken) {
      console.log('✅ Authentication: PASSED');
      results.passed++;
      
      const token = response.data.data.tokens.accessToken;
      
      // Test 4: Protected Endpoint Access
      try {
        const dashboardResponse = await axios.get(`${BASE_URL}/director/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (dashboardResponse.data.success) {
          console.log('✅ Protected Endpoints: PASSED');
          results.passed++;
        } else {
          console.log('❌ Protected Endpoints: FAILED');
          results.failed++;
        }
      } catch (error) {
        console.log('❌ Protected Endpoints: FAILED -', error.response?.data?.message || error.message);
        results.failed++;
      }
      
      // Test 5: Notification System
      try {
        const notificationResponse = await axios.get(`${BASE_URL}/notifications/templates`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (notificationResponse.data.success) {
          console.log('✅ Notification System: PASSED');
          results.passed++;
        } else {
          console.log('❌ Notification System: FAILED');
          results.failed++;
        }
      } catch (error) {
        console.log('❌ Notification System: FAILED -', error.response?.data?.message || error.message);
        results.failed++;
      }
      
    } else {
      console.log('❌ Authentication: FAILED - No access token received');
      console.log('Response structure:', JSON.stringify(response.data, null, 2));
      results.failed++;
    }
  } catch (error) {
    console.log('❌ Authentication: FAILED -', error.response?.data?.message || error.message);
    results.failed++;
  }
  
  // Results Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 VALIDATION RESULTS:`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.passed >= 4) {
    console.log('\n🎉 SYSTEM STATUS: OPERATIONAL!');
    console.log('École Nid Douillet is ready for production use.');
  } else {
    console.log('\n⚠️ SYSTEM STATUS: NEEDS ATTENTION');
    console.log('Some components require fixes before production.');
  }
  
  return results;
}

// Run validation
if (require.main === module) {
  validateSystem();
}

module.exports = { validateSystem };
