const mongoose = require('mongoose');
const Package = require('../models/Package');
const logger = require('../utils/logger');
require('dotenv').config();

const packages = [
  {
    packageCode: 'PKG001',
    name: 'Starter Package',
    description: 'Perfect for beginners to start their investment journey',
    type: 'daily_roi',
    minAmount: 1000,
    maxAmount: 4999,
    incrementStep: 1000,
    roiRate: 2, // 2% daily
    roiCap: 360, // 180 days * 2% = 360%
    duration: 180,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 0,
    isActive: true,
    isVisible: true,
    displayOrder: 1,
    features: [
      '2% Daily ROI for 180 Days',
      '360% Total Return',
      'Referral Income Eligible',
      'Level Income Eligible',
      'Binary Income Eligible',
      'No Minimum Referral Required'
    ],
    badge: 'Beginner Friendly',
  },
  
  {
    packageCode: 'PKG002',
    name: 'Basic Package',
    description: 'Enhanced returns with better income opportunities',
    type: 'daily_roi',
    minAmount: 5000,
    maxAmount: 9999,
    incrementStep: 1000,
    roiRate: 2,
    roiCap: 360,
    duration: 180,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 0,
    isActive: true,
    isVisible: true,
    displayOrder: 2,
    features: [
      '2% Daily ROI for 180 Days',
      '360% Total Return',
      'Higher Investment Amount',
      'All Income Types Enabled',
      'Priority Support',
      'Fast Withdrawal Processing'
    ],
    badge: 'Popular',
  },
  
  {
    packageCode: 'PKG003',
    name: 'Standard Package',
    description: 'Standard package for serious investors',
    type: 'daily_roi',
    minAmount: 10000,
    maxAmount: 49999,
    incrementStep: 5000,
    roiRate: 2,
    roiCap: 360,
    duration: 180,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 0,
    isActive: true,
    isVisible: true,
    displayOrder: 3,
    features: [
      '2% Daily ROI for 180 Days',
      '360% Total Return',
      'Maximum Returns',
      'VIP Support Access',
      'Dedicated Account Manager',
      'Priority Withdrawal'
    ],
    badge: 'Best Value',
  },
  
  {
    packageCode: 'PKG004',
    name: 'Premium Package',
    description: 'Premium package with exclusive benefits',
    type: 'daily_roi',
    minAmount: 50000,
    maxAmount: 99999,
    incrementStep: 10000,
    roiRate: 2,
    roiCap: 360,
    duration: 180,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 2,
    isActive: true,
    isVisible: true,
    displayOrder: 4,
    features: [
      '2% Daily ROI for 180 Days',
      '360% Total Return',
      'Premium Support 24/7',
      'Exclusive Webinars',
      'Advanced Trading Signals',
      'Team Building Bonus'
    ],
    badge: 'Premium',
  },
  
  {
    packageCode: 'PKG005',
    name: 'Elite Package',
    description: 'Ultimate package for elite investors',
    type: 'daily_roi',
    minAmount: 100000,
    maxAmount: null, // No upper limit
    incrementStep: 50000,
    roiRate: 2,
    roiCap: 360,
    duration: 180,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 5,
    isActive: true,
    isVisible: true,
    displayOrder: 5,
    features: [
      '2% Daily ROI for 180 Days',
      '360% Total Return',
      'Elite Concierge Service',
      'Personal Investment Advisor',
      'Private Investment Group',
      'Annual Leadership Retreat',
      'Highest Referral Bonuses'
    ],
    badge: 'Elite',
  },
];

async function seedPackages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('✅ Connected to MongoDB');

    // Clear existing packages (optional)
    const existingCount = await Package.countDocuments();
    if (existingCount > 0) {
      logger.warn(`⚠️  Found ${existingCount} existing packages`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      // For script, just delete automatically
      await Package.deleteMany({});
      logger.info('🗑️  Deleted existing packages');
    }

    // Insert packages
    const insertedPackages = await Package.insertMany(packages);
    logger.info(`✅ Successfully seeded ${insertedPackages.length} packages`);

    // Display summary
    console.log('\n📦 PACKAGES CREATED:\n');
    insertedPackages.forEach(pkg => {
      console.log(`
🎯 ${pkg.name} (${pkg.packageCode})
   💰 Amount: ₹${pkg.minAmount.toLocaleString('en-IN')} - ₹${pkg.maxAmount?.toLocaleString('en-IN') || 'Unlimited'}
   📈 ROI: ${pkg.roiRate}% daily for ${pkg.duration} days (${pkg.roiCap}% total)
   🎁 Badge: ${pkg.badge}
   🆔 ID: ${pkg._id}
      `);
    });

    logger.info('✅ Package seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error seeding packages:', error);
    process.exit(1);
  }
}

// Run seed
seedPackages();
