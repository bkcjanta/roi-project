const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Load environment variables
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    // Connect to database
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mlm-platform';
    
    await mongoose.connect(MONGODB_URI);
    logger.info('✅ Database connected');

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@mlm.com' });
    
    if (existingAdmin) {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  ADMIN ALREADY EXISTS');
      console.log('='.repeat(60));
      console.log(`📧 Email:    ${existingAdmin.email}`);
      console.log(`👤 Code:     ${existingAdmin.userCode}`);
      console.log(`🎭 Role:     ${existingAdmin.role}`);
      console.log('='.repeat(60) + '\n');
      
      await mongoose.connection.close();
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);

    // Generate user code
    const userCount = await User.countDocuments();
    const userCode = `ADMIN${String(userCount + 1).padStart(3, '0')}`;

    // Create admin user with correct field structure
    const admin = await User.create({
      fullName: {
        firstName: 'Super',
        lastName: 'Administrator'
      },
      email: 'admin@mlm.com',
      password: hashedPassword,
      mobile: '9999999999',  // Changed from phoneNumber
      userCode: userCode,
      role: 'admin',  // Changed from super_admin (check your enum!)
      status: 'active',  // Changed from accountStatus
      emailVerified: true,  // Changed from isEmailVerified
      mobileVerified: true,  // Changed from isPhoneVerified
      referralCode: userCode,
      dateOfBirth: new Date('1990-01-01'),
    });

    logger.info('✅ Admin user created');

    // Create wallet for admin
    await Wallet.create({
      userId: admin._id,
    });

    logger.info('✅ Admin wallet created');

    // Display credentials
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📧 Email:    admin@mlm.com`);
    console.log(`🔑 Password: Admin@123456`);
    console.log(`👤 Code:     ${userCode}`);
    console.log(`🎭 Role:     admin`);
    console.log(`📱 Mobile:   +919999999999`);
    console.log('='.repeat(60));
    console.log('⚠️  IMPORTANT: Change password after first login!');
    console.log('='.repeat(60));
    console.log('\n📝 Login credentials:');
    console.log('   POST http://localhost:5000/api/auth/login');
    console.log('   Body: { "email": "admin@mlm.com", "password": "Admin@123456" }');
    console.log('='.repeat(60) + '\n');

    await mongoose.connection.close();
    logger.info('✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Admin seeder error:', error);
    console.error('\n' + '='.repeat(60));
    console.error('❌ ERROR CREATING ADMIN');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error('='.repeat(60) + '\n');
    
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run seeder
createSuperAdmin();
