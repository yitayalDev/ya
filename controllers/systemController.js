const SystemConfig = require('../models/SystemConfig');
const AuditLog = require('../models/AuditLog');

// @desc    Get system configuration
// @route   GET /api/system/config
// @access  Private (Super Admin)
const getSystemConfig = async (req, res) => {
    try {
        let config = await SystemConfig.findOne({});
        if (!config) {
            config = await SystemConfig.create({ universityName: 'SmartCampus', shortName: 'SC' });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update system configuration
// @route   PUT /api/system/config
// @access  Private (Super Admin)
const updateSystemConfig = async (req, res) => {
    try {
        let config = await SystemConfig.findOne({});
        if (!config) config = new SystemConfig();

        Object.assign(config, req.body);
        config.configSetBy = req.user._id;
        await config.save();

        // Log action
        await AuditLog.create({
            user: req.user._id,
            action: 'UPDATE_SYSTEM_CONFIG',
            module: 'SYSTEM_CONFIG',
            details: req.body,
            method: 'PUT',
            path: '/api/system/config'
        });

        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Trigger system backup (Mock)
// @route   POST /api/system/backup
// @access  Private (Super Admin)
const triggerBackup = async (req, res) => {
    try {
        const { execSync } = require('child_process');
        const path = require('path');
        const fs = require('fs');

        // Build backup output directory with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '..', 'backups', `backup_${timestamp}`);
        fs.mkdirSync(backupDir, { recursive: true });

        // Get MongoDB URI from env
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';

        // Execute mongodump
        execSync(`mongodump --uri="${mongoUri}" --out="${backupDir}"`, { stdio: 'pipe' });

        // Update last backup timestamp in DB
        const config = await SystemConfig.findOne({});
        config.lastBackupAt = new Date();
        await config.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'TRIGGER_BACKUP',
            module: 'SYSTEM_CONFIG',
            details: { status: 'SUCCESS', backupPath: backupDir, timestamp }
        });

        res.json({ 
            message: 'Backup completed successfully!', 
            timestamp: config.lastBackupAt,
            backupPath: backupDir
        });
    } catch (error) {
        console.error('Backup error:', error.message);
        res.status(500).json({ 
            message: 'Backup failed. Please install MongoDB Database Tools (mongodump) and add it to your system PATH.',
            error: error.message
        });
    }
};

// @desc    Get system health / DB stats
// @route   GET /api/system/health
// @access  Private (Super Admin)
const getSystemHealth = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        
        // Basic stats
        const stats = await db.stats();
        const collections = await db.listCollections().toArray();
        
        // Count some key entities
        const User = require('../models/User');
        const Course = require('../models/Course');
        const Student = require('../models/Student');
        
        const counts = {
            totalUsers: await User.countDocuments(),
            totalCourses: await Course.countDocuments(),
            totalStudents: await Student.countDocuments(),
        };

        res.json({
            dbName: stats.db,
            collections: collections.length,
            objects: stats.objects,
            avgObjSize: stats.avgObjSize,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            counts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get storage stats
// @route   GET /api/system/storage
// @access  Private (Super Admin)
const getStorageStats = async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');

        const getDirSize = (dirPath) => {
            let totalSize = 0;
            if (!fs.existsSync(dirPath)) return 0;
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const stats = fs.statSync(path.join(dirPath, file));
                if (stats.isFile()) totalSize += stats.size;
            }
            return totalSize;
        };

        const uploadsSize = getDirSize(path.join(__dirname, '../../uploads'));
        const tempSize = getDirSize(path.join(__dirname, '../temp'));
        const logsSize = getDirSize(path.join(__dirname, '../logs'));

        res.json({
            uploads: uploadsSize,
            temp: tempSize,
            logs: logsSize,
            total: uploadsSize + tempSize + logsSize
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get public system configuration (branding only)
// @route   GET /api/system/public-config
// @access  Public
const getPublicConfig = async (req, res) => {
    try {
        const config = await SystemConfig.findOne({}).select(
            'universityName shortName logoUrl primaryColor secondaryColor maintenanceMode'
        );
        if (!config) {
            return res.json({
                universityName: 'SmartCampus',
                shortName: 'SC',
                primaryColor: '#143B7A',
                secondaryColor: '#E67E22',
                maintenanceMode: false
            });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getSystemConfig,
    updateSystemConfig,
    triggerBackup,
    getSystemHealth,
    getStorageStats,
    getPublicConfig
};
