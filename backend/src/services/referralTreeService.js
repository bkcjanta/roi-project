const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');


class ReferralTreeService {

  /**
   * Build complete referral tree on registration
   * Builds BOTH Level Income chain & Binary placement
   * @param {Object} newUser - New user object
   * @param {String} sponsorCode - Sponsor's referral code
   * @param {Object} session - Mongoose session for transaction
   * @returns {Object} Tree data
   */
  async buildTreeOnRegistration(newUser, sponsorCode, session) {
    try {
      logger.info(`🌲 Building referral tree for ${newUser.userCode}`);

      if (!sponsorCode) {
        logger.info('⚠️ No sponsor code, user becomes root');
        return { 
          uplineChain: [], 
          binaryPlacement: null,
          isRoot: true 
        };
      }

      // Find sponsor
      const queryOptions = session ? { session } : {};
      const sponsor = await User.findOne({ 
        userCode: sponsorCode.toUpperCase() 
      }, null, queryOptions);
      
      if (!sponsor) {
        throw new Error(`Sponsor code ${sponsorCode} not found`);
      }

      logger.info(`✅ Sponsor found: ${sponsor.userCode}`);

      // ========== PART 1: LEVEL INCOME TREE ==========
      
      // Build upline chain (Level 1 to 5)
      const uplineChain = await this.buildUplineChain(sponsor, session);

      // Update new user's level income data
      newUser.sponsorId = sponsor._id;
      newUser.sponsorCode = sponsor.userCode;
      newUser.uplineChain = uplineChain;
      newUser.referredBy = sponsor._id; // Legacy field

      // Update all upline's team counts
      await this.updateUplineTeamCounts(sponsor._id, session);

      logger.info(`✅ Level income chain: ${uplineChain.length} levels`);

      // ========== PART 2: BINARY TREE ==========
      
      // Find binary placement (spillover logic)
      const binaryPlacement = await this.findBinaryPlacement(sponsor, session);

      // Update new user's binary data
      newUser.binaryParentId = binaryPlacement.parentId;
      newUser.binaryPosition = binaryPlacement.position;

      // Update binary parent's count
      await this.updateBinaryParentCount(
        binaryPlacement.parentId, 
        binaryPlacement.position, 
        session
      );

      logger.info(`✅ Binary placement: ${binaryPlacement.position} of ${binaryPlacement.parentCode}`);

      return {
        uplineChain: uplineChain,
        binaryPlacement: binaryPlacement,
        isRoot: false,
      };

    } catch (error) {
      logger.error('❌ Build tree error:', error);
      throw error;
    }
  }

  /**
   * Build upline chain for level income (Level 1-5)
   * @param {Object} sponsor - Sponsor user object
   * @param {Object} session - Mongoose session
   * @param {Number} maxLevels - Maximum levels (default 5)
   * @returns {Array} Upline chain
   */
  async buildUplineChain(sponsor, session, maxLevels = 5) {
    const uplineChain = [];
    let currentUser = sponsor;
    let level = 1;

    const queryOptions = session ? { session } : {};

    while (currentUser && level <= maxLevels) {
      uplineChain.push({
        userId: currentUser._id,
        userCode: currentUser.userCode,
        level: level,
      });

      // Move to next upline
      if (currentUser.sponsorId) {
        currentUser = await User.findById(currentUser.sponsorId, null, queryOptions);
        level++;
      } else {
        break; // Reached root
      }
    }

    logger.info(`Built upline chain: ${uplineChain.map(u => `L${u.level}:${u.userCode}`).join(' <- ')}`);

    return uplineChain;
  }

