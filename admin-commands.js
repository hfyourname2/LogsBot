// Admin command handlers
const mongoose = require('mongoose');

/**
 * Handle the updateprice command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Object} LOG_PRICES - Category prices object
 * @param {Number} LOG_PRICE - Default log price
 */
async function handleUpdatePrice(ctx, isAdmin, LOG_PRICES, LOG_PRICE) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  const parts = ctx.message.text.split(' ');
  
  // Get the Log model
  const { Log } = require('./models');
  
  // Update specific category price
  if (parts.length === 3 && ['amazon', 'ebay', 'paypal', 'crypto'].includes(parts[1].toLowerCase()) && !isNaN(parseInt(parts[2]))) {
    const category = parts[1].toLowerCase();
    const newPrice = parseInt(parts[2]);
    
    try {
      // Update logs for the specific category
      const result = await Log.updateMany(
        { values: { $all: [`${category}.com`] } },
        { $set: { price: newPrice } }
      );
      
      // Update the category price
      LOG_PRICES[category] = newPrice;
      
      ctx.reply(`✅ Admin command executed: Updated prices for ${category} logs to $${newPrice}.\nAffected logs: ${result.nModified}`);
      console.log(`[INFO] Admin <${ctx.message.from.username}> updated ${category} logs to $${newPrice}`);
      
    } catch (error) {
      console.error(`[ERROR] Error updating ${category} prices:`, error);
      ctx.reply(`❌ Error updating ${category} prices.`);
    }
    return;
  }
  
  // General price update for all logs
  if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
    const newPrice = parseInt(parts[1]);
    
    try {
      const result = await Log.updateMany({}, { $set: { price: newPrice } });
      ctx.reply(`✅ Admin command executed: Updated prices for ALL logs to $${newPrice}.`);
      console.log(`[INFO] Admin <${ctx.message.from.username}> updated prices for ${result.nModified} logs to $${newPrice}`);
      
      // Update all category prices
      global.LOG_PRICE = newPrice;
      for (const category in LOG_PRICES) {
        LOG_PRICES[category] = newPrice;
      }
      
    } catch (error) {
      console.error('[ERROR] Error updating prices:', error);
      ctx.reply('❌ Error updating prices.');
    }
    return;
  }
  
  // Invalid format - show usage information
  ctx.reply('Usage:\n/updateprice [price] - Update price for all logs\n/updateprice [category] [price] - Update price for specific category\n\nValid categories: amazon, ebay, paypal, crypto');
}

/**
 * Handle the addfunds command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Function} addFundsToUser - Function to add funds to user
 */
async function handleAddFunds(ctx, isAdmin, addFundsToUser) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  const parts = ctx.message.text.split(' ');
  if (parts.length < 3 || isNaN(parseFloat(parts[2]))) {
    return ctx.reply('Usage: /addfunds [user_id] [amount]');
  }
  
  const targetUserId = parts[1];
  const amount = parseFloat(parts[2]);
  
  if (amount <= 0) {
    return ctx.reply('❌ Amount must be greater than zero.');
  }
  
  try {
    const result = await addFundsToUser(targetUserId, amount);
    
    if (result.success) {
      ctx.reply(`✅ Admin command executed: Added $${amount.toFixed(2)} to user ${targetUserId}.\nNew balance: $${result.newBalance.toFixed(2)}`);
      console.log(`[INFO] Admin <${ctx.message.from.username}> added $${amount} to user ${targetUserId}`);
    } else {
      ctx.reply(`❌ Failed to add funds: ${result.message}`);
    }
  } catch (error) {
    console.error('[ERROR] Error adding funds:', error);
    ctx.reply('❌ An unexpected error occurred while adding funds.');
  }
}

/**
 * Handle the broadcast command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Object} bot - Telegraf bot instance
 */
