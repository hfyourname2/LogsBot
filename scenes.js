// Bot scenes module - Hauptdatei (minimale Version)
const path = require('path');
const mongoose = require('mongoose');
const Markup = require('telegraf/markup');
const WizardScene = require("telegraf/scenes/wizard");

// Import schemas for reference in functions
const models = require('./models');

/**
 * Welcome scene - Main menu
 * @param {String} lastUpdate - Last database update timestamp
 * @param {Number} logsAvailable - Number of available logs
 * @param {Function} isAdmin - Function to check if user is admin
 * @returns {Object} WizardScene instance
 */
function welcomeScene(lastUpdate, logsAvailable, isAdmin) {
  return new WizardScene(
    'welcome',
    async ctx => {
      try {
        // Initialize or update user session first
        await initializeUser(ctx, lastUpdate, logsAvailable);
        
        // Then try to display the welcome menu
        if (ctx.callbackQuery) {
          // If we have a callback query, edit the current message
          await displayWelcomeMenu(ctx, 'edit', lastUpdate, logsAvailable, isAdmin);
        } else {
          // Otherwise, send a new message
          await displayWelcomeMenu(ctx, 'new', lastUpdate, logsAvailable, isAdmin);
        }
      } catch (err) {
        console.error('[ERROR] Error in welcome scene:', err);
        // In case of any error, try to send a new message as fallback
        try {
          await displayWelcomeMenu(ctx, 'new', lastUpdate, logsAvailable, isAdmin);
        } catch (secondErr) {
          console.error('[ERROR] Failed to display welcome menu:', secondErr);
          // Last resort - try to send a simple message
          try {
            await ctx.reply('Welcome to Logs Marketplace! Use the menu below:', {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: '💰 Deposit Funds', callback_data: 'wallet_deposit' }],
                  [{ text: '🛒 Browse Logs', callback_data: 'buy_logs' }]
                ]
              })
            });
          } catch (finalErr) {
            console.error('[ERROR] All fallbacks failed:', finalErr);
          }
        }
      }
      return ctx.scene.leave();
    }
  );
}

/**
 * Display welcome menu with options
 * @param {Object} ctx - Telegram context
 * @param {String} mode - 'edit' for editMessageText, 'new' for reply
 * @param {String} lastUpdate - Last database update timestamp
 * @param {Number} logsAvailable - Number of available logs
 * @param {Function} isAdmin - Function to check if user is admin
 */
