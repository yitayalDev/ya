const axios = require('axios');

async function test() {
  try {
    const login = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'admin@university.com', password: 'adminpassword123'
    });
    const token = login.data.token;
    console.log('Token:', token.substring(0, 20) + '...');

    const campuses = await axios.get('http://localhost:5001/api/campuses', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Campuses:', campuses.data.map(c => c.name));
    const campusId = campuses.data[0]._id;

    const res = await axios.post(
      'http://localhost:5001/api/housing/assign-all',
      { campusId, criteria: ['DEPARTMENT'] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('\nAssign All Result:');
    console.log('Assigned:', res.data.assigned.length);
    console.log('Unassigned:', res.data.unassigned.length);
    res.data.assigned.forEach(a => console.log(`  ${a.studentName} -> ${a.bedNumber}`));
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data?.message || err.message);
  }
}
test();
