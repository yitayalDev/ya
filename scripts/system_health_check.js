const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:5001/api';

async function runSystemTest() {
  console.log('🚀 Starting System Health Audit...');
  console.log(`Target Environment: ${API_URL}`);

  const endpoints = [
    { name: 'Global Health Node', path: '/health' },
    { name: 'Campus Registry', path: '/campuses' },
    { name: 'Departmental Oversight', path: '/department/oversight/stats' },
    { name: 'Academic Infrastructure', path: '/infrastructure/stats' }
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const response = await axios.get(`${API_URL}${endpoint.path}`, { timeout: 5000 });
      const duration = Date.now() - start;
      
      console.log(`✅ [PASS] ${endpoint.name} (${duration}ms) - Status: ${response.status}`);
      passed++;
    } catch (error) {
      console.error(`❌ [FAIL] ${endpoint.name} - Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n---------------------------------------');
  console.log(`Audit Finished: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------');

  if (failed > 0) {
    console.log('⚠️ SYSTEM ALERT: Critical dependencies are unreachable.');
    process.exit(1);
  } else {
    console.log('💎 SYSTEM STATUS: Operational & Optimized.');
    process.exit(0);
  }
}

runSystemTest();
