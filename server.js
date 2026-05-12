const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

// Connect to database
connectDB();

const app = express();
let io;

// Global error handlers
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'Error:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

// Body parser
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Enable CORS with explicit settings for ngrok
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true
}));

// Bypass ngrok browser warning for all responses
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use((req, res, next) => {
  if (io) {
    req.io = io;
  }
  next();
});

// Serve static files from Flutter web build
const webBuildPath = path.join(__dirname, '../frontend/build/web');
app.use(express.static(webBuildPath));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root route
app.get('/', (req, res) => {
  const indexPath = path.join(webBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <html>
        <head><title>Backend Running</title></head>
        <body style="font-family: sans-serif; padding: 40px; line-height: 1.6;">
          <h1>Backend is Running</h1>
          <p style="color: #666;">The backend server is up and running, but the frontend web build was not found.</p>
          <div style="background: #f4f4f4; padding: 20px; border-radius: 8px;">
            <h3>How to fix:</h3>
            <ol>
              <li>Open a terminal in the project root</li>
              <li>Run the build command for your ngrok URL:
                <pre style="background: #eee; padding: 10px; margin-top: 10px;">npm run build:web</pre>
                <i>Note: If using ngrok, check README.md for the specific build command with --dart-define</i>
              </li>
              <li>Restart the backend</li>
            </ol>
          </div>
          <p>API Health Check: <a href="/api/health">/api/health</a></p>
        </body>
      </html>
    `);
  }
});

// Global Health Check for System Testing
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Maintenance Mode Check
const { checkMaintenance } = require('./middleware/maintenance');
app.use('/api', checkMaintenance);

// Mount routers
console.log('Loading routers...');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campuses', require('./routes/campuses'));
app.use('/api/colleges', require('./routes/colleges'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/enrollment', require('./routes/enrollment'));
app.use('/api/academic', require('./routes/academicCalendar'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/students', require('./routes/students'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/instructor', require('./routes/instructor'));
console.log('[DEBUG] Mounting /api/student routes...');
app.use('/api/student', require('./routes/studentDashboard'));
app.use('/api/grading-components', require('./routes/gradingComponents'));
app.use('/api/grades', require('./routes/grades'));
app.use('/api/final-grades', require('./routes/finalGrades'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/clinics', require('./routes/clinics'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/libraries', require('./routes/libraries'));
app.use('/api/library-ops', require('./routes/libraryOperations'));
app.use('/api/dormitories', require('./routes/dormitories'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/dorm-requests', require('./routes/dormRequests'));
app.use('/api/violations', require('./routes/violations'));
app.use('/api/housing', require('./routes/housing'));
app.use('/api/dorm-announcements', require('./routes/dormAnnouncements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/clearance', require('./routes/clearance'));
app.use('/api/verify', require('./routes/verification'));
app.use('/api/registration-windows', require('./routes/registrationWindows'));
app.use('/api/readmission', require('./routes/readmission'));
app.use('/api/grade-change', require('./routes/gradeChange'));
app.use('/api/transcript-orders', require('./routes/transcriptOrders'));
app.use('/api/graduation', require('./routes/graduation'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/system', require('./routes/system'));
app.use('/api/infrastructure', require('./routes/infrastructure'));
app.use('/api/data', require('./routes/data'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/college/oversight', require('./routes/oversight'));
app.use('/api/department/oversight', require('./routes/deptOversight'));
app.use('/api/registrar/degree-audit', require('./routes/degreeAudit'));
console.log('All routers loaded');

// Material download route (accessible by both students and instructors)
const { downloadMaterial } = require('./controllers/materialController');
const { protect } = require('./middleware/auth');
app.get('/api/materials/download/:id', protect, downloadMaterial);

// API 404 Handler
app.use('/api', (req, res) => {
  res.status(404).json({ message: `API Route not found: ${req.method} ${req.originalUrl}` });
});

// Catch-all: serve Flutter web app for any non-API route
app.get(/^(?!\/api).*$/, (req, res) => {
  // If the request is for a specific file (has an extension), don't serve index.html
  // This prevents "Unexpected token <" errors when JS/CSS files are missing
  if (path.extname(req.path)) {
    return res.status(404).json({ 
      message: `Asset not found: ${req.path}`,
      status: 'Building'
    });
  }

  const indexPath = path.join(webBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      message: 'Frontend build not found. Please wait for the build to complete.',
      path: req.originalUrl 
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  if (err.stack) console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 5001;

const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their private room`);
  });

  socket.on('join_clinic', (clinicId) => {
    socket.join(`clinic_${clinicId}`);
    console.log(`User joined clinic room: clinic_${clinicId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

module.exports = { app, server };
