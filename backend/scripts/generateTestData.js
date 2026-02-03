const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Package = require('../src/models/Package');
const Investment = require('../src/models/Investment');
const Wallet = require('../src/models/Wallet');
const Commission = require('../src/models/Commission');
const Transaction = require('../src/models/Transaction');
const IncomeDistribution = require('../src/models/IncomeDistribution');
const BinaryTransaction = require('../src/models/BinaryTransaction');

// ==================== CONFIGURATION ====================

const CONFIG = {
  TOTAL_USERS: 100,
  START_DATE: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  END_DATE: new Date(),
  ROOT_USER_COUNT: 5, // Top level users
  MIN_INVESTMENT: 5000,
  MAX_INVESTMENT: 100000,
  INVESTMENT_PROBABILITY: 0.7, // 70% users will invest
};

// ==================== HELPER FUNCTIONS ====================

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomInvestmentAmount() {
  const amounts = [5000, 10000, 15000, 20000, 30000, 50000, 75000, 100000];
  return amounts[randomBetween(0, amounts.length - 1)];
}

function generateRandomName() {
  const firstNames = [
    'Rajesh', 'Amit', 'Priya', 'Vikash', 'Pooja', 'Rahul', 'Neha', 'Suresh',
    'Anjali', 'Rohit', 'Deepak', 'Kavita', 'Manoj', 'Sneha', 'Anil', 'Sunita',
    'Ravi', 'Meera', 'Sanjay', 'Rekha', 'Vijay', 'Geeta', 'Ajay', 'Seema',
    'Karan', 'Nisha', 'Vishal', 'Preeti', 'Ashok', 'Ritu', 'Sandeep', 'Asha',
    'Mohan', 'Anita', 'Ramesh', 'Kamla', 'Dinesh', 'Radha', 'Prakash', 'Suman',
    'Naveen', 'Lata', 'Mukesh', 'Shanti', 'Pankaj', 'Usha', 'Yogesh', 'Manju',
    'Arun', 'Rita', 'Sunil', 'Savita', 'Naresh', 'Pushpa', 'Mahesh', 'Poonam',
    'Rajiv', 'Bharti', 'Vinod', 'Kiran', 'Satish', 'Sangeeta', 'Rakesh', 'Madhuri',
    'Nitin', 'Archana', 'Manish', 'Vandana', 'Sachin', 'Shilpa', 'Kapil', 'Pallavi',
    'Aakash', 'Divya', 'Sumit', 'Ranjana', 'Gaurav', 'Smita', 'Tarun', 'Naina',
    'Varun', 'Jyoti', 'Arjun', 'Lalita', 'Kunal', 'Sapna', 'Siddharth', 'Urmila',
    'Harsh', 'Sarita', 'Ankit', 'Bindu', 'Rohan', 'Komal', 'Akshay', 'Swati',
    'Abhishek', 'Chitra', 'Piyush', 'Nandini', 'Yash', 'Tanvi', 'Vishal', 'Renuka'
  ];

  const lastNames = [
    'Kumar', 'Sharma', 'Singh', 'Verma', 'Gupta', 'Yadav', 'Patel', 'Reddy',
    'Joshi', 'Mehta', 'Malhotra', 'Agarwal', 'Jain', 'Shah', 'Chopra', 'Das',
    'Nair', 'Iyer', 'Rao', 'Pandey', 'Mishra', 'Pillai', 'Kapoor', 'Soni',
    'Bansal', 'Mittal', 'Khanna', 'Saxena', 'Dubey', 'Tiwari', 'Chauhan', 'Desai'
  ];

  const firstName = firstNames[randomBetween(0, firstNames.length - 1)];
  const lastName = lastNames[randomBetween(0, lastNames.length - 1)];
  
  return { firstName, lastName, fullName: `${firstName} ${lastName}` };
}

function generateMobile(index) {
  return `98765${String(index).padStart(5, '0')}`;
}

function generateEmail(name, index) {
  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  return `${cleanName}${index}@test.com`;
}

// ==================== MAIN GENERATION LOGIC ====================

