const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const adminExists = await User.findOne({ role: 'admin' });

        if (adminExists) {
            console.log('Admin already exists');
            // Reset password to default if needed
            // const salt = await bcrypt.genSalt(10);
            // adminExists.password = await bcrypt.hash('123456', salt);
            // await adminExists.save();
            // console.log('Admin password reset to 123456');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('123456', salt);

            const user = await User.create({
                name: 'Super Admin',
                email: 'admin@gmail.com',
                phone: '01700000000',
                password: hashedPassword,
                role: 'admin',
                branch: 'Main Branch',
                branchCode: '0001',
                status: 'active'
            });

            console.log('Super Admin created:', user);
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

createSuperAdmin();
