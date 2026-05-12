const User = require('../models/User');
const Student = require('../models/Student');
const Campus = require('../models/Campus');
const Department = require('../models/Department');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// @desc    Bulk Import Students from CSV
// @route   POST /api/data/import/students
// @access  Private (Super Admin)
const importStudents = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please upload a CSV file' });
    }

    const studentsToCreate = [];
    const results = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                let successCount = 0;
                let errorCount = 0;
                const errors = [];

                for (const row of results) {
                    const { name, email, password, studentId, gender, dateOfBirth, campusName, departmentName } = row;

                    try {
                        // Check if user exists
                        const userExists = await User.findOne({ email });
                        if (userExists) {
                            errors.push({ email, message: 'User already exists' });
                            errorCount++;
                            continue;
                        }

                        // Resolve IDs
                        const campus = await Campus.findOne({ name: campusName });
                        const department = await Department.findOne({ name: departmentName });

                        if (!campus || !department) {
                            errors.push({ email, message: 'Campus or Department not found' });
                            errorCount++;
                            continue;
                        }

                        // Create User
                        const user = await User.create({
                            name,
                            email,
                            password: password || 'Welcome123!',
                            role: 'STUDENT',
                            campus: campus._id,
                            department: department._id
                        });

                        // Create Student Profile
                        await Student.create({
                            user: user._id,
                            studentId,
                            gender,
                            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                            campus: campus._id,
                            college: department.college, // Derived from department
                            department: department._id,
                            academicYear: row.academicYear || 'Year 1',
                            admissionYear: parseInt(row.admissionYear) || new Date().getFullYear(),
                            status: 'Active'
                        });

                        successCount++;
                    } catch (err) {
                        errors.push({ email, message: err.message });
                        errorCount++;
                    }
                }

                // Cleanup file
                fs.unlinkSync(req.file.path);

                res.json({
                    message: 'Bulk import completed',
                    successCount,
                    errorCount,
                    errors
                });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });
};

// @desc    Export Students to CSV
// @route   GET /api/data/export/students
// @access  Private (Super Admin)
const exportStudents = async (req, res) => {
    try {
        const students = await Student.find({})
            .populate('user', 'name email')
            .populate('campus', 'name')
            .populate('department', 'name');

        let csvContent = 'StudentID,Name,Email,Campus,Department,Status\n';
        students.forEach(s => {
            csvContent += `${s.studentId},${s.user.name},${s.user.email},${s.campus?.name},${s.department?.name},${s.admissionStatus}\n`;
        });

        const fileName = `students_export_${Date.now()}.csv`;
        const filePath = path.join(__dirname, '../temp', fileName);

        // Ensure temp dir exists
        if (!fs.existsSync(path.join(__dirname, '../temp'))) {
            fs.mkdirSync(path.join(__dirname, '../temp'));
        }

        fs.writeFileSync(filePath, csvContent);
        res.download(filePath, fileName, () => {
            fs.unlinkSync(filePath); // Cleanup
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    importStudents,
    exportStudents
};
