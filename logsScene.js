// Required imports
const path = require('path');
const mongoose = require('mongoose');
const Markup = require('telegraf/markup');
const WizardScene = require("telegraf/scenes/wizard");

// Import the models
const models = require('./models');


/**
 * Logs scene - For browsing and purchasing logs
 * @param {Object} LOG_PRICES - Category prices configuration
 * @param {Number} LOG_PRICE - Default log price
 * @returns {Object} WizardScene instance
 */
function logsScene(LOG_PRICES, LOG_PRICE) {
  return new WizardScene(
    'logs',
    // Step 1: Choose log category
    ctx => {
      console.log(`[INFO] <${ctx.session.username}> opened Logs Page`);

      const categoriesKeyboard = Markup.inlineKeyboard([
        [Markup.callbackButton('Amazon', 'amazon')],
        [Markup.callbackButton('eBay', 'ebay')],
        [Markup.callbackButton('PayPal', 'paypal')],
        [Markup.callbackButton('Crypto', 'crypto')],
        [Markup.callbackButton('Back', 'back')]
      ]).extra();

      try {
        ctx.editMessageText('Select the query you need for your search!', categoriesKeyboard);
      } catch (error) {
        console.log(`[INFO] Cannot edit message, sending new one: ${error.message}`);
        ctx.reply('Select the query you need for your search!', categoriesKeyboard);
      }

      return ctx.wizard.next();
    },
    // Step 2: Display available logs for selected category
    async ctx => {
      if (!ctx.update.callback_query) {
        return ctx.scene.leave();
      }
      
      ctx.wizard.state.query = ctx.update.callback_query.data;
      
      if (ctx.wizard.state.query === 'back') {
        return ctx.scene.enter('welcome');
      }

      try {
        // Find logs with the given query
        const logs = await models.Log.find({
          values: { $all: [`${ctx.wizard.state.query}.com`] }
        });

        console.log(`[INFO] Found ${logs?.length || 0} logs for query ${ctx.wizard.state.query}.com`);

        ctx.wizard.state.urlList = [];
        let results = '';
        let outputList = {};
        let countries = [];
        let count = [];

        // If no logs found
        if (!logs || logs.length === 0) {
          const noLogsKeyboard = {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back', callback_data: 'back' }]
              ]
            })
          };
          
          try {
            await ctx.editMessageText('No logs found for this query. Try another query or come back later.', noLogsKeyboard);
          } catch (error) {
            console.log(`[INFO] Cannot edit message: ${error.message}`);
            await ctx.reply('No logs found for this query. Try another query or come back later.', noLogsKeyboard);
          }
          
          return ctx.scene.enter('welcome');
        }

        // Process logs and organize by country
        logs.forEach(function (item) {
          let country = outputList[item.country] = outputList[item.country] || {};
          ctx.wizard.state.urlList.push(item.url);
        });

        for (var country in outputList) {
          countries.push({ country: country });
        }

        for (let i = 0; i < countries.length; i++) {
          countries[i] = countries[i].country;
          count[i] = logs.filter(value => value.country === countries[i]).length;
          results += `<b>${countries[i]}:</b> ${count[i]} · `;
        }

        // Show logs summary to user with category-specific price
        const logPrice = LOG_PRICES[ctx.wizard.state.query] || LOG_PRICE;
        const summaryMessage = `Found ${logs.length} logs for query <code>${ctx.wizard.state.query}.com</code>\n\n` +
                             `${results.substring(0, results.length - 3)}\n\n` +
                             `💎 <b>Price per log:</b> <code>$${logPrice}</code>\n` +
                             `💰 <b>Your balance:</b> <code>$${ctx.session.balance}</code>\n` +
                             `🎁 <b>Referral balance:</b> <code>$${ctx.session.referralBalance || 0}</code>\n\n` +
                             `Enter the number of logs and country to purchase.\n` +
                             `Example: <b>5 US</b>`;
                             
        const summaryKeyboard = {
          parse_mode: 'html',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: 'Back', callback_data: 'back' }]
            ]
          })
        };
        
        try {
          await ctx.editMessageText(summaryMessage, summaryKeyboard);
        } catch (error) {
          console.log(`[INFO] Cannot edit message: ${error.message}`);
          await ctx.reply(summaryMessage, summaryKeyboard);
        }

        ctx.wizard.state.countries = countries;
        ctx.wizard.state.countriesCount = count;
        
        return ctx.wizard.next();
      } catch (error) {
        console.error(`[ERROR] Failed to process logs: ${error.message}`);
        await ctx.reply('An error occurred while processing logs. Please try again later.');
        return ctx.scene.enter('welcome');
      }
    },
    // Step 3: Process log purchase request (quantity and country)
    async ctx => {
      if (!ctx.update.message || !ctx.update.message.text) {
        return ctx.wizard.back();
      }

      const parts = ctx.update.message.text.split(' ');
      if (parts.length < 2) {
        ctx.reply(`⚠ Invalid input format. Please try again.`);
        return ctx.wizard.back();
      }

      ctx.wizard.state.pcs = parseInt(parts[0]);
      ctx.wizard.state.country = parts[1];

      let correctCountry = false;
      let correctCount = false;

      for (let i = 0; i < ctx.wizard.state.countries.length; i++) {
        if (ctx.wizard.state.countries[i] === ctx.wizard.state.country) {
          correctCountry = true;

          if (ctx.wizard.state.pcs <= ctx.wizard.state.countriesCount[i]) {
            correctCount = true;

            // Find logs with matching country
            for (let j = 0; j < ctx.wizard.state.urlList.length; j++) {
              if (j < ctx.wizard.state.pcs) {
                ctx.wizard.state.urls = ctx.wizard.state.urls || '';
                ctx.wizard.state.urls += `${ctx.wizard.state.urlList[j]}\n`;
              }
            }

            break;
          }
        }
      }

      if (isNaN(ctx.wizard.state.pcs) || !ctx.wizard.state.country) {
        ctx.reply(`⚠ Invalid data format. Please try again.`);
        return ctx.wizard.back();
      } else if (!correctCountry) {
        ctx.reply(`⚠ The specified country is not in the list. Please try again.`);
        return ctx.wizard.back();
      } else if (!correctCount) {
        ctx.reply(`⚠ The specified number of logs is not available for this country. Please try again.`);
        return ctx.wizard.back();
      } else {
        // Get the category-specific price
        const logPrice = LOG_PRICES[ctx.wizard.state.query] || LOG_PRICE;
        ctx.wizard.state.price = ctx.wizard.state.pcs * logPrice;

        // Get latest user balance from database
        let currentBalance = ctx.session.balance || 0;
        let referralBalance = ctx.session.referralBalance || 0;
        
        try {
          const user = await models.User.findOne({ tgId: ctx.session.tgId });
          if (user) {
            currentBalance = user.balance;
            referralBalance = user.referralBalance || 0;
            // Update session
            ctx.session.balance = currentBalance;
            ctx.session.referralBalance = referralBalance;
          }
        } catch (error) {
          console.error(`[ERROR] Failed to get updated user balance: ${error.message}`);
        }

        // Calculate total available balance
        const totalAvailableBalance = currentBalance + referralBalance;

        if ((totalAvailableBalance - ctx.wizard.state.price) >= 0) {
          // User has enough combined balance to make the purchase
          const useReferralBalance = referralBalance > 0;
          let referralAmountToUse = 0;
          
          if (useReferralBalance) {
            // Calculate how much to take from referral balance
            referralAmountToUse = Math.min(referralBalance, ctx.wizard.state.price);
            const remainingCost = ctx.wizard.state.price - referralAmountToUse;
            
            ctx.reply(
              `Order created.\n\nQuery: ${ctx.wizard.state.query}\nCountry: ${ctx.wizard.state.country}\nQuantity: ${ctx.wizard.state.pcs} pcs.\nTotal cost: $${ctx.wizard.state.price}\n\n` +
              `Using $${referralAmountToUse.toFixed(2)} from referral balance and $${remainingCost.toFixed(2)} from main balance.\n\n` +
              `Confirm purchase?`, {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Cancel', callback_data: 'cancel' }],
                  [{ text: 'OK', callback_data: 'ok' }]
                ]
              })
            });
          } else {
            // Regular confirmation message (no referral balance used)
            ctx.reply(
              `Order created.\n\nQuery: ${ctx.wizard.state.query}\nCountry: ${ctx.wizard.state.country}\nQuantity: ${ctx.wizard.state.pcs} pcs.\nTotal cost: $${ctx.wizard.state.price}\n\nConfirm purchase?`, {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Cancel', callback_data: 'cancel' }],
                  [{ text: 'OK', callback_data: 'ok' }]
                ]
              })
            });
          }
          
          // Store referral info in state for use in next step
          ctx.wizard.state.useReferralBalance = useReferralBalance;
          ctx.wizard.state.referralAmountToUse = referralAmountToUse;
        } else {
          // Not enough combined balance
          const shortfall = (ctx.wizard.state.price - totalAvailableBalance).toFixed(2);
          ctx.reply(
            `Insufficient funds. You need $${shortfall} more to complete this purchase. Please top up your balance and try again!`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Deposit Funds', callback_data: 'wallet_deposit' }],
                [{ text: 'Back', callback_data: 'back' }]
              ]
            })
          });
          return ctx.wizard.back();
        }
      }
      return ctx.wizard.next();
    },
    // Step 4: Confirm and process purchase
    async ctx => {
      if (!ctx.update.callback_query) {
        return ctx.scene.leave();
      }

      if (ctx.update.callback_query.data === 'ok') {
        // Get latest user balance from database before processing payment
        try {
          const user = await models.User.findOne({ tgId: ctx.session.tgId });
          if (user) {
            // Update session with latest balance
            ctx.session.balance = user.balance;
            ctx.session.referralBalance = user.referralBalance || 0;
            
            // Get referral info from state
            const useReferralBalance = ctx.wizard.state.useReferralBalance || false;
            const referralAmountToUse = ctx.wizard.state.referralAmountToUse || 0;
            
            // Calculate total available balance
            const totalAvailableBalance = user.balance + (user.referralBalance || 0);
            
            // Double-check that user has enough funds
            if (totalAvailableBalance < ctx.wizard.state.price) {
              const shortfall = (ctx.wizard.state.price - totalAvailableBalance).toFixed(2);
              await ctx.editMessageText(
                `⚠ Insufficient funds. You need $${shortfall} more to complete this purchase.`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Deposit Funds', callback_data: 'wallet_deposit' }],
                    [{ text: 'Back to Main Menu', callback_data: 'back' }]
                  ]
                })
              });
              return ctx.scene.leave();
            }
            
            // If using referral balance
            if (useReferralBalance && referralAmountToUse > 0) {
              // Deduct from referral balance first
              user.referralBalance -= referralAmountToUse;
              // Deduct remainder from main balance
              user.balance -= (ctx.wizard.state.price - referralAmountToUse);
            } else {
              // Deduct full amount from main balance
              user.balance -= ctx.wizard.state.price;
            }
            
            await user.save();
            
            // Update session balance
            ctx.session.balance = user.balance;
            ctx.session.referralBalance = user.referralBalance;
            
            console.log(`[INFO] <${ctx.session.username}> completed payment: ${ctx.wizard.state.pcs} ${ctx.wizard.state.country}`);
            
            // Create transaction record for this purchase
            const transaction = new models.Transaction({
              _id: new mongoose.Types.ObjectId(),
              userId: ctx.session.tgId,
              amount: ctx.wizard.state.price,
              type: 'purchase',
              status: 'completed',
              timestamp: new Date()
            });
            
            await transaction.save();
            
            // Finalize the URLs list
            ctx.wizard.state.urls = ctx.wizard.state.urls.substring(0, ctx.wizard.state.urls.length - 1);
            const urlList = ctx.wizard.state.urls.split(/\n/);
            
            // Process each purchased log
            for (let i = 0; i < urlList.length; i++) {
              await models.Log.findOneAndRemove({ 'url': urlList[i] });
              
              // Create order record with referral info
              const order = new models.Order({
                _id: new mongoose.Types.ObjectId(),
                buyerId: ctx.session.tgId,
                buyerUsername: ctx.session.username,
                query: ctx.wizard.state.query,
                url: urlList.toString(),
                price: ctx.wizard.state.price,
                country: ctx.wizard.state.country,
                usedReferralBalance: useReferralBalance,
                referralAmount: referralAmountToUse
              });
              
              await order.save();
            }
            
            // Send confirmation message
            try {
              // Customize message based on if referral balance was used
              const referralMessage = useReferralBalance && referralAmountToUse > 0 
                ? `\n\nUsed $${referralAmountToUse.toFixed(2)} from referral balance.`
                : '';
                
              await ctx.editMessageText(
                `Your order has been paid!\n\nQuery: ${ctx.wizard.state.query}\nCountry: ${ctx.wizard.state.country}\nQuantity: ${ctx.wizard.state.pcs} pcs.${referralMessage}\n\nDownload: ${ctx.wizard.state.urls}`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Main Menu', callback_data: 'back' }]
                  ]
                })
              });
            } catch (error) {
              console.error(`[ERROR] Cannot edit message: ${error.message}`);
              await ctx.reply(
                `Your order has been paid!\n\nQuery: ${ctx.wizard.state.query}\nCountry: ${ctx.wizard.state.country}\nQuantity: ${ctx.wizard.state.pcs} pcs.${referralMessage}\n\nDownload: ${ctx.wizard.state.urls}`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Main Menu', callback_data: 'back' }]
                  ]
                })
              });
            }
          } else {
            console.error(`[ERROR] User not found: ${ctx.session.tgId}`);
            await ctx.editMessageText('An error occurred while processing your order. Please contact support.', {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Main Menu', callback_data: 'back' }]
                ]
              })
            });
          }
        } catch (error) {
          console.error(`[ERROR] Failed to process purchase: ${error.message}`);
          await ctx.editMessageText('An error occurred while processing your order. Please contact support.', {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Main Menu', callback_data: 'back' }]
              ]
            })
          });
        }
      } else if (ctx.update.callback_query.data === 'cancel') {
        // Send cancellation message
        try {
          await ctx.editMessageText(
            `Order cancelled\n\nQuery: ${ctx.wizard.state.query}\nCountry: ${ctx.wizard.state.country}\nQuantity: ${ctx.wizard.state.pcs} pcs.\n\n⚠ Purchase cancelled!`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Main Menu', callback_data: 'back' }]
              ]
            })
          });
        } catch (error) {
          console.error(`[ERROR] Cannot edit message: ${error.message}`);
          await ctx.reply(
            `Order cancelled\n\nQuery: ${ctx.wizard.state.query}\nCountry: ${ctx.wizard.state.country}\nQuantity: ${ctx.wizard.state.pcs} pcs.\n\n⚠ Purchase cancelled!`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Main Menu', callback_data: 'back' }]
              ]
            })
          });
        }
      }

      return ctx.scene.leave();
    }
  );
}

module.exports = logsScene;