async function generateTestData() {
  try {
    console.log('🚀 Starting test data generation...\n');

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roi_platform');
    console.log('✅ Database connected\n');

    console.log('⚠️  Clearing existing data...');
    await User.deleteMany({});
    await Investment.deleteMany({});
    await Wallet.deleteMany({});
    await Commission.deleteMany({});
    await Transaction.deleteMany({});
    await IncomeDistribution.deleteMany({});
    await BinaryTransaction.deleteMany({});
    console.log('✅ Old data cleared\n');

    console.log('📦 Setting up packages...');
    let packages = await Package.find({ isActive: true });
    if (packages.length === 0) {
      packages = await Package.create([
        {
          name: 'Silver Package',
          minAmount: 5000,
          maxAmount: 14999,
          dailyRoi: 2,
          duration: 365,
          isActive: true,
        },
        {
          name: 'Gold Package',
          minAmount: 15000,
          maxAmount: 49999,
          dailyRoi: 2.5,
          duration: 365,
          isActive: true,
        },
        {
          name: 'Platinum Package',
          minAmount: 50000,
          maxAmount: 500000,
          dailyRoi: 3,
          duration: 365,
          isActive: true,
        },
      ]);
    }
    console.log(`✅ ${packages.length} packages ready\n`);

    console.log('👥 Creating users...');
    const users = [];
    const hashedPassword = await bcrypt.hash('Test@123', 12);

    // Create root users
    for (let i = 1; i <= CONFIG.ROOT_USER_COUNT; i++) {
      const { firstName, lastName, fullName } = generateRandomName();
      const userCode = `U${String(i).padStart(6, '0')}`;
      const createdAt = randomDate(CONFIG.START_DATE, new Date(CONFIG.START_DATE.getTime() + 2 * 24 * 60 * 60 * 1000));

      const user = await User.create({
        fullName: {
          firstName,
          lastName,
        },
        email: generateEmail(fullName, i),
        mobile: generateMobile(i),
        password: hashedPassword,
        userCode,
        accountStatus: 'active',
        role: 'user',
        createdAt,
        updatedAt: createdAt,
      });

      // Create wallets
      const walletTypes = ['investment', 'roi', 'level', 'binary', 'rewards', 'withdrawal', 'main'];
      for (const type of walletTypes) {
        await Wallet.create({
          userId: user._id,
          userCode: user.userCode,
          walletType: type,
          balance: 0,
          createdAt,
        });
      }

      users.push(user);
      console.log(`  ✅ Root user ${i}/${CONFIG.ROOT_USER_COUNT}: ${userCode} (${fullName})`);
    }

    // Create remaining users with binary tree
    let userIndex = CONFIG.ROOT_USER_COUNT + 1;
    const queue = [...users];

    while (users.length < CONFIG.TOTAL_USERS && queue.length > 0) {
      const parent = queue.shift();

      // Add left child
      if (users.length < CONFIG.TOTAL_USERS && !parent.binaryLeftId) {
        const { firstName, lastName, fullName } = generateRandomName();
        const userCode = `U${String(userIndex).padStart(6, '0')}`;
        const createdAt = randomDate(
          new Date(parent.createdAt.getTime() + 1 * 24 * 60 * 60 * 1000),
          CONFIG.END_DATE
        );

        const user = await User.create({
          fullName: {
            firstName,
            lastName,
          },
          email: generateEmail(fullName, userIndex),
          mobile: generateMobile(userIndex),
          password: hashedPassword,
          userCode,
          sponsorId: parent._id,
          sponsorCode: parent.userCode,
          binaryParentId: parent._id,
          binaryParentCode: parent.userCode,
          binaryPosition: 'left',
          accountStatus: 'active',
          role: 'user',
          createdAt,
          updatedAt: createdAt,
        });

        // Update parent
        parent.binaryLeftId = user._id;
        parent.binaryTeam.leftCount += 1;
        await parent.save();

        // Create wallets
        const walletTypes = ['investment', 'roi', 'level', 'binary', 'rewards', 'withdrawal', 'main'];
        for (const type of walletTypes) {
          await Wallet.create({
            userId: user._id,
            userCode: user.userCode,
            walletType: type,
            balance: 0,
            createdAt,
          });
        }

        users.push(user);
        queue.push(user);
        userIndex++;
        
        if (users.length % 10 === 0) {
          console.log(`  ✅ ${users.length}/${CONFIG.TOTAL_USERS} users created...`);
        }
      }

      // Add right child
      if (users.length < CONFIG.TOTAL_USERS && !parent.binaryRightId) {
        const { firstName, lastName, fullName } = generateRandomName();
        const userCode = `U${String(userIndex).padStart(6, '0')}`;
        const createdAt = randomDate(
          new Date(parent.createdAt.getTime() + 1 * 24 * 60 * 60 * 1000),
          CONFIG.END_DATE
        );

        const user = await User.create({
          fullName: {
            firstName,
            lastName,
          },
          email: generateEmail(fullName, userIndex),
          mobile: generateMobile(userIndex),
          password: hashedPassword,
          userCode,
          sponsorId: parent._id,
          sponsorCode: parent.userCode,
          binaryParentId: parent._id,
          binaryParentCode: parent.userCode,
          binaryPosition: 'right',
          accountStatus: 'active',
          role: 'user',
          createdAt,
          updatedAt: createdAt,
        });

        // Update parent
        parent.binaryRightId = user._id;
        parent.binaryTeam.rightCount += 1;
        await parent.save();

        // Create wallets
        const walletTypes = ['investment', 'roi', 'level', 'binary', 'rewards', 'withdrawal', 'main'];
        for (const type of walletTypes) {
          await Wallet.create({
            userId: user._id,
            userCode: user.userCode,
            walletType: type,
            balance: 0,
            createdAt,
          });
        }

        users.push(user);
        queue.push(user);
        userIndex++;
        
        if (users.length % 10 === 0) {
          console.log(`  ✅ ${users.length}/${CONFIG.TOTAL_USERS} users created...`);
        }
      }
    }

    console.log(`\n✅ ${users.length} users created\n`);

    // ==================== CREATE INVESTMENTS ====================

    console.log('💰 Creating investments...');
    let investmentCount = 0;

    for (const user of users) {
      if (Math.random() > CONFIG.INVESTMENT_PROBABILITY) continue;

      const amount = randomInvestmentAmount();
      const pkg = packages.find(p => amount >= p.minAmount && amount <= p.maxAmount);
      if (!pkg) continue;

      const investmentDate = randomDate(
        new Date(user.createdAt.getTime() + 1 * 60 * 60 * 1000),
        CONFIG.END_DATE
      );

      const daysElapsed = Math.floor((CONFIG.END_DATE - investmentDate) / (1000 * 60 * 60 * 24));
      const dailyReturn = (amount * pkg.dailyRoi) / 100;
      const totalDistributed = dailyReturn * Math.min(daysElapsed, 10);

      await Investment.create({
        userId: user._id,
        userCode: user.userCode,
        packageId: pkg._id,
        packageName: pkg.name,
        amount,
        dailyRoi: pkg.dailyRoi,
        duration: pkg.duration,
        expectedDailyReturn: dailyReturn,
        totalExpectedReturn: dailyReturn * pkg.duration,
        totalDistributed,
        distributionStartDate: investmentDate,
        maturityDate: new Date(investmentDate.getTime() + pkg.duration * 24 * 60 * 60 * 1000),
        daysRemaining: pkg.duration - daysElapsed,
        status: 'active',
        createdAt: investmentDate,
        updatedAt: investmentDate,
      });

      // Update wallets
      await Wallet.findOneAndUpdate(
        { userId: user._id, walletType: 'investment' },
        { $inc: { balance: amount, totalInvested: amount } }
      );

      await Wallet.findOneAndUpdate(
        { userId: user._id, walletType: 'roi' },
        { $inc: { balance: totalDistributed, totalEarned: totalDistributed } }
      );

      // Update binary business upline
      await updateBinaryBusinessUpline(user.binaryParentId, user.binaryPosition, amount);

      // Create level income for sponsor
      if (user.sponsorId) {
        const commission = amount * 0.05; // 5% level 1
        
        await Commission.create({
          userId: user.sponsorId,
          userCode: user.sponsorCode,
          fromUserId: user._id,
          fromUserCode: user.userCode,
          type: 'level',
          level: 1,
          amount: commission,
          percentage: 5,
          sourceType: 'investment',
          sourceAmount: amount,
          status: 'approved',
          createdAt: investmentDate,
        });

        await Wallet.findOneAndUpdate(
          { userId: user.sponsorId, walletType: 'level' },
          { $inc: { balance: commission, totalEarned: commission } }
        );
      }

      investmentCount++;
      if (investmentCount % 10 === 0) {
        console.log(`  ✅ ${investmentCount} investments created...`);
      }
    }

    console.log(`\n✅ ${investmentCount} investments created\n`);

    // ==================== GENERATE HISTORICAL DATA ====================

    console.log('📊 Generating 10 days historical data...');

    for (let day = 0; day < 10; day++) {
      const date = new Date(CONFIG.START_DATE.getTime() + day * 24 * 60 * 60 * 1000);
      console.log(`  📅 Day ${day + 1}: ${date.toISOString().split('T')[0]}`);

      // ROI Distribution
      const activeInvestments = await Investment.find({
        status: 'active',
        distributionStartDate: { $lte: date },
      });

      for (const investment of activeInvestments) {
        const dailyReturn = investment.expectedDailyReturn;

        await IncomeDistribution.create({
          userId: investment.userId,
          userCode: investment.userCode,
          investmentId: investment._id,
          incomeType: 'roi',
          amount: dailyReturn,
          distributionDate: date,
          status: 'paid',
          createdAt: date,
        });
      }

      // Binary Income
      const usersWithBusiness = await User.find({
        $or: [
          { 'binaryTeam.leftBusiness': { $gt: 0 } },
          { 'binaryTeam.rightBusiness': { $gt: 0 } },
        ],
      });

      for (const user of usersWithBusiness) {
        const leftBusiness = user.binaryTeam.leftBusiness + (user.binaryTeam.carryForward?.left || 0);
        const rightBusiness = user.binaryTeam.rightBusiness + (user.binaryTeam.carryForward?.right || 0);

        if (leftBusiness === 0 || rightBusiness === 0) continue;

        const pairValue = 1000;
        const commissionPerPair = 100;
        const weakerLeg = Math.min(leftBusiness, rightBusiness);
        const pairs = Math.floor(weakerLeg / pairValue);

        if (pairs > 0) {
          const commission = pairs * commissionPerPair;
          const usedBusiness = pairs * pairValue;

          await BinaryTransaction.create({
            userId: user._id,
            userCode: user.userCode,
            cycleDate: date,
            leftBusiness: user.binaryTeam.leftBusiness,
            rightBusiness: user.binaryTeam.rightBusiness,
            pairsMatched: pairs,
            finalCommission: commission,
            status: 'paid',
            createdAt: date,
          });

          await Wallet.findOneAndUpdate(
            { userId: user._id, walletType: 'binary' },
            { $inc: { balance: commission, totalEarned: commission } }
          );

          user.binaryTeam.carryForward = {
            left: leftBusiness > rightBusiness ? leftBusiness - usedBusiness : 0,
            right: rightBusiness > leftBusiness ? rightBusiness - usedBusiness : 0,
          };
          user.binaryTeam.leftBusiness = 0;
          user.binaryTeam.rightBusiness = 0;
          await user.save();
        }
      }
    }

    console.log('\n✅ Historical data generated\n');

    // SUMMARY
    const totalUsers = await User.countDocuments();
    const totalInvestments = await Investment.countDocuments();
    const totalInvested = await Investment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalROI = await Wallet.aggregate([
      { $match: { walletType: 'roi' } },
      { $group: { _id: null, total: { $sum: '$totalEarned' } } },
    ]);
    const totalBinary = await Wallet.aggregate([
      { $match: { walletType: 'binary' } },
      { $group: { _id: null, total: { $sum: '$totalEarned' } } },
    ]);

    console.log('📊 GENERATION SUMMARY');
    console.log('═'.repeat(50));
    console.log(`👥 Total Users:           ${totalUsers}`);
    console.log(`💰 Total Investments:     ${totalInvestments}`);
    console.log(`💵 Total Invested Amount: ₹${totalInvested[0]?.total.toLocaleString() || 0}`);
    console.log(`💸 Total ROI Distributed: ₹${totalROI[0]?.total.toLocaleString() || 0}`);
    console.log(`🌳 Total Binary Income:   ₹${totalBinary[0]?.total.toLocaleString() || 0}`);
    console.log('═'.repeat(50));

    console.log('\n🎉 TEST DATA GENERATION COMPLETE!\n');
    console.log('📋 TEST CREDENTIALS:');
    console.log('Password: Test@123\n');

    const sampleUsers = await User.find().limit(5).select('userCode fullName email');
    console.log('Sample users:');
    sampleUsers.forEach(u => {
      console.log(`  - ${u.userCode}: ${u.email} (${u.fullName.firstName} ${u.fullName.lastName})`);
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function updateBinaryBusinessUpline(parentId, position, amount) {
  if (!parentId) return;

  let currentUser = await User.findById(parentId);

  while (currentUser) {
    if (position === 'left') {
      currentUser.binaryTeam.leftBusiness += amount;
    } else {
      currentUser.binaryTeam.rightBusiness += amount;
    }

    await currentUser.save();

    if (!currentUser.binaryParentId) break;

    position = currentUser.binaryPosition;
    currentUser = await User.findById(currentUser.binaryParentId);
  }
}

generateTestData();
