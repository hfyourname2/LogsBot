
// Required imports
const path = require('path');
const mongoose = require('mongoose');
const Markup = require('telegraf/markup');
const WizardScene = require("telegraf/scenes/wizard");

// Import the models
const models = require('./models');


/**
 * Admin panel scene - For administrators only
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Function} addFundsToUser - Function to add funds to user
 * @param {Object} LOG_PRICES - Category prices configuration
 * @param {Number} LOG_PRICE - Default log price
 * @returns {Object} WizardScene instance
 */
function adminScene(isAdmin, addFundsToUser, LOG_PRICES, LOG_PRICE) {
  return new WizardScene(
    'admin_panel',
    // Step 1: Show admin panel menu
    ctx => {
      console.log(`[INFO] <${ctx.session?.username || 'Admin'}> opened Admin Panel`);
      
      if (!isAdmin(ctx.from.id.toString())) {
        ctx.reply('❌ Access denied. This panel is restricted to administrators only.');
        return ctx.scene.leave();
      }
      
      // Store current menu state to prevent Back button issues
      ctx.session.adminState = 'main';
      
      try {
        ctx.editMessageText(
          `🔐 <b>Admin Control Panel</b>\n\nWelcome, Administrator. Select an option below:`,
          {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: '📊 Show Prices', callback_data: 'admin_prices' },
                  { text: '📢 Broadcast', callback_data: 'admin_broadcast' }
                ],
                [
                  { text: '📧 Message User', callback_data: 'admin_pm' },
                  { text: '💰 Add Funds', callback_data: 'admin_funds' }
                ],
                [
                  { text: '👥 List Users', callback_data: 'admin_users' }
                ],
                [
                  { text: 'Back to Main Menu', callback_data: 'back' }
                ]
              ]
            })
          }
        );
      } catch (error) {
        // If there's an error editing the message, send a new one instead
        ctx.reply(
          `🔐 <b>Admin Control Panel</b>\n\nWelcome, Administrator. Select an option below:`,
          {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: '📊 Show Prices', callback_data: 'admin_prices' },
                  { text: '📢 Broadcast', callback_data: 'admin_broadcast' }
                ],
                [
                  { text: '📧 Message User', callback_data: 'admin_pm' },
                  { text: '💰 Add Funds', callback_data: 'admin_funds' }
                ],
                [
                  { text: '👥 List Users', callback_data: 'admin_users' }
                ],
                [
                  { text: 'Back to Main Menu', callback_data: 'back' }
                ]
              ]
            })
          }
        );
      }
      return ctx.wizard.next();
    },
    // Step 2: Handle admin panel actions
    async ctx => {
      if (!ctx.update.callback_query && !ctx.update.message) {
        return ctx.scene.leave();
      }
      
      // Process callback queries (button presses)
      if (ctx.update.callback_query) {
        const action = ctx.update.callback_query.data;
        
        // Handle back action - return to main menu
        if (action === 'back') {
          return ctx.scene.leave();
        }
        
        // Handle return to admin panel
        if (action === 'admin_back') {
          ctx.session.adminState = 'main';
          
          // Return to the main admin panel
          await ctx.editMessageText(
            `🔐 <b>Admin Control Panel</b>\n\nWelcome, Administrator. Select an option below:`,
            {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    { text: '📊 Show Prices', callback_data: 'admin_prices' },
                    { text: '📢 Broadcast', callback_data: 'admin_broadcast' }
                  ],
                  [
                    { text: '📧 Message User', callback_data: 'admin_pm' },
                    { text: '💰 Add Funds', callback_data: 'admin_funds' }
                  ],
                  [
                    { text: '👥 List Users', callback_data: 'admin_users' }
                  ],
                  [
                    { text: 'Back to Main Menu', callback_data: 'back' }
                  ]
                ]
              })
            }
          );
          
          return;
        }
        
        // Show current log prices
        if (action === 'admin_prices') {
          ctx.session.adminState = 'prices';
          
          let priceInfo = '💲 <b>Current Log Prices</b>\n\n';
          
          for (const category in LOG_PRICES) {
            priceInfo += `<b>${category.charAt(0).toUpperCase() + category.slice(1)}:</b> $${LOG_PRICES[category]}\n`;
          }
          
          priceInfo += `\n<b>Default Price:</b> $${LOG_PRICE}`;
          
          await ctx.editMessageText(priceInfo, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Update Price', callback_data: 'admin_update_price' }],
                [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
              ]
            })
          });
        } 
        // Broadcast message to all users
        else if (action === 'admin_broadcast') {
          ctx.session.adminState = 'broadcast';
          
          // Store the awaiting broadcast state
          ctx.session.awaitingBroadcast = true;
          
          await ctx.editMessageText(
            `📢 <b>Broadcast Message</b>\n\nPlease type the message you want to send to all users:`,
            {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            }
          );
        }
        // Send message to specific user
        else if (action === 'admin_pm') {
          ctx.session.adminState = 'pm';
          
          // Fetch users for selection buttons
          const users = await models.User.find({}).limit(20);
          
          if (!users || users.length === 0) {
            await ctx.editMessageText('No users found in the database.', {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            });
            return;
          }
          
          // Create user selection keyboard
          const keyboard = [];
          users.forEach(user => {
            keyboard.push([{ 
              text: `${user.username || 'No Username'} (${user.tgId})`, 
              callback_data: `pm_user_${user.tgId}` 
            }]);
          });
          
          // Add back button
          keyboard.push([{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]);
          
          await ctx.editMessageText(
            `📧 <b>Message a User</b>\n\nSelect a user to message:`,
            {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: keyboard
              })
            }
          );
        }
        // Add funds to user
        else if (action === 'admin_funds') {
          ctx.session.adminState = 'funds';
          
          // Fetch users for selection buttons
          const users = await models.User.find({}).limit(20);
          
          if (!users || users.length === 0) {
            await ctx.editMessageText('No users found in the database.', {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            });
            return;
          }
          
          // Create user selection keyboard
          const keyboard = [];
          users.forEach(user => {
            keyboard.push([{ 
              text: `${user.username || 'No Username'} (${user.tgId}) - $${user.balance.toFixed(2)} | Total: $${(user.totalDeposits || 0).toFixed(2)}`, 
              callback_data: `add_funds_${user.tgId}` 
            }]);
          });
          
          // Add back button
          keyboard.push([{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]);
          
          await ctx.editMessageText(
            `💰 <b>Add Funds to User</b>\n\nSelect a user to add funds:`,
            {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: keyboard
              })
            }
          );
        }
        // List users
        else if (action === 'admin_users') {
          ctx.session.adminState = 'users';
          
          try {
            const users = await models.User.find({}).limit(10);
            
            if (!users || users.length === 0) {
              await ctx.editMessageText('No users found in the database.', {
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                  ]
                })
              });
              return;
            }
            
            let message = '👥 <b>User List</b> (Recent 10)\n\n';
            
            users.forEach((user, index) => {
              message += `${index + 1}. <b>ID:</b> ${user.tgId}\n   <b>Username:</b> @${user.username || 'N/A'}\n   <b>Balance:</b> $${user.balance.toFixed(2)}\n   <b>Total Deposits:</b> $${(user.totalDeposits || 0).toFixed(2)}\n\n`;
            });
            
            await ctx.editMessageText(message, {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Show All Users', callback_data: 'admin_all_users' }],
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            });
          } catch (error) {
            console.error('[ERROR] Error listing users:', error);
            await ctx.editMessageText('❌ An error occurred while fetching user list.', {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            });
          }
        }
        // Update log prices
        else if (action === 'admin_update_price') {
          ctx.session.adminState = 'update_price';
          ctx.session.awaitingPriceUpdate = true;
          
          await ctx.editMessageText(
            `💰 <b>Update Prices</b>\n\nType your price update in one of these formats:\n\n` +
            `• Single number to update all prices (e.g. <code>40</code>)\n` +
            `• Category and price to update specific category (e.g. <code>amazon 45</code>)\n\n` +
            `Valid categories: amazon, ebay, paypal, crypto`,
            {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            }
          );
        }
        // Show full user list
        else if (action === 'admin_all_users') {
          const users = await models.User.find({}).limit(50);
          
          if (!users || users.length === 0) {
            await ctx.editMessageText('No users found in the database.', {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            });
            return;
          }
          
          let message = '👥 <b>Full User List</b>\n\n';
          
          users.forEach((user, index) => {
            message += `${index + 1}. <b>ID:</b> ${user.tgId}\n   <b>Username:</b> @${user.username || 'N/A'}\n   <b>Balance:</b> $${user.balance.toFixed(2)}\n   <b>Total Deposits:</b> $${(user.totalDeposits || 0).toFixed(2)}\n\n`;
          });
          
          if (users.length === 50) {
            message += '<i>Showing only first 50 users. For all users, please use /listusers command.</i>';
          }
          
          await ctx.editMessageText(message, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
              ]
            })
          });
        }
        // Handle user selection for PM from support message or admin panel
        else if (action.startsWith('pm_user_')) {
          const userId = action.replace('pm_user_', '');
          ctx.session.selectedUserId = userId;
          ctx.session.awaitingPM = true;
          
          try {
            const user = await models.User.findOne({ tgId: userId });
            let username = user?.username || 'No Username';
            
            // Use reply instead of editMessageText to ensure it works from both contexts
            await ctx.reply(
              `📧 <b>Reply to User: ${username}</b>\n\nPlease type the message you want to send to this user:`,
              {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Cancel', callback_data: 'admin_back' }]
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
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                  ]
                })
              }
            );
          }
        }
        // Handle user selection for adding funds
        else if (action.startsWith('add_funds_')) {
          const userId = action.replace('add_funds_', '');
          ctx.session.selectedUserId = userId;
          ctx.session.awaitingFundsAmount = true;
          
          const user = await models.User.findOne({ tgId: userId });
          let username = user?.username || 'No Username';
          
          await ctx.editMessageText(
            `💰 <b>Add Funds to User: ${username}</b>\n\n` +
            `Current balance: $${user?.balance.toFixed(2) || '0.00'}\n` +
            `Total deposits: $${(user?.totalDeposits || 0).toFixed(2)}\n\n` +
            `Please enter the amount to add:`,
            {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to User List', callback_data: 'admin_funds' }],
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            }
          );
        }
        
        return;
      }
      
      // Process text messages
      if (ctx.update.message && ctx.update.message.text) {
        // Broadcast message processing
        if (ctx.session.awaitingBroadcast) {
          const broadcastMessage = ctx.update.message.text;
          
          // Clear awaiting state
          ctx.session.awaitingBroadcast = false;
          
          // Find all users
          const users = await models.User.find({});
          let sentCount = 0;
          let failCount = 0;
          
          // Inform admin that broadcast is starting
          const statusMsg = await ctx.reply(`🔄 Broadcasting message to ${users.length} users...`);
          
          // Send message to each user
          for (const user of users) {
            try {
              await global.bot.telegram.sendMessage(
                user.tgId, 
                `📢 <b>Announcement from Admin:</b>\n\n${broadcastMessage}`, 
                { parse_mode: 'html' }
              );
              sentCount++;
              
              // Update status message every 10 users
              if (sentCount % 10 === 0) {
                try {
                  await global.bot.telegram.editMessageText(
                    ctx.chat.id,
                    statusMsg.message_id,
                    null,
                    `🔄 Broadcasting... ${sentCount}/${users.length} messages sent.`
                  );
                } catch (error) {
                  console.error('[ERROR] Failed to update broadcast status:', error);
                }
              }
              
              // Avoid flooding Telegram's API
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.error(`[ERROR] Failed to send broadcast to user ${user.tgId}: ${error.message}`);
              failCount++;
            }
          }
          
          // Inform admin about completion
          try {
            await global.bot.telegram.editMessageText(
              ctx.chat.id,
              statusMsg.message_id,
              null,
              `✅ Broadcast completed!\n✓ Sent: ${sentCount}\n✗ Failed: ${failCount}`
            );
          } catch (error) {
            await ctx.reply(`✅ Broadcast completed!\n✓ Sent: ${sentCount}\n✗ Failed: ${failCount}`);
          }
          
          // Return to admin panel
          await ctx.reply(
            `Return to Admin Panel?`,
            {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                ]
              })
            }
          );
          
          return;
        }
        
        // PM to user processing
        if (ctx.session.awaitingPM && ctx.session.selectedUserId) {
          const pmMessage = ctx.update.message.text;
          const userId = ctx.session.selectedUserId;
          
          // Clear awaiting states
          ctx.session.awaitingPM = false;
          ctx.session.selectedUserId = null;
          
          try {
            // Find user
            const user = await models.User.findOne({ tgId: userId });
            if (!user) {
              await ctx.reply(`❌ User with ID ${userId} not found.`);
              return;
            }
            
            // Send message to user
            await global.bot.telegram.sendMessage(
              userId,
              `📨 <b>Message from Admin:</b>\n\n${pmMessage}`,
              { parse_mode: 'html' }
            );
            
            await ctx.reply(
              `✅ Message sent to user ${userId} (@${user.username || 'N/A'}).`,
              {
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
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
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                  ]
                })
              }
            );
          }
          
          return;
        }
        
        // Add funds processing
        if (ctx.session.awaitingFundsAmount && ctx.session.selectedUserId) {
          const amountText = ctx.update.message.text;
          const userId = ctx.session.selectedUserId;
          
          // Clear awaiting states
          ctx.session.awaitingFundsAmount = false;
          ctx.session.selectedUserId = null;
          
          // Parse amount
          const amount = parseFloat(amountText);
          
          if (isNaN(amount) || amount <= 0) {
            await ctx.reply(
              `❌ Invalid amount. Please enter a positive number.`,
              {
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                  ]
                })
              }
            );
            return;
          }
          
          try {
            // Add funds to user
            const result = await addFundsToUser(userId, amount);
            
            if (result.success) {
              await ctx.reply(
                `✅ Successfully added $${amount.toFixed(2)} to user ${userId}.\n` +
                `New balance: $${result.newBalance.toFixed(2)}\n` +
                `Total deposits: $${result.totalDeposits.toFixed(2)}`,
                {
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                    ]
                  })
                }
              );
            } else {
              await ctx.reply(
                `❌ Failed to add funds: ${result.message}`,
                {
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                    ]
                  })
                }
              );
            }
          } catch (error) {
            console.error('[ERROR] Error adding funds:', error);
            await ctx.reply(
              `❌ An unexpected error occurred while adding funds.`,
              {
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                  ]
                })
              }
            );
          }
          
          return;
        }
        
        // Price update processing
        if (ctx.session.awaitingPriceUpdate) {
          const priceText = ctx.update.message.text;
          
          // Clear awaiting state
          ctx.session.awaitingPriceUpdate = false;
          
          const parts = priceText.trim().split(' ');
          
          try {
            // Update specific category price
            if (parts.length === 2 && ['amazon', 'ebay', 'paypal', 'crypto'].includes(parts[0].toLowerCase()) && !isNaN(parseInt(parts[1]))) {
              const category = parts[0].toLowerCase();
              const newPrice = parseInt(parts[1]);
              
              // Update logs for the specific category
              const result = await models.Log.updateMany(
                { values: { $all: [`${category}.com`] } },
                { $set: { price: newPrice } }
              );
              
              // Update the category price
              LOG_PRICES[category] = newPrice;
              
              await ctx.reply(
                `✅ Updated prices for ${category} logs to $${newPrice}.\nAffected logs: ${result.nModified || 0}`,
                {
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                    ]
                  })
                }
              );
            }
            // General price update for all logs
            else if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
              const newPrice = parseInt(parts[0]);
              
              const result = await models.Log.updateMany({}, { $set: { price: newPrice } });
              
              // Update global price
              global.LOG_PRICE = newPrice;
              
              // Update all category prices
              for (const category in LOG_PRICES) {
                LOG_PRICES[category] = newPrice;
              }
              
              await ctx.reply(
                `✅ Updated prices for ALL logs to $${newPrice}.\nAffected logs: ${result.nModified || 0}`,
                {
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                    ]
                  })
                }
              );
            }
            // Invalid format
            else {
              await ctx.reply(
                `❌ Invalid price format. Please use either:\n• Single number to update all prices\n• "category price" format for specific category`,
                {
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                    ]
                  })
                }
              );
            }
          } catch (error) {
            console.error('[ERROR] Failed to update prices:', error);
            await ctx.reply(
              `❌ An error occurred while updating prices.`,
              {
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Admin Panel', callback_data: 'admin_back' }]
                  ]
                })
              }
            );
          }
          
          return;
        }
      }
      
      // If we reach here, it means an unhandled action/message
      return ctx.scene.leave();
    }
  );
}

module.exports = adminScene;