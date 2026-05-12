const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server');
const Campus = require('../../models/Campus');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.disconnect(); // Disconnect from any existing connection
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Campus API Integration Tests', () => {
  let adminToken;

  beforeEach(async () => {
    await Campus.deleteMany({});
    await User.deleteMany({});

    // Create a super admin for testing
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'SUPER_ADMIN'
    });

    adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'testsecret');
  });

  it('should create a new campus', async () => {
    const res = await request(app)
      .post('/api/campuses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Main Campus',
        location: 'Addis Ababa',
        description: 'Primary University Hub'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Main Campus');
    
    const campus = await Campus.findOne({ name: 'Main Campus' });
    expect(campus).toBeDefined();
  });

  it('should fetch all campuses', async () => {
    await Campus.create([
      { name: 'Campus A', location: 'City A' },
      { name: 'Campus B', location: 'City B' }
    ]);

    const res = await request(app)
      .get('/api/campuses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should return 401 if unauthorized user tries to create a campus', async () => {
    const res = await request(app)
      .post('/api/campuses')
      .send({ name: 'Hack Campus' });

    expect(res.status).toBe(401);
  });
});