async function displayWelcomeMenu(ctx, mode, lastUpdate, logsAvailable, isAdmin) {
  // Get user's current data from database to ensure we have the latest values
  let balance = 0;
  let referralBalance = 0;
  let totalDeposits = 0;
  let tgId = ctx.from?.id?.toString() || ctx.session?.tgId;
  
  // Import required functions
  const { generateReferralLink, getReferralStats } = require('./utils');
  
  if (tgId) {
    try {
      const user = await models.User.findOne({ tgId: tgId });
      if (user) {
        balance = user.balance || 0;
        referralBalance = user.referralBalance || 0;
        totalDeposits = user.totalDeposits || 0;
        
        // Update session data
        if (ctx.session) {
          ctx.session.balance = balance;
          ctx.session.referralBalance = referralBalance;
          ctx.session.totalDeposits = totalDeposits;
          ctx.session.userId = user._id.toString();
          ctx.session.tgId = user.tgId;
          ctx.session.name = user.name;
          ctx.session.username = user.username;
        }
      } else {
        console.log(`[WARN] User with tgId ${tgId} not found in database`);
      }
    } catch (error) {
      console.error('[ERROR] Failed to get user data:', error);
      // Fall back to session data if available
      balance = ctx.session?.balance || 0;
      referralBalance = ctx.session?.referralBalance || 0;
      totalDeposits = ctx.session?.totalDeposits || 0;
    }
  }

  // Get referral stats for user
  let referralStats = {
    totalReferrals: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalRewards: 0
  };
  
  try {
    if (tgId) {
      referralStats = await getReferralStats(tgId);
    }
  } catch (error) {
    console.error('[ERROR] Failed to get referral stats:', error);
  }
  
  // Generate user's referral link
  const referralLink = tgId ? generateReferralLink(tgId) : '';

  const message = `✨ <b>Welcome to Logs Marketplace</b> ✨\n\n` +
    `The premier destination for high-quality logs. Browse our collection, select your desired items, and complete your purchase securely.\n\n` +
    `📊 <b>STATUS INFORMATION</b>\n` +
    `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
    `📥 <b>Last Update:</b> <code>${ctx.session?.lastUpdate || lastUpdate}</code>\n` +
    `🗂 <b>Available Logs:</b> <code>${ctx.session?.logsAvailable || logsAvailable}</code>\n` +
    `💰 <b>Your Balance:</b> <code>$${balance.toFixed(2)}</code>\n` +
    `🎁 <b>Referral Balance:</b> <code>$${referralBalance.toFixed(2)}</code>\n` +
    `📊 <b>Total Deposits:</b> <code>$${totalDeposits.toFixed(2)}</code>\n\n` +
    `👥 <b>REFERRAL PROGRAM</b>\n` +
    `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
    `👤 <b>Your Referrals:</b> <code>${referralStats.totalReferrals}</code> (${referralStats.completedReferrals} completed)\n` +
    `💵 <b>Referral Rewards:</b> <code>$${referralStats.totalRewards.toFixed(2)}</code>\n\n` +
    `<i>Select an option below to continue:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💰 Deposit Funds', callback_data: 'wallet_deposit' },
        { text: '🛒 Browse Logs', callback_data: 'buy_logs' }
      ],
      [
        { text: '🔗 Referral Program', callback_data: 'referral_menu' },
        { text: '📞 Support', callback_data: 'get_contact' }
      ],
      [
        ...(isAdmin(ctx.from?.id?.toString() || '') ? [{ text: '🔐 Admin Panel', callback_data: 'admin_panel' }] : [])
      ]
    ]
  };

  // Only attempt to edit if it's a callback query
  if (mode === 'edit' && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'html',
        reply_markup: JSON.stringify(keyboard),
        disable_web_page_preview: true
      });
      return; // Success - exit the function
    } catch (error) {
      console.log(`[INFO] Fallback to reply: ${error.message}`);
      // Continue to the reply method below on error
    }
  }
  
  // Always use reply if edit isn't possible or failed
  await ctx.reply(message, {
    parse_mode: 'html',
    reply_markup: JSON.stringify(keyboard),
    disable_web_page_preview: true
  });
}

/**
 * Initialize user session data
 * @param {Object} ctx - Telegram context
 * @param {String} lastUpdate - Last database update timestamp
 * @param {Number} logsAvailable - Number of available logs
 */
async function initializeUser(ctx, lastUpdate, logsAvailable) {
  // First check if we already have a valid session
  if (ctx.session?.userId && ctx.session?.tgId) {
    // Session exists, just refresh data from database
    try {
      const user = await models.User.findOne({ tgId: ctx.session.tgId });
      if (user) {
        // Update session with latest data
        ctx.session.balance = user.balance;
        ctx.session.totalDeposits = user.totalDeposits || 0;
        ctx.session.logsAvailable = logsAvailable;
        ctx.session.lastUpdate = lastUpdate;
      }
    } catch (error) {
      console.error('[ERROR] Failed to refresh user data:', error);
    }
    return; // No need to continue if we already have a session
  }

  // If we don't have a session, try to get user details from different sources
  let tgId = null;
  let name = null;
  let username = null;

  // Try to get user data from various sources in ctx
  if (ctx.from) {
    tgId = ctx.from.id.toString();
    name = ctx.from.first_name;
    username = ctx.from.username;
  } else if (ctx.update?.message?.from) {
    tgId = ctx.update.message.from.id.toString();
    name = ctx.update.message.from.first_name;
    username = ctx.update.message.from.username;
  } else if (ctx.update?.callback_query?.from) {
    tgId = ctx.update.callback_query.from.id.toString();
    name = ctx.update.callback_query.from.first_name;
    username = ctx.update.callback_query.from.username;
  } else if (ctx.callbackQuery?.from) {
    tgId = ctx.callbackQuery.from.id.toString();
    name = ctx.callbackQuery.from.first_name;
    username = ctx.callbackQuery.from.username;
  }

  // If we couldn't get a tgId, create a minimal session and exit
  if (!tgId) {
    console.log('[WARN] Could not determine user ID for session initialization');
    ctx.session = {
      balance: 0,
      totalDeposits: 0,
      logsAvailable: logsAvailable,
      lastUpdate: lastUpdate
    };
    return;
  }

  try {
    // Try to find existing user
    const user = await models.User.findOne({ tgId: tgId });
    
    if (!user) {
      // Create new user if not found
      const newUser = new models.User({
        _id: new mongoose.Types.ObjectId(),
        tgId: tgId,
        name: name || 'Unknown',
        username: username || 'NoUsername',
        balance: 0,
        totalDeposits: 0
      });
      
      await newUser.save();
      
      // Set session data
      ctx.session = {
        userId: newUser._id.toString(),
        tgId: newUser.tgId,
        name: newUser.name,
        username: newUser.username,
        balance: newUser.balance,
        totalDeposits: newUser.totalDeposits,
        logsAvailable: logsAvailable,
        lastUpdate: lastUpdate
      };
      
      console.log(`[INFO] <${newUser.username || 'Unknown'}> registered`);
    } else {
      // Set session data for existing user
      ctx.session = {
        userId: user._id.toString(),
        tgId: user.tgId,
        name: user.name,
        username: user.username,
        balance: user.balance,
        totalDeposits: user.totalDeposits || 0,
        logsAvailable: logsAvailable,
        lastUpdate: lastUpdate
      };
      
      console.log(`[INFO] <${user.username || 'Unknown'}> session initialized`);
    }
  } catch (error) {
    console.error('[ERROR] Failed to initialize user:', error);
    // Create a minimal session on error
    ctx.session = {
      tgId: tgId,
      name: name || 'Unknown',
      username: username || 'NoUsername',
      balance: 0,
      totalDeposits: 0,
      logsAvailable: logsAvailable,
      lastUpdate: lastUpdate
    };
  }
}

/**
 * Contact scene - For user support
 * @returns {Object} WizardScene instance
 */
function contactScene() {
  return new WizardScene(
    'contact',
    // Step 1: Show contact instructions
    ctx => {
      console.log(`[INFO] <${ctx.session?.username || ctx.from?.username || 'Unknown'}> opened Contact Page`);
      
      try {
        ctx.editMessageText(
          `Ask your question in this dialogue and it will be forwarded to the operator.\n\nAfter reviewing your request, they will contact you if necessary.`, 
          Markup.inlineKeyboard([
            Markup.callbackButton('Back', 'back'),
          ]).extra()
        );
      } catch (error) {
        ctx.reply(
          `Ask your question in this dialogue and it will be forwarded to the operator.\n\nAfter reviewing your request, they will contact you if necessary.`, 
          Markup.inlineKeyboard([
            Markup.callbackButton('Back', 'back'),
          ]).extra()
        );
      }
      
      return ctx.wizard.next();
    },
    // Step 2: Process user message and forward to admins
    async ctx => {
      if (!ctx.update.message || !ctx.update.message.text) {
        return ctx.scene.leave();
      }
      
      const message = ctx.update.message.text;
      
      // First, make sure we capture the user information correctly
      const userId = ctx.from?.id?.toString() || ctx.session?.tgId;
      const username = ctx.from?.username || ctx.session?.username || 'No Username';
      
      console.log(`[MESSAGE] User ID: ${userId}, Username: @${username}, Message: ${message}`);
      
      // Forward the message to all admins
      if (global.ADMIN_IDS && global.ADMIN_IDS.length > 0) {
        const adminNotification = `📩 <b>Support message from user:</b>\n\n` +
          `<b>User ID:</b> ${userId}\n` +
          `<b>Username:</b> @${username}\n\n` +
          `<b>Message:</b>\n${message}`;
        
        for (const adminId of global.ADMIN_IDS) {
          try {
            await global.bot.telegram.sendMessage(
              adminId,
              adminNotification,
              { 
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Answer', callback_data: `pm_user_${userId}` }]
                  ]
                })
              }
            );
            console.log(`[INFO] Support message forwarded to admin ${adminId}`);
          } catch (error) {
            console.error(`[ERROR] Failed to forward support message to admin ${adminId}:`, error);
          }
        }
      } else {
        console.warn('[WARN] No admin IDs configured. Support message not forwarded.');
      }
      
      // Confirm receipt to the user
      ctx.reply(
        `Your message has been recorded and forwarded to our support team. They will contact you soon.`, 
        Markup.inlineKeyboard([
          Markup.callbackButton('Back to Main Menu', 'back'),
        ]).extra()
      );
      
      return ctx.scene.leave();
    }
  );
}

module.exports = {
  welcomeScene,
  contactScene
};