async function handleBroadcast(ctx, isAdmin, bot) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  const parts = ctx.message.text.split(' ');
  if (parts.length < 2) {
    return ctx.reply('Usage: /broadcast [message]');
  }
  
  // Get the message (everything after the command)
  const message = ctx.message.text.substring('/broadcast '.length);
  
  try {
    // Get User model
    const { User } = require('./models');
    
    // Find all users
    const users = await User.find({});
    let sentCount = 0;
    let failCount = 0;
    
    // Inform admin that broadcast is starting
    const statusMsg = await ctx.reply(`🔄 Broadcasting message to ${users.length} users...`);
    
    // Send message to each user
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(
          user.tgId, 
          `📢 <b>Announcement from Admin:</b>\n\n${message}`, 
          { parse_mode: 'html' }
        );
        sentCount++;
        
        // Update status message every 10 users
        if (sentCount % 10 === 0) {
          await bot.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            null,
            `🔄 Broadcasting... ${sentCount}/${users.length} messages sent.`
          );
        }
        
        // Avoid flooding Telegram's API
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`[ERROR] Failed to send broadcast to user ${user.tgId}: ${error.message}`);
        failCount++;
      }
    }
    
    // Inform admin about completion
    await bot.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✅ Broadcast completed!\n✓ Sent: ${sentCount}\n✗ Failed: ${failCount}`
    );
    
    console.log(`[INFO] Admin <${ctx.message.from.username}> broadcast a message to ${sentCount} users`);
  } catch (error) {
    console.error('[ERROR] Failed to broadcast message:', error);
    ctx.reply('❌ An error occurred while broadcasting the message.');
  }
}

/**
 * Handle the PM command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} User - User model
 */
async function handlePM(ctx, isAdmin, bot, User) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  const parts = ctx.message.text.split(' ');
  if (parts.length < 3) {
    return ctx.reply('Usage: /pm [user_id] [message]');
  }
  
  const userId = parts[1];
  const message = ctx.message.text.substring(`/pm ${userId} `.length);
  
  try {
    // Check if user exists
    const user = await User.findOne({ tgId: userId });
    if (!user) {
      return ctx.reply(`❌ User with ID ${userId} not found.`);
    }
    
    // Send message to user
    await bot.telegram.sendMessage(
      userId,
      `📨 <b>Message from Admin:</b>\n\n${message}`,
      { parse_mode: 'html' }
    );
    
    ctx.reply(`✅ Message sent to user ${userId} (@${user.username || 'N/A'}).`);
    console.log(`[INFO] Admin <${ctx.message.from.username}> sent PM to user ${userId}`);
  } catch (error) {
    console.error(`[ERROR] Failed to send PM to user ${userId}:`, error);
    ctx.reply(`❌ Failed to send message to user ${userId}.`);
  }
}

/**
 * Handle the listusers command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Object} User - User model
 */
async function handleListUsers(ctx, isAdmin, User) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  try {
    const users = await User.find({}).limit(50); // Limit to prevent huge messages
    
    if (!users || users.length === 0) {
      return ctx.reply('No users found in the database.');
    }
    
    let message = '👥 <b>User List</b>\n\n';
    
    users.forEach((user, index) => {
      message += `${index + 1}. <b>ID:</b> ${user.tgId}\n   <b>Username:</b> @${user.username || 'N/A'}\n   <b>Balance:</b> $${user.balance.toFixed(2)}\n\n`;
    });
    
    if (users.length === 50) {
      message += '<i>Showing only first 50 users</i>';
    }
    
    ctx.reply(message, { parse_mode: 'html' });
    console.log(`[INFO] Admin <${ctx.message.from.username}> requested user list`);
    
  } catch (error) {
    console.error('[ERROR] Error listing users:', error);
    ctx.reply('❌ An error occurred while fetching user list.');
  }
}

/**
 * Handle the adminhelp command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 */
function handleAdminHelp(ctx, isAdmin) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  const helpText = `
🔐 <b>Admin Commands</b> 🔐

/updateprice [price] - Update the price of all logs
/updateprice [category] [price] - Update price for specific category
  Valid categories: amazon, ebay, paypal, crypto
/addfunds [user_id] [amount] - Add funds to a user's balance
/broadcast [message] - Send a message to all users
/pm [user_id] [message] - Send a message to a specific user
/listusers - Show a list of registered users
/showprices - Display current prices for all categories

All commands require admin privileges to execute.
`;
  
  ctx.reply(helpText, { parse_mode: 'html' });
}

/**
 * Handle the showprices command
 * @param {Object} ctx - Telegram context
 * @param {Function} isAdmin - Function to check if user is admin
 * @param {Object} LOG_PRICES - Category prices object
 * @param {Number} LOG_PRICE - Default log price
 */
function handleShowPrices(ctx, isAdmin, LOG_PRICES, LOG_PRICE) {
  // Check if user is admin
  if (!isAdmin(ctx.message.from.id.toString())) {
    return ctx.reply('❌ This command is restricted to administrators only.');
  }
  
  let priceInfo = '💲 <b>Current Log Prices</b>\n\n';
  
  for (const category in LOG_PRICES) {
    priceInfo += `<b>${category.charAt(0).toUpperCase() + category.slice(1)}:</b> ${LOG_PRICES[category]}\n`;
  }
  
  priceInfo += `\n<b>Default Price:</b> ${LOG_PRICE}`;
  
  ctx.reply(priceInfo, { parse_mode: 'html' });
}

module.exports = {
  handleUpdatePrice,
  handleAddFunds,
  handleBroadcast,
  handlePM,
  handleListUsers,
  handleAdminHelp,
  handleShowPrices
};