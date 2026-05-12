const axios = require('axios');

const API_URL = 'http://127.0.0.1:5001';

async function runSmokeTest() {
  console.log('💨 Starting System Smoke Test (Build Verification)...');
  console.log('----------------------------------------------------');

  const criticalPaths = [
    { name: 'Core Server Boot', url: `${API_URL}/api/health`, method: 'GET' },
    { name: 'Frontend Asset Delivery', url: `${API_URL}/`, method: 'GET' },
    { name: 'Database Connectivity (Campuses)', url: `${API_URL}/api/campuses`, method: 'GET' },
    { name: 'Auth Service Availability', url: `${API_URL}/api/auth/login`, method: 'POST', data: {} }
  ];

  let criticalFailures = 0;

  for (const path of criticalPaths) {
    try {
      let res;
      const config = { timeout: 3000, validateStatus: () => true };
      if (path.method === 'GET') {
        res = await axios.get(path.url, config);
      } else {
        res = await axios.post(path.url, path.data, config);
      }

      // 404 or 500 on a critical path is a Smoke Test failure
      if (res.status === 404 || res.status >= 500) {
        console.error(`❌ [SMOKE FAIL] ${path.name}: Unreachable or Crashing (Status: ${res.status})`);
        criticalFailures++;
      } else {
        console.log(`✅ [SMOKE PASS] ${path.name} (Status: ${res.status})`);
      }
    } catch (error) {
      console.error(`❌ [SMOKE FAIL] ${path.name}: Connection Error - ${error.message}`);
      criticalFailures++;
    }
  }

  console.log('----------------------------------------------------');
  if (criticalFailures > 0) {
    console.error(`🚨 BUILD REJECTED: ${criticalFailures} critical paths failed smoke testing.`);
    process.exit(1);
  } else {
    console.log('🔥 BUILD VERIFIED: All critical systems are operational.');
    process.exit(0);
  }
}

runSmokeTest();