  /**
   * Update team counts for all upline (Level 1-5)
   * @param {ObjectId} sponsorId - Sponsor's ID
   * @param {Object} session - Mongoose session
   */
  async updateUplineTeamCounts(sponsorId, session) {
    let currentId = sponsorId;
    let level = 1;

    const updateOptions = session ? { session, new: true } : { new: true };

    while (currentId && level <= 5) {
      const updateField = `teamCount.level${level}`;
      
      const updatedUser = await User.findByIdAndUpdate(
        currentId,
        { 
          $inc: { 
            [updateField]: 1,
            'teamCount.total': 1,
            totalDirectReferrals: level === 1 ? 1 : 0,
            totalTeamSize: 1,
          }
        },
        updateOptions
      );

      if (updatedUser) {
        logger.info(`✅ Updated ${updatedUser.userCode} team count level ${level}: ${updatedUser.teamCount[`level${level}`]}`);
      }

      // Move to next upline
      currentId = updatedUser?.sponsorId;
      level++;
    }
  }

  /**
   * Find binary tree placement using spillover logic
   * Fills left first, then right, then uses BFS for downline
   * @param {Object} sponsor - Sponsor user object
   * @param {Object} session - Mongoose session
   * @returns {Object} Placement info
   */
  async findBinaryPlacement(sponsor, session) {
    try {
      const queryOptions = session ? { session } : {};
      
      // Check if sponsor has DIRECT children (not count)
      const leftChild = await User.findOne({
        binaryParentId: sponsor._id,
        binaryPosition: 'left',
      }, null, queryOptions);

      const rightChild = await User.findOne({
        binaryParentId: sponsor._id,
        binaryPosition: 'right',
      }, null, queryOptions);

      // Left slot empty?
      if (!leftChild) {
        logger.info(`Placing in LEFT slot of ${sponsor.userCode}`);
        return {
          parentId: sponsor._id,
          parentCode: sponsor.userCode,
          position: 'left',
        };
      }

      // Right slot empty?
      if (!rightChild) {
        logger.info(`Placing in RIGHT slot of ${sponsor.userCode}`);
        return {
          parentId: sponsor._id,
          parentCode: sponsor.userCode,
          position: 'right',
        };
      }

      // Both slots filled, find spillover position
      logger.info(`Both direct slots filled for ${sponsor.userCode}, finding spillover...`);
      return await this.findSpilloverPosition(sponsor._id, session);

    } catch (error) {
      logger.error('Find binary placement error:', error);
      throw error;
    }
  }

  /**
   * Find spillover position using BFS (Breadth-First Search)
   * Searches downline for first available position
   * @param {ObjectId} rootId - Root user ID to start search
   * @param {Object} session - Mongoose session
   * @returns {Object} Placement info
   */
  async findSpilloverPosition(rootId, session) {
    const queue = [rootId];
    const visited = new Set();
    let iterations = 0;
    const maxIterations = 1000;

    const queryOptions = session ? { session } : {};

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const currentId = queue.shift();

      // Skip if already visited
      if (visited.has(currentId.toString())) continue;
      visited.add(currentId.toString());

      const user = await User.findById(currentId).select('userCode');
      if (!user) continue;

      // Check actual direct children, not counts
      const leftChild = await User.findOne({
        binaryParentId: currentId,
        binaryPosition: 'left',
      }, null, queryOptions);

      const rightChild = await User.findOne({
        binaryParentId: currentId,
        binaryPosition: 'right',
      }, null, queryOptions);

      // Check left slot
      if (!leftChild) {
        logger.info(`Found spillover: LEFT slot of ${user.userCode}`);
        return {
          parentId: currentId,
          parentCode: user.userCode,
          position: 'left',
        };
      }

      // Check right slot
      if (!rightChild) {
        logger.info(`Found spillover: RIGHT slot of ${user.userCode}`);
        return {
          parentId: currentId,
          parentCode: user.userCode,
          position: 'right',
        };
      }

      // Both slots filled, add children to queue for BFS
      queue.push(leftChild._id);
      queue.push(rightChild._id);

      logger.info(`BFS: ${user.userCode} full, added children to queue (${queue.length} remaining)`);
    }

    if (iterations >= maxIterations) {
      throw new Error('Max iterations reached in spillover search');
    }

