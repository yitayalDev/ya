const axios = require('axios');
const { performance } = require('perf_hooks');

const API_URL = 'http://localhost:5001/api';
const CONCURRENT_REQUESTS = 50;

async function runPerformanceTest() {
  console.log(`🚀 Starting Performance Stress Test (${CONCURRENT_REQUESTS} concurrent requests)...`);
  
  const results = [];
  const startTime = performance.now();

  const requests = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, i) => {
    const reqStart = performance.now();
    try {
      // Testing a public health endpoint for baseline latency
      await axios.get(`${API_URL}/health`, { timeout: 10000 });
      const duration = performance.now() - reqStart;
      results.push({ success: true, duration });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  });

  await Promise.all(requests);
  const totalTime = performance.now() - startTime;

  const successful = results.filter(r => r.success);
  const avgLatency = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
  const maxLatency = Math.max(...successful.map(r => r.duration));
  const minLatency = Math.min(...successful.map(r => r.duration));

  console.log('\n---------------- Performance Metrics ----------------');
  console.log(`Total Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Success Rate: ${((successful.length / CONCURRENT_REQUESTS) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalTime.toFixed(2)}ms`);
  console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Min/Max Latency: ${minLatency.toFixed(2)}ms / ${maxLatency.toFixed(2)}ms`);
  console.log(`Throughput: ${(CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(2)} req/sec`);
  console.log('----------------------------------------------------');

  if (avgLatency > 200) {
    console.warn('⚠️ WARNING: Average latency exceeds 200ms threshold.');
  } else {
    console.log('💎 PERFORMANCE: High-speed responsiveness confirmed.');
  }
}

runPerformanceTest();
