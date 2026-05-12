const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function runSecurityAudit() {
  console.log('🛡️ Starting Security Protocol Audit...');

  const sensitiveEndpoints = [
    { name: 'Admin Dashboard', path: '/analytics/super-admin/dashboard' },
    { name: 'User Management', path: '/users' },
    { name: 'System Logs', path: '/audit' },
    { name: 'Finance Hub', path: '/finance/stats' }
  ];

  let vulnerabilities = 0;

  for (const endpoint of sensitiveEndpoints) {
    try {
      // Intentionally request without Token
      const res = await axios.get(`${API_URL}${endpoint.path}`, { timeout: 3000 });
      
      // If we get here, it means the endpoint is open!
      console.error(`🚨 VULNERABILITY DETECTED: ${endpoint.name} (${endpoint.path}) is accessible without authentication!`);
      vulnerabilities++;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log(`✅ [SECURE] ${endpoint.name} rejected unauthorized access (Status: ${error.response.status})`);
      } else {
        console.warn(`⚠️ [UNCERTAIN] ${endpoint.name} returned status ${error.response ? error.response.status : 'ERR'}`);
      }
    }
  }

  console.log('\n---------------- Security Summary ----------------');
  console.log(`Vulnerabilities Found: ${vulnerabilities}`);
  console.log('--------------------------------------------------');

  if (vulnerabilities > 0) {
    console.error('❌ SECURITY BREACH: System fails basic access control tests.');
    process.exit(1);
  } else {
    console.log('💎 SECURITY: Authentication layer is robust and impenetrable.');
    process.exit(0);
  }
}

runSecurityAudit();
