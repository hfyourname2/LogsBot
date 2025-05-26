// Utility functions
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

// Import models (using require to avoid circular dependencies)
const models = require('./models');

/**
 * Check if a user is an admin
 * @param {String} userId - Telegram user ID
 * @returns {Boolean} True if user is admin
 */
function isAdmin(userId) {
  return global.ADMIN_IDS.includes(userId.toString());
}

/**
 * Process a completed payment by updating user's balance
 * @param {String} userId - Telegram user ID
 * @param {Number} amountUSD - Amount in USD to add to balance
 * @param {String} paymentId - Payment ID for tracking
 * @param {String} referralId - Referrer's ID (if applicable)
 */
async function processCompletedPayment(userId, amountUSD, paymentId, referralId = null) {
  try {
    const user = await models.User.findOne({ tgId: userId });
    
    if (!user) {
      console.error(`[ERROR] User ${userId} not found for payment processing`);
      return false;
    }
    
    // Update user balance and total deposits
    user.balance += amountUSD;
    user.totalDeposits = (user.totalDeposits || 0) + amountUSD;
    await user.save();
    
    console.log(`[INFO] Updated balance for user ${userId}: +$${amountUSD}, new balance: $${user.balance}, total deposits: $${user.totalDeposits}`);
    
    // Find transaction and mark it as completed
    const transaction = await models.Transaction.findOne({ 
      userId: userId,
      status: 'pending',
      cryptoAddress: { $exists: true }
    });
    
    if (transaction) {
      transaction.status = 'completed';
      await transaction.save();
    }
    
    // Handle referral reward if this is the user's first deposit and they were referred
    if (user.referrerId && user.totalDeposits === amountUSD) {
      // This is their first deposit, process the referral reward
      await processReferralReward(user.referrerId, userId, amountUSD);
    }
    
    // Try to notify user about successful payment
    if (global.bot) {
      try {
        await global.bot.telegram.sendMessage(
          userId,
          `✅ Your payment of $${amountUSD.toFixed(2)} has been received.\n\n` +
          `💰 Your balance: $${user.balance.toFixed(2)}\n` +
          `📊 Total deposits: $${user.totalDeposits.toFixed(2)}`
        );
      } catch (notifyError) {
        console.error(`[ERROR] Failed to notify user ${userId} about successful payment:`, notifyError);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to process payment for user ${userId}:`, error);
    return false;
  }
}

/**
 * Process a referral reward
 * @param {String} referrerId - Referrer user ID
 * @param {String} referredId - Referred user ID
 * @param {Number} depositAmount - Amount of the deposit
 */
async function processReferralReward(referrerId, referredId, depositAmount) {
  try {
    // Fixed referral reward amount
    const rewardAmount = 10;
    
    // Get the referrer from database
    const referrer = await models.User.findOne({ tgId: referrerId });
    if (!referrer) {
      console.error(`[ERROR] Referrer ${referrerId} not found for referral processing`);
      return false;
    }
    
    // Update referrer's referral balance
    referrer.referralBalance = (referrer.referralBalance || 0) + rewardAmount;
    await referrer.save();
    
    // Create a transaction record for the referral reward
    const transaction = new models.Transaction({
      _id: new mongoose.Types.ObjectId(),
      userId: referrerId,
      amount: rewardAmount,
      type: 'referral_reward',
      status: 'completed',
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Create or update the referral record
    const existingReferral = await models.Referral.findOne({
      referrerId: referrerId,
      referredId: referredId
    });
    
    if (existingReferral) {
      existingReferral.status = 'completed';
      existingReferral.reward = rewardAmount;
      existingReferral.completedAt = new Date();
      existingReferral.transactionId = transaction._id.toString();
      await existingReferral.save();
    } else {
      const referral = new models.Referral({
        _id: new mongoose.Types.ObjectId(),
        referrerId: referrerId,
        referredId: referredId,
        status: 'completed',
        reward: rewardAmount,
        transactionId: transaction._id.toString(),
        createdAt: new Date(),
        completedAt: new Date()
      });
      
      await referral.save();
    }
    
    console.log(`[INFO] Processed referral reward: ${referrerId} received $${rewardAmount} for referring ${referredId}`);
    
    // Notify the referrer
    if (global.bot) {
      try {
        await global.bot.telegram.sendMessage(
          referrerId,
          `🎉 <b>Congratulations!</b> You've earned a $${rewardAmount} referral reward!\n\n` +
          `A user you referred has made their first deposit. The reward has been added to your referral balance.\n\n` +
          `💰 Your referral balance: $${referrer.referralBalance.toFixed(2)}\n\n` +
          `You can use your referral balance to purchase logs or transfer it to your main balance.`,
          { parse_mode: 'html' }
        );
      } catch (notifyError) {
        console.error(`[ERROR] Failed to notify referrer ${referrerId} about referral reward:`, notifyError);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to process referral reward:`, error);
    return false;
  }
}

/**
 * Add a new referral record
 * @param {String} referrerId - User ID of referrer
 * @param {String} referredId - User ID of referred user
 * @returns {Promise<Object>} Result of the operation
 */
async function addReferral(referrerId, referredId) {
  try {
    // Check if referrer exists
    const referrer = await models.User.findOne({ tgId: referrerId });
    if (!referrer) {
      return { success: false, message: `Referrer user with ID ${referrerId} not found` };
    }
    
    // Check if referred user exists
    const referred = await models.User.findOne({ tgId: referredId });
    if (!referred) {
      return { success: false, message: `Referred user with ID ${referredId} not found` };
    }
    
    // Check if this referral already exists
    const existingReferral = await models.Referral.findOne({
      referrerId: referrerId,
      referredId: referredId
    });
    
    if (existingReferral) {
      return { success: false, message: 'This referral already exists' };
    }
    
    // Create new referral record
    const referral = new models.Referral({
      _id: new mongoose.Types.ObjectId(),
      referrerId: referrerId,
      referredId: referredId,
      status: 'pending',
      createdAt: new Date()
    });
    
    await referral.save();
    
    // Update the referred user to store their referrer
    referred.referrerId = referrerId;
    await referred.save();
    
    console.log(`[INFO] Added referral: ${referrerId} referred ${referredId}`);
    
    return { 
      success: true, 
      message: `Successfully added referral from ${referrerId} to ${referredId}`,
      referralId: referral._id.toString()
    };
  } catch (error) {
    console.error(`[ERROR] Failed to add referral:`, error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Add funds to a user's account by admin
 * @param {String} userId - Telegram user ID
 * @param {Number} amount - Amount in USD to add
 * @returns {Promise<Object>} Result of the operation
 */
async function addFundsToUser(userId, amount) {
  try {
    // Find user by Telegram ID
    const user = await models.User.findOne({ tgId: userId });
    
    if (!user) {
      return { success: false, message: `User with ID ${userId} not found` };
    }
    
    // Update user balance and total deposits
    user.balance += amount;
    user.totalDeposits = (user.totalDeposits || 0) + amount;
    await user.save();
    
    // Create a transaction record
    const transaction = new models.Transaction({
      _id: new mongoose.Types.ObjectId(),
      userId: userId,
      amount: amount,
      type: 'admin_deposit',
      status: 'completed',
      timestamp: new Date()
    });
    
    await transaction.save();
    
    // Log the action
    console.log(`[INFO] Admin added $${amount} to user ${userId} (${user.username}). New balance: $${user.balance}, total deposits: $${user.totalDeposits}`);
    
    // Notify user if possible
    if (global.bot) {
      try {
        await global.bot.telegram.sendMessage(
          userId,
          `💰 Your account has been credited with $${amount.toFixed(2)} by an admin.\n\n` +
          `💵 Your balance: $${user.balance.toFixed(2)}\n` +
          `📊 Total deposits: $${user.totalDeposits.toFixed(2)}`
        );
      } catch (notifyError) {
        console.error(`[ERROR] Failed to notify user ${userId} about admin deposit:`, notifyError);
      }
    }
    
    return { 
      success: true, 
      message: `Successfully added $${amount} to user ${userId} (${user.username})`,
      newBalance: user.balance,
      totalDeposits: user.totalDeposits
    };
  } catch (error) {
    console.error(`[ERROR] Failed to add funds to user ${userId}:`, error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Transfer funds from referral balance to main balance
 * @param {String} userId - Telegram user ID
 * @param {Number} amount - Amount in USD to transfer (or 'all' to transfer entire balance)
 * @returns {Promise<Object>} Result of the operation
 */
async function transferReferralFunds(userId, amount) {
  try {
    // Find user by Telegram ID
    const user = await models.User.findOne({ tgId: userId });
    
    if (!user) {
      return { success: false, message: `User with ID ${userId} not found` };
    }
    
    // Make sure user has a referral balance
    if (!user.referralBalance || user.referralBalance <= 0) {
      return { success: false, message: `User has no referral balance to transfer` };
    }
    
    // Check minimum amount requirement
    if (user.referralBalance < 60) {
      return { success: false, message: `Minimum transfer amount is $60. Your current referral balance is $${user.referralBalance.toFixed(2)}` };
    }
    
    // Determine amount to transfer
    let transferAmount = 0;
    if (amount === 'all') {
      transferAmount = user.referralBalance;
    } else {
      transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return { success: false, message: `Invalid amount: ${amount}` };
      }
      
      // Check minimum transfer amount if not transferring all
      if (transferAmount < 60) {
        return { success: false, message: `Minimum transfer amount is $60` };
      }
      
      if (transferAmount > user.referralBalance) {
        return { success: false, message: `Insufficient referral balance. Available: $${user.referralBalance.toFixed(2)}` };
      }
    }
    
    // Update balances
    user.balance += transferAmount;
    user.referralBalance -= transferAmount;
    await user.save();
    
    console.log(`[INFO] Transferred $${transferAmount} from referral to main balance for user ${userId}. New referral balance: $${user.referralBalance.toFixed(2)}, new main balance: $${user.balance.toFixed(2)}`);
    
    return { 
      success: true, 
      message: `Successfully transferred $${transferAmount.toFixed(2)} from referral balance to main balance`,
      newBalance: user.balance,
      newReferralBalance: user.referralBalance
    };
  } catch (error) {
    console.error(`[ERROR] Failed to transfer referral funds for user ${userId}:`, error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

/**
 * Generate a progress bar based on percentage
 * @param {Number} percent - Percentage complete (0-100)
 * @returns {String} ASCII progress bar
 */
function getProgressBar(percent) {
  const completed = Math.floor(percent / 10);
  const remaining = 10 - completed;
  return '▓'.repeat(completed) + '░'.repeat(remaining);
}

/**
 * Generate a user's referral link
 * @param {String} userId - Telegram user ID
 * @returns {String} Referral link
 */
function generateReferralLink(userId) {
  // Format: http://t.me/@tss1992_bot?start={userId}
  return `http://t.me/${global.BOT_USERNAME}?start=${userId}`;
}

/**
 * Get a user's referral statistics
 * @param {String} userId - Telegram user ID
 * @returns {Promise<Object>} Referral statistics
 */
async function getReferralStats(userId) {
  try {
    // Find all referrals where this user is the referrer
    const referrals = await models.Referral.find({ referrerId: userId });
    
    // Count total and completed referrals
    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter(r => r.status === 'completed').length;
    
    // Calculate total rewards
    const totalRewards = referrals.reduce((sum, ref) => sum + (ref.reward || 0), 0);
    
    // Get user's current referral balance
    const user = await models.User.findOne({ tgId: userId });
    const referralBalance = user ? (user.referralBalance || 0) : 0;
    
    return {
      totalReferrals,
      completedReferrals,
      pendingReferrals: totalReferrals - completedReferrals,
      totalRewards,
      referralBalance
    };
  } catch (error) {
    console.error(`[ERROR] Failed to get referral stats for user ${userId}:`, error);
    return {
      totalReferrals: 0,
      completedReferrals: 0,
      pendingReferrals: 0,
      totalRewards: 0,
      referralBalance: 0
    };
  }
}

/**
 * Sync logs from file to database
 */
async function syncLogs() {
  try {
    if (!fs.existsSync('logs.txt')) {
      console.log('[INFO] logs.txt file not found, creating empty file');
      fs.writeFileSync('logs.txt', '');
      return 0;
    }
    
    const fileContent = fs.readFileSync('logs.txt', 'utf8');
    const logs = fileContent.split('\r\n');
    let addedCount = 0;
    
    for (const log of logs) {
      if (!log) continue;
      
      let parts = log.split('|');
      if (parts.length < 3) continue;
      
      // Check if log already exists
      const existingLog = await models.Log.findOne({ url: parts[1] });
      if (existingLog) continue;
      
      let newLog = new models.Log({
        _id: new mongoose.Types.ObjectId(),
        values: parts[0].split(';'),
        url: parts[1],
        price: global.LOG_PRICE,
        country: parts[3] || 'Unknown'
      });
      
      await newLog.save();
      addedCount++;
    }
    
    console.log(`[INFO] Sync completed: Added ${addedCount} new logs to database`);
    return addedCount;
  } catch (error) {
    console.error(`[ERROR] Failed to sync logs:`, error);
    return 0;
  }
}

// Export all utility functions
module.exports = {
  isAdmin,
  processCompletedPayment,
  processReferralReward,
  addReferral,
  addFundsToUser,
  transferReferralFunds,
  getProgressBar,
  generateReferralLink,
  getReferralStats,
  syncLogs
};