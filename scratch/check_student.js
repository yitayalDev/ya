const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/university_app');
        console.log('Connected to MongoDB');

        const user = await User.findOne({ email: /biniyam\.a@university\.edu/i });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('User Found:', user.email, 'ID:', user._id);

        const student = await Student.findOne({ user: user._id });
        if (!student) {
            console.log('Student profile NOT found for this user!');
            // Let's see if there is a student with this email but not linked correctly
            const studentByEmail = await Student.findOne({ email: /biniyam\.a@university\.edu/i });
            if (studentByEmail) {
                console.log('Found student profile by email, but User ID mismatch!');
                console.log('Current User ID in profile:', studentByEmail.user);
                // Fix it
                studentByEmail.user = user._id;
                await studentByEmail.save();
                console.log('Fixed User ID linkage!');
            } else {
                console.log('No student profile found at all for this email.');
            }
        } else {
            console.log('Student profile found:', student.studentId);
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

check();
