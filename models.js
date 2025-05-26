// Database models module
const mongoose = require('mongoose');

// Initialize variables to hold models
let User, Log, Order, Transaction, Referral;

/**
 * Initialize all database models
 * @param {Object} mongooseInstance - Connected Mongoose instance
 */
function initModels(mongooseInstance) {
  // User schema - stores user information and balance
  const userSchema = new mongooseInstance.Schema({
    _id: mongooseInstance.Schema.Types.ObjectId,
    tgId: { type: String, required: true, index: true },
    name: String,
    username: String,
    balance: { type: Number, default: 0 },
    referralBalance: { type: Number, default: 0 }, // New: Separate balance for referral earnings
    totalDeposits: { type: Number, default: 0 }, // Total historical deposits
    referrerId: { type: String, default: null }, // New: Store ID of user who referred this user
    createdAt: { type: Date, default: Date.now }
  });

  // Log schema - stores available logs for purchase
  const logSchema = new mongooseInstance.Schema({
    _id: mongooseInstance.Schema.Types.ObjectId,
    values: Array,
    url: { type: String, required: true, unique: true },
    price: Number,
    country: String
  });

  // Order schema - stores completed purchases
  const orderSchema = new mongooseInstance.Schema({
    _id: mongooseInstance.Schema.Types.ObjectId,
    buyerId: String,
    buyerUsername: String,
    query: String,
    url: String,
    price: Number,
    country: String,
    usedReferralBalance: { type: Boolean, default: false }, // New: Indicates if referral balance was used
    referralAmount: { type: Number, default: 0 }, // New: Amount of referral balance used
    timestamp: { type: Date, default: Date.now }
  });

  // Transaction schema - stores all financial transactions
  const transactionSchema = new mongooseInstance.Schema({
    _id: mongooseInstance.Schema.Types.ObjectId,
    userId: String,
    amount: Number,
    type: { type: String, enum: ['deposit', 'purchase', 'admin_deposit', 'referral_reward'] }, // Added referral_reward
    status: { type: String, enum: ['pending', 'completed', 'failed', 'expired', 'cancelled'] },
    cryptoAddress: String,
    cryptoAmount: Number,
    cryptoType: { type: String, enum: ['eth', 'sol'] }, // Changed from btcAddress/btcAmount/btcRate
    cryptoRate: Number,
    referralId: { type: String, default: null }, // New: Store ID of referrer if transaction is a referral deposit
    timestamp: { type: Date, default: Date.now }
  });

  // New: Referral schema - stores all referrals
  const referralSchema = new mongooseInstance.Schema({
    _id: mongooseInstance.Schema.Types.ObjectId,
    referrerId: String, // User who referred
    referredId: String, // User who was referred
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    reward: { type: Number, default: 0 }, // Reward amount when referral completes
    transactionId: { type: String, default: null }, // Transaction that triggered the referral reward
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null } // When referral was completed (first purchase)
  });

  // Create models
  User = mongooseInstance.model('users', userSchema);
  Log = mongooseInstance.model('logs', logSchema);
  Order = mongooseInstance.model('orders', orderSchema);
  Transaction = mongooseInstance.model('transactions', transactionSchema);
  Referral = mongooseInstance.model('referrals', referralSchema); // New model
  
  console.log('[INFO] Database models initialized');
  
  // Return the models for immediate use
  return {
    User,
    Log,
    Order,
    Transaction,
    Referral
  };
}

// Export the models and initialization function
module.exports = {
  initModels,
  get User() { return User; },
  get Log() { return Log; },
  get Order() { return Order; },
  get Transaction() { return Transaction; },
  get Referral() { return Referral; }
};