    throw new Error('No binary position found');
  }

  /**
   * Update binary parent's team count
   * @param {ObjectId} parentId - Parent's ID
   * @param {String} position - 'left' or 'right'
   * @param {Object} session - Mongoose session
   */
  async updateBinaryParentCount(parentId, position, session) {
    const updateField = position === 'left' 
      ? 'binaryTeam.leftCount' 
      : 'binaryTeam.rightCount';

    const updateOptions = session ? { session, new: true } : { new: true };

    const updatedParent = await User.findByIdAndUpdate(
      parentId,
      { $inc: { [updateField]: 1 } },
      updateOptions
    );

    if (updatedParent) {
      const countValue = position === 'left' 
        ? updatedParent.binaryTeam.leftCount 
        : updatedParent.binaryTeam.rightCount;
      logger.info(`✅ Updated ${updatedParent.userCode}: ${position} count = ${countValue}`);
    } else {
      logger.error(`❌ Failed to update binary parent count for ${parentId}`);
    }
  }

  /**
   * Get user's referral tree (Level Income)
   * @param {String} userId - User ID
   * @returns {Object} Referral tree data
   */
  async getUserReferralTree(userId) {
    try {
      const user = await User.findById(userId)
        .select('userCode sponsorCode uplineChain teamCount')
        .populate('sponsorId', 'userCode fullName')
        .populate('uplineChain.userId', 'userCode fullName');

      // Get direct referrals (Level 1)
      const directReferrals = await User.find({ sponsorId: userId })
        .select('userCode fullName email createdAt teamCount accountStatus')
        .sort({ createdAt: -1 });

      return {
        user: {
          userCode: user.userCode,
          sponsor: user.sponsorId,
          upline: user.uplineChain,
          teamCount: user.teamCount,
        },
        directReferrals: directReferrals,
        stats: {
          totalTeam: user.teamCount.total,
          level1: user.teamCount.level1,
          level2: user.teamCount.level2,
          level3: user.teamCount.level3,
          level4: user.teamCount.level4,
          level5: user.teamCount.level5,
        },
      };

    } catch (error) {
      logger.error('Get referral tree error:', error);
      throw error;
    }
  }

  /**
   * Get user's binary tree
   * @param {String} userId - User ID
   * @returns {Object} Binary tree data
   */
  async getUserBinaryTree(userId) {
    try {
      const user = await User.findById(userId)
        .select('userCode binaryParentId binaryPosition binaryTeam')
        .populate('binaryParentId', 'userCode fullName');

      // Get direct binary children
      const leftChild = await User.findOne({
        binaryParentId: userId,
        binaryPosition: 'left',
      }).select('userCode fullName binaryTeam accountStatus');

      const rightChild = await User.findOne({
        binaryParentId: userId,
        binaryPosition: 'right',
      }).select('userCode fullName binaryTeam accountStatus');

      return {
        user: {
          userCode: user.userCode,
          parent: user.binaryParentId,
          position: user.binaryPosition,
          team: user.binaryTeam,
        },
        children: {
          left: leftChild,
          right: rightChild,
        },
        stats: {
          leftCount: user.binaryTeam.leftCount,
          rightCount: user.binaryTeam.rightCount,
          leftBusiness: user.binaryTeam.leftBusiness,
          rightBusiness: user.binaryTeam.rightBusiness,
          totalPairs: user.binaryTeam.totalPairs,
          carryForward: user.binaryTeam.carryForward,
        },
      };

    } catch (error) {
      logger.error('Get binary tree error:', error);
      throw error;
    }
  }

  /**
   * Get team members at specific level
   * @param {String} userId - User ID
   * @param {Number} level - Level number (1-5)
   * @returns {Array} Team members
   */
  async getTeamByLevel(userId, level = 1) {
    try {
      if (level === 1) {
        // Direct referrals
        return await User.find({ sponsorId: userId })
          .select('userCode fullName email createdAt accountStatus')
          .sort({ createdAt: -1 });
      }

      // For level 2-5, find users where this user is in their upline chain
      return await User.find({
        'uplineChain.userId': userId,
        'uplineChain.level': level,
      })
        .select('userCode fullName email createdAt accountStatus')
        .sort({ createdAt: -1 });

    } catch (error) {
      logger.error('Get team by level error:', error);
      throw error;
    }
  }
}

module.exports = new ReferralTreeService();
