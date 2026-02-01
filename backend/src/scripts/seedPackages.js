const mongoose = require('mongoose');
const Package = require('../models/Package');

const MONGO_URI = 'mongodb://localhost:27017/roi-investment-platform';

const packages = [
  {
    packageCode: 'SILVER',
    name: 'Silver Package',
    description: 'Entry level investment package with stable returns',
    type: 'daily_roi',
    minAmount: mongoose.Types.Decimal128.fromString('1000'),
    maxAmount: mongoose.Types.Decimal128.fromString('9999'),
    incrementStep: mongoose.Types.Decimal128.fromString('1000'),
    roiRate: 2,
    roiCap: 200,
    duration: 365,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: false,
    minActiveReferralsRequired: 0,
    isActive: true,
    isVisible: true,
    features: [
      '2% daily ROI',
      '365 days duration',
      'Referral bonus eligible',
      'Level income eligible',
    ],
    badge: 'Popular',
    displayOrder: 1,
  },
  {
    packageCode: 'GOLD',
    name: 'Gold Package',
    description: 'Premium package with higher returns',
    type: 'daily_roi',
    minAmount: mongoose.Types.Decimal128.fromString('10000'),
    maxAmount: mongoose.Types.Decimal128.fromString('49999'),
    incrementStep: mongoose.Types.Decimal128.fromString('1000'),
    roiRate: 2.5,
    roiCap: 200,
    duration: 365,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 2,
    isActive: true,
    isVisible: true,
    features: [
      '2.5% daily ROI',
      '365 days duration',
      'Higher referral bonus',
      'Binary income eligible',
      'Level income eligible',
    ],
    badge: 'Best Value',
    displayOrder: 2,
  },
  {
    packageCode: 'DIAMOND',
    name: 'Diamond Package',
    description: 'VIP package with maximum returns',
    type: 'daily_roi',
    minAmount: mongoose.Types.Decimal128.fromString('50000'),
    maxAmount: null,
    incrementStep: mongoose.Types.Decimal128.fromString('5000'),
    roiRate: 3,
    roiCap: 200,
    duration: 365,
    roiFrequency: 'daily',
    enablesReferralIncome: true,
    enablesLevelIncome: true,
    enablesBinaryIncome: true,
    minActiveReferralsRequired: 5,
    isActive: true,
    isVisible: true,
    features: [
      '3% daily ROI',
      '365 days duration',
      'Maximum referral bonus',
      'Binary income eligible',
      'Level income eligible',
      'Priority support',
    ],
    badge: 'Premium',
    displayOrder: 3,
  },
];

async function seedPackages() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('Clearing existing packages...');
    const deleted = await Package.deleteMany({});
    console.log(`✅ Cleared ${deleted.deletedCount} existing packages`);

    console.log('Inserting new packages...');
    const result = await Package.insertMany(packages);
    console.log(`✅ ${result.length} packages seeded successfully\n`);

    console.log('📦 Packages Created:');
    result.forEach((pkg) => {
      console.log(`  ✅ ${pkg.name} (${pkg.badge})`);
      console.log(`     - Code: ${pkg.packageCode}`);
      console.log(`     - Amount: ₹${pkg.minAmount} - ${pkg.maxAmount || 'Unlimited'}`);
      console.log(`     - ROI: ${pkg.roiRate}% ${pkg.roiFrequency}`);
      console.log(`     - ROI Cap: ${pkg.roiCap}%`);
      console.log(`     - Duration: ${pkg.duration} days`);
      console.log(`     - Binary: ${pkg.enablesBinaryIncome ? 'Yes' : 'No'}\n`);
    });

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedPackages();
