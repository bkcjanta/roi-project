const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const SystemSetting = require('../models/SystemSetting');
const logger = require('../utils/logger');

const defaultSettings = [
  // Withdrawal Settings
  {
    settingKey: 'withdrawal.minAmount',
    settingValue: 100,
    dataType: 'number',
    description: 'Minimum withdrawal amount in INR',
    isActive: true,
  },
  {
    settingKey: 'withdrawal.maxAmount',
    settingValue: 100000,
    dataType: 'number',
    description: 'Maximum withdrawal amount in INR',
    isActive: true,
  },
  {
    settingKey: 'withdrawal.feePercentage',
    settingValue: 2,
    dataType: 'number',
    description: 'Withdrawal fee percentage (0-10)',
    isActive: true,
  },
  {
    settingKey: 'withdrawal.dailyLimit',
    settingValue: 3,
    dataType: 'number',
    description: 'Maximum withdrawals allowed per day',
    isActive: true,
  },
  {
    settingKey: 'withdrawal.processingTime',
    settingValue: '24-48 hours',
    dataType: 'string',
    description: 'Expected withdrawal processing time',
    isActive: true,
  },
  {
    settingKey: 'withdrawal.isEnabled',
    settingValue: true,
    dataType: 'boolean',
    description: 'Enable/disable withdrawal system',
    isActive: true,
  },

  // Investment Settings
  {
    settingKey: 'investment.minAmount',
    settingValue: 1000,
    dataType: 'number',
    description: 'Minimum investment amount',
    isActive: true,
  },
  {
    settingKey: 'investment.maxAmount',
    settingValue: 500000,
    dataType: 'number',
    description: 'Maximum investment amount',
    isActive: true,
  },
  {
    settingKey: 'investment.isEnabled',
    settingValue: true,
    dataType: 'boolean',
    description: 'Enable/disable investment system',
    isActive: true,
  },

  // MLM Settings
  {
    settingKey: 'mlm.directReferralPercentage',
    settingValue: 10,
    dataType: 'number',
    description: 'Direct referral commission percentage',
    isActive: true,
  },
  {
    settingKey: 'mlm.levelIncomePercentages',
    settingValue: [5, 3, 2, 1, 1],
    dataType: 'json',
    description: 'Level-wise income percentages (Level 1 to 5)',
    isActive: true,
  },
  {
    settingKey: 'mlm.binaryIncomePercentage',
    settingValue: 5,
    dataType: 'number',
    description: 'Binary matching income percentage',
    isActive: true,
  },
  {
    settingKey: 'mlm.isEnabled',
    settingValue: true,
    dataType: 'boolean',
    description: 'Enable/disable MLM income system',
    isActive: true,
  },

  // ROI Settings
  {
    settingKey: 'roi.distributionTime',
    settingValue: '00:01',
    dataType: 'string',
    description: 'Daily ROI distribution time (HH:MM format)',
    isActive: true,
  },
  {
    settingKey: 'roi.isAutoDistribution',
    settingValue: true,
    dataType: 'boolean',
    description: 'Enable automatic ROI distribution',
    isActive: true,
  },

  // KYC Settings
  {
    settingKey: 'kyc.isRequired',
    settingValue: false,
    dataType: 'boolean',
    description: 'Make KYC mandatory for all users',
    isActive: true,
  },
  {
    settingKey: 'kyc.requiredForWithdrawal',
    settingValue: true,
    dataType: 'boolean',
    description: 'Require KYC for withdrawals',
    isActive: true,
  },
  {
    settingKey: 'kyc.maxAmountWithoutKYC',
    settingValue: 10000,
    dataType: 'number',
    description: 'Maximum withdrawal amount without KYC',
    isActive: true,
  },

  // Maintenance Mode
  {
    settingKey: 'maintenance.isEnabled',
    settingValue: false,
    dataType: 'boolean',
    description: 'Enable maintenance mode',
    isActive: true,
  },
  {
    settingKey: 'maintenance.message',
    settingValue: 'System is under maintenance. Please try again later.',
    dataType: 'string',
    description: 'Maintenance mode message',
    isActive: true,
  },

  // Contact Settings
  {
    settingKey: 'contact.supportEmail',
    settingValue: 'support@roiplatform.com',
    dataType: 'string',
    description: 'Support email address',
    isActive: true,
  },
  {
    settingKey: 'contact.supportPhone',
    settingValue: '+91-9999999999',
    dataType: 'string',
    description: 'Support phone number',
    isActive: true,
  },
  {
    settingKey: 'contact.whatsappNumber',
    settingValue: '+91-9999999999',
    dataType: 'string',
    description: 'WhatsApp support number',
    isActive: true,
  },
];

async function seedSettings() {
  try {
    // ✅ FIXED: Changed MONGO_URI to MONGODB_URI
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected for seeding settings');

    // Check if settings already exist
    const existingCount = await SystemSetting.countDocuments();
    
    if (existingCount > 0) {
      logger.info('⚠️  Settings already exist. Skipping seed.');
      logger.info(`   Total settings: ${existingCount}`);
      process.exit(0);
    }

    // Insert all settings
    await SystemSetting.insertMany(defaultSettings);

    logger.info('✅ System settings seeded successfully');
    logger.info(`   Total settings created: ${defaultSettings.length}`);
    logger.info('');
    logger.info('📋 Key Settings:');
    logger.info(`   - Withdrawal fee: 2%`);
    logger.info(`   - Daily withdrawal limit: 3`);
    logger.info(`   - Min withdrawal: ₹100`);
    logger.info(`   - Max withdrawal: ₹100,000`);
    logger.info(`   - Direct referral: 10%`);
    logger.info(`   - Level income: [5%, 3%, 2%, 1%, 1%]`);

    process.exit(0);
  } catch (error) {
    logger.error('Seed error:', error);
    process.exit(1);
  }
}

seedSettings();
