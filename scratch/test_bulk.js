const http = require('http');

const data = JSON.stringify({
  sectionName: 'A',
  courseIds: ['60d5f9b4f1b2c3d4e5f6a7b8'],
  instructorId: '60d5f9b4f1b2c3d4e5f6a7b9',
  academicCalendarId: '60d5f9b4f1b2c3d4e5f6a7ba',
  classroom: 'Room 101',
  capacity: 40,
  schedule: [{ day: 'Monday', startTime: '09:00', endTime: '10:30' }]
});

const options = {
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/sections/bulk',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer DUMMY_TOKEN'
  }
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers['content-type']);

  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
