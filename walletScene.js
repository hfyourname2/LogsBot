// Required imports
const path = require('path');
const mongoose = require('mongoose');
const Markup = require('telegraf/markup');
const WizardScene = require("telegraf/scenes/wizard");

// Import the models
const models = require('./models');


/**
 * Wallet scene - For managing deposits
 * @param {Function} processCompletedPayment - Function to process completed payments
 * @param {Function} getProgressBar - Function to generate progress bar
 * @returns {Object} WizardScene instance
 */
function walletScene(processCompletedPayment, getProgressBar) {
  return new WizardScene(
    'wallet',
    // Step 1: Show wallet balance and deposit instructions
    async ctx => {
      console.log(`[INFO] <${ctx.session?.username || 'Unknown'}> opened Wallet Page`);

      // Get user's current data from database to ensure we have the latest values
      let balance = 0;
      let referralBalance = 0;
      let totalDeposits = 0;

      try {
        const user = await models.User.findOne({ tgId: ctx.session?.tgId });
        if (user) {
          balance = user.balance || 0;
          referralBalance = user.referralBalance || 0;
          totalDeposits = user.totalDeposits || 0;

          // Update session data
          ctx.session.balance = balance;
          ctx.session.referralBalance = referralBalance;
          ctx.session.totalDeposits = totalDeposits;
        }
      } catch (error) {
        console.error('[ERROR] Failed to get user data:', error);
        // Fall back to session data if available
        balance = ctx.session?.balance || 0;
        referralBalance = ctx.session?.referralBalance || 0;
        totalDeposits = ctx.session?.totalDeposits || 0;
      }

      try {
        ctx.editMessageText(
          `💰 <b>Your account balance:</b> <code>$${balance.toFixed(2)}</code>\n` +
          `🎁 <b>Your referral balance:</b> <code>$${referralBalance.toFixed(2)}</code>\n` +
          `📊 <b>Total deposits:</b> <code>$${totalDeposits.toFixed(2)}</code>\n\n` +
          `To top up your account, send the desired amount in USD (as a number in this chat).\n\n` +
          `<i>If you have a referral balance, you can use it to purchase logs or transfer it to your main balance.</i>`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: 'Transfer Referral Balance', callback_data: 'transfer_referral' }
                ],
                [
                  { text: 'Back', callback_data: 'back' }
                ]
              ]
            })
          }
        );
      } catch (error) {
        ctx.reply(
          `💰 <b>Your account balance:</b> <code>$${balance.toFixed(2)}</code>\n` +
          `🎁 <b>Your referral balance:</b> <code>$${referralBalance.toFixed(2)}</code>\n` +
          `📊 <b>Total deposits:</b> <code>$${totalDeposits.toFixed(2)}</code>\n\n` +
          `To top up your account, send the desired amount in USD (as a number in this chat).\n\n` +
          `<i>If you have a referral balance, you can use it to purchase logs or transfer it to your main balance.</i>`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: 'Transfer Referral Balance', callback_data: 'transfer_referral' }
                ],
                [
                  { text: 'Back', callback_data: 'back' }
                ]
              ]
            })
          }
        );
      }

      return ctx.wizard.next();
    },
    // Step 2: Handle amount input or transfer referral balance action
    async ctx => {
      // Handle transfer_referral action
      if (ctx.update.callback_query && ctx.update.callback_query.data === 'transfer_referral') {
        try {
          const user = await models.User.findOne({ tgId: ctx.session?.tgId });
          if (!user || !user.referralBalance || user.referralBalance <= 0) {
            await ctx.answerCbQuery('You don\'t have any referral balance to transfer.');
            return ctx.wizard.back();
          }

          await ctx.editMessageText(
            `🔄 <b>Transfer Referral Balance</b>\n\n` +
            `You have <code>$${user.referralBalance.toFixed(2)}</code> in your referral balance.\n\n` +
            `Enter the amount you want to transfer to your main balance, or type "all" to transfer everything:`, {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    { text: 'Cancel', callback_data: 'cancel_transfer' }
                  ]
                ]
              })
            }
          );

          // Set flag to indicate we're waiting for transfer amount
          ctx.wizard.state.waitingForTransferAmount = true;
          return ctx.wizard.next();
        } catch (error) {
          console.error(`[ERROR] Failed to process referral transfer request:`, error);
          await ctx.answerCbQuery('An error occurred. Please try again.');
          return ctx.wizard.back();
        }
      }

      // Handle regular amount input for deposit
      if (!ctx.update.message || !ctx.update.message.text) {
        ctx.reply(`⚠ Invalid format. Please try again.`);
        return ctx.wizard.back();
      }

      const amount = parseFloat(ctx.update.message.text);

      if (isNaN(amount) || amount <= 0) {
        ctx.reply(`⚠ Invalid amount. Please enter a positive number.`);
        return ctx.wizard.back();
      }

      // Save amount to state and ask user to choose payment method
      ctx.wizard.state.amount = amount;

      await ctx.reply(
        `You are about to deposit <code>$${amount.toFixed(2)}</code>.\n\n` +
        `Please select your preferred cryptocurrency for payment:`, {
          parse_mode: 'html',
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: 'Ethereum (ETH)', callback_data: 'pay_eth' },
                { text: 'Solana (SOL)', callback_data: 'pay_sol' }
              ],
              [
                { text: 'Cancel', callback_data: 'cancel_payment' }
              ]
            ]
          })
        }
      );

      return ctx.wizard.next();
    },
    // Step 3: Handle transfer amount input or crypto selection
    async ctx => {
      // Handle referral balance transfer amount
      if (ctx.wizard.state.waitingForTransferAmount && ctx.update.message) {
        const transferAmount = ctx.update.message.text.toLowerCase() === 'all' ? 'all' : parseFloat(ctx.update.message.text);

        if (transferAmount !== 'all' && (isNaN(transferAmount) || transferAmount <= 0)) {
          await ctx.reply(`⚠ Invalid amount. Please enter a positive number or "all".`);
          return;
        }

        try {
          const { transferReferralFunds } = require('./utils');

          // Process transfer
          const result = await transferReferralFunds(ctx.session.tgId, transferAmount);

          if (result.success) {
            await ctx.reply(
              `✅ <b>Transfer Successful</b>\n\n` +
              `Successfully transferred <code>$${typeof transferAmount === 'string' ? result.message.match(/\$(\d+\.\d+)/)[1] : transferAmount.toFixed(2)}</code> from your referral balance to your main balance.\n\n` +
              `💰 <b>Main balance:</b> <code>$${result.newBalance.toFixed(2)}</code>\n` +
              `🎁 <b>Referral balance:</b> <code>$${result.newReferralBalance.toFixed(2)}</code>`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [
                      { text: 'Back to Main Menu', callback_data: 'back' }
                    ]
                  ]
                })
              }
            );
          } else {
            await ctx.reply(
              `❌ <b>Transfer Failed</b>\n\n${result.message}`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [
                      { text: 'Back to Main Menu', callback_data: 'back' }
                    ]
                  ]
                })
              }
            );
          }

          return ctx.scene.leave();
        } catch (error) {
          console.error(`[ERROR] Failed to transfer referral funds:`, error);
          await ctx.reply(
            `❌ An error occurred while processing your transfer request. Please try again later.`, {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    { text: 'Back to Main Menu', callback_data: 'back' }
                  ]
                ]
              })
            }
          );
          return ctx.scene.leave();
        }
      }

      // Handle cancel_transfer action
      if (ctx.update.callback_query && ctx.update.callback_query.data === 'cancel_transfer') {
        await ctx.answerCbQuery('Transfer cancelled');
        return ctx.wizard.back();
      }

      // Handle crypto selection or cancellation
      if (!ctx.update.callback_query) {
        return;
      }

      // Handle payment cancellation
      if (ctx.update.callback_query.data === 'cancel_payment') {
        await ctx.answerCbQuery('Payment cancelled');
        await ctx.editMessageText(
          `Payment cancelled. You can start a new payment request from the main menu.`, {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: 'Back to Main Menu', callback_data: 'back' }
                ]
              ]
            })
          }
        );
        return ctx.scene.leave();
      }

      // Get crypto type from callback data
      const cryptoType = ctx.update.callback_query.data === 'pay_eth' ? 'eth' : 'sol';
      ctx.wizard.state.cryptoType = cryptoType;

      try {
        // Initialize the Crypto payment service
        const CryptoWalletPayment = require('./crypto-payment');
        const cryptoPayment = new CryptoWalletPayment({
          walletDir: path.join(__dirname, 'crypto_wallets'),
          onPaymentComplete: async (paymentId, userId, amountUSD, referralId) => {
            // Update user balance when payment is complete
            await processCompletedPayment(userId, amountUSD, paymentId, referralId);
          },
          etherscanKey: 'DF1A2Z8A212RC35NPHFGPWCZMQDG8EH18N',
          infuraKey: '16306d0eda5e48fdb2e238cab39aefa9',
          heliusKey: 'c48997d4-987b-40dd-9d69-4025b3e9615c'
        });

        // Create a new payment request
        const payment = await cryptoPayment.createPayment(ctx.session.tgId, ctx.wizard.state.amount, cryptoType);

        // Store payment ID in session for checking status later
        ctx.session.currentPaymentId = payment.paymentId;

        // Format expiry time
        const expiryTime = new Date(payment.expiresAt);
        const formattedExpiry = `${expiryTime.getHours()}:${String(expiryTime.getMinutes()).padStart(2, '0')}`;

        // Create transaction record in database
        const transaction = new models.Transaction({
          _id: new mongoose.Types.ObjectId(),
          userId: ctx.session.tgId,
          amount: payment.amountUSD,
          type: 'deposit',
          status: 'pending',
          cryptoAddress: payment.address,
          cryptoAmount: payment.amountCrypto,
          cryptoType: payment.cryptoType,
          cryptoRate: payment.rate,
          timestamp: new Date()
        });

        await transaction.save();

        // Send payment instructions to user
        await ctx.editMessageText(
          `A ${cryptoType.toUpperCase()} wallet has been generated for you:\n\n` +
          `<code>${payment.address}</code>\n\n` +
          `To top up your account with <code>${payment.amountUSD.toFixed(2)}</code>, transfer:\n` +
          `<code>${payment.amountCrypto} ${cryptoType.toUpperCase()}</code> to this wallet.\n\n` +
          `Current rate: <code>${payment.rate.toFixed(2)}</code> per ${cryptoType.toUpperCase()}\n\n` +
          `⚠ Payment expires at ${formattedExpiry}. Please make the transfer in a single transaction.\n\n` +
          `The system checks for your payment every 30 seconds using multiple APIs for verification.\nYour balance will be automatically updated once the payment is detected.`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Check Payment Status', callback_data: 'check_payment' }],
                [{ text: 'I\'ve paid, back to main menu', callback_data: 'payment_sent' }],
                [{ text: 'Cancel', callback_data: 'cancel_payment' }]
              ]
            })
          }
        );

        return ctx.wizard.next();
      } catch (error) {
        console.error(`[ERROR] Failed to create payment:`, error);
        await ctx.editMessageText(
          `⚠ There was an error creating your payment. Please try again later.`, {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  { text: 'Back to Main Menu', callback_data: 'back' }
                ]
              ]
            })
          }
        );
        return ctx.scene.leave();
      }
    },
    // Step 4: Handle payment status checking and cancellation
    async ctx => {
      // Only handle callback queries
      if (!ctx.update.callback_query) {
        return;
      }
      
      const CryptoWalletPayment = require('./crypto-payment');
      const cryptoPayment = new CryptoWalletPayment({
        walletDir: path.join(__dirname, 'crypto_wallets'),
        etherscanKey: 'DF1A2Z8A212RC35NPHFGPWCZMQDG8EH18N',
        infuraKey: '16306d0eda5e48fdb2e238cab39aefa9',
        heliusKey: 'c48997d4-987b-40dd-9d69-4025b3e9615c'
      });

      // Handle the "I've Paid" button - return to main menu but continue checking in background
      if (ctx.update.callback_query.data === 'payment_sent') {
        await ctx.answerCbQuery('We\'ll continue checking for your payment in the background.');
        
        // Get payment ID from session
        const paymentId = ctx.session.currentPaymentId;
        
        if (paymentId) {
          // Get payment details to show the user one last time
          const payment = cryptoPayment.getPaymentDetails(paymentId);
          
          if (payment) {
            await ctx.editMessageText(
              `Thank you! We'll continue checking for your payment to address:\n\n` +
              `<code>${payment.address}</code>\n\n` +
              `Amount: <code>${payment.amountCrypto} ${payment.cryptoType.toUpperCase()}</code>\n\n` +
              `Your balance will be updated automatically when the payment is detected. This may take a few minutes to confirm.`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Main Menu', callback_data: 'back' }]
                  ]
                })
              }
            );
          } else {
            await ctx.editMessageText(
              `Thank you! We'll continue checking for your payment in the background. Your balance will be updated automatically when the payment is detected.`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Back to Main Menu', callback_data: 'back' }]
                  ]
                })
              }
            );
          }
        }
        
        return ctx.scene.leave();
      }
      
      if (ctx.update.callback_query.data === 'check_payment') {
        const paymentId = ctx.session.currentPaymentId;
        if (!paymentId) {
          ctx.answerCbQuery('No active payment found.');
          return ctx.scene.leave();
        }
        
        const payment = cryptoPayment.getPaymentDetails(paymentId);
        
        if (!payment) {
          ctx.answerCbQuery('Payment not found.');
          return ctx.scene.leave();
        }
        
        // Handle completed payment
        if (payment.status === 'completed') {
          // Update the transaction record in the database
          await models.Transaction.findOneAndUpdate(
            { cryptoAddress: payment.address, status: 'pending' },
            { status: 'completed' }
          );
          
          // Get updated user data
          const user = await models.User.findOne({ tgId: ctx.session.tgId });
          const balance = user ? user.balance : ctx.session.balance || 0;
          const referralBalance = user ? user.referralBalance : ctx.session.referralBalance || 0;
          const totalDeposits = user ? user.totalDeposits : ctx.session.totalDeposits || 0;
          
          await ctx.editMessageText(
            `✅ Payment of ${payment.amountUSD} successfully received!\n\n` +
            `💰 Your balance: ${balance.toFixed(2)}\n` +
            `🎁 Your referral balance: ${referralBalance.toFixed(2)}\n` +
            `📊 Total deposits: ${totalDeposits.toFixed(2)}`, {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Main Menu', callback_data: 'back' }]
                ]
              })
            }
          );
          
          return ctx.scene.leave();
        } 
        // Handle expired payment
        else if (payment.status === 'expired') {
          // Update the transaction record in the database
          await models.Transaction.findOneAndUpdate(
            { cryptoAddress: payment.address, status: 'pending' },
            { status: 'expired' }
          );
          
          await ctx.editMessageText(
            `⚠ Payment of ${payment.amountUSD} has expired.\n\n` +
            `Please start a new payment request if you still wish to top up your balance.`, {
              parse_mode: 'html',
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [{ text: 'Back to Main Menu', callback_data: 'back' }]
                ]
              })
            }
          );
          
          return ctx.scene.leave();
        } 
        // Handle pending payment - show current status
        else {
          // First inform the user about the refresh
          await ctx.answerCbQuery('Refreshing balance...');
          
          // Check current balance of the address
          try {
            const balanceInfo = await cryptoPayment.checkAddressBalance(payment.address, payment.cryptoType);
            const formattedExpiry = new Date(payment.expiresAt).toLocaleTimeString();
            
            // Calculate percentage of required amount
            const requiredAmount = parseFloat(payment.amountCrypto);
            const percentComplete = Math.min(100, Math.floor((balanceInfo.total / requiredAmount) * 100));
            const progressBar = getProgressBar(percentComplete);
            
            // Create verification status message
            let verificationStatus = 'Payment verification: ';
            if (balanceInfo.verified) {
              verificationStatus += '✅ <b>Verified</b>';
            } else if (balanceInfo.total > 0) {
              verificationStatus += '⚠️ <b>Partially verified</b>';
            } else {
              verificationStatus += '❌ <b>Not detected</b>';
            }
            
            // Create balance source details
            let balanceDetails = '';
            if (payment.cryptoType === 'eth') {
              if (balanceInfo.etherscan > 0) balanceDetails += `• Etherscan: ${balanceInfo.etherscan} ETH\n`;
              if (balanceInfo.ankr > 0) balanceDetails += `• Ankr RPC: ${balanceInfo.ankr} ETH\n`;
              if (balanceInfo.infura > 0) balanceDetails += `• Infura: ${balanceInfo.infura} ETH\n`;
            } else {
              if (balanceInfo.solscan > 0) balanceDetails += `• Solscan: ${balanceInfo.solscan} SOL\n`;
              if (balanceInfo.solana > 0) balanceDetails += `• Solana RPC: ${balanceInfo.solana} SOL\n`;
              if (balanceInfo.helius > 0) balanceDetails += `• Helius: ${balanceInfo.helius} SOL\n`;
            }
            
            // If we have balance details, show them, otherwise just show the total
            if (!balanceDetails) {
              balanceDetails = 'No balance detected yet.';
            }
            
            // Update transaction in database with latest balance
            await models.Transaction.findOneAndUpdate(
              { cryptoAddress: payment.address, status: 'pending' },
              { $set: { currentBalance: balanceInfo.total } }
            );
            
            // Update payment details with latest balance check
            if (cryptoPayment.updateTransactionBalanceCheck) {
              await cryptoPayment.updateTransactionBalanceCheck(payment.paymentId, balanceInfo);
            }
            
            await ctx.editMessageText(
              `Payment status: <b>Pending</b>\n\n` +
              `${payment.cryptoType.toUpperCase()} address: <code>${payment.address}</code>\n` +
              `Required amount: <code>${payment.amountCrypto} ${payment.cryptoType.toUpperCase()}</code>\n` +
              `Exchange rate: <code>${payment.rate.toFixed(2)} per ${payment.cryptoType.toUpperCase()}</code>\n` +
              `Expires at: ${formattedExpiry}\n\n` +
              `Current balance: <code>${balanceInfo.total} ${payment.cryptoType.toUpperCase()}</code>\n` +
              `Payment progress: ${percentComplete}%\n` +
              `${progressBar}\n\n` +
              `${verificationStatus}\n\n` +
              `<b>Balance details:</b>\n${balanceDetails}\n` +
              `The bot is checking for your payment every 30 seconds using multiple APIs. Once received and verified, your balance will be updated automatically.`, {
                parse_mode: 'html',
                reply_markup: JSON.stringify({
                  inline_keyboard: [
                    [{ text: 'Check Again', callback_data: 'check_payment' }],
                    [{ text: 'I\'ve paid, back to main menu', callback_data: 'payment_sent' }],
                    [{ text: 'Cancel Payment', callback_data: 'cancel_payment' }]
                  ]
                })
              }
            );
          } catch (error) {
            console.error(`[ERROR] Failed to check balance: ${error.message}`);
            ctx.answerCbQuery('Failed to check balance. Please try again.');
          }
        }
      } else if (ctx.update.callback_query.data === 'cancel_payment') {
        await ctx.answerCbQuery('Cancelling payment...');
        
        const paymentId = ctx.session.currentPaymentId;
        
        if (paymentId) {
          try {
            // Get payment details
            const payment = cryptoPayment.getPaymentDetails(paymentId);
            
            if (payment) {
              // Stop monitoring and delete wallet file
              cryptoPayment.cancelPaymentMonitoring(paymentId);
              
              // Update transaction in database
              await models.Transaction.findOneAndUpdate(
                { cryptoAddress: payment.address, status: 'pending' },
                { status: 'cancelled' }
              );
              
              console.log(`[INFO] Payment cancelled and monitoring stopped for ${payment.address}`);
            }
            
            // Remove payment ID from session
            delete ctx.session.currentPaymentId;
            
          } catch (error) {
            console.error(`[ERROR] Failed to cancel payment: ${error.message}`);
          }
        }
        
        await ctx.editMessageText(
          `Payment request cancelled.\n\n` +
          `You can start a new payment request from the main menu.`, {
            parse_mode: 'html',
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Back to Main Menu', callback_data: 'back' }]
              ]
            })
          }
        );
        
        return ctx.scene.leave();
      } else if (ctx.update.callback_query.data === 'back') {
        return ctx.scene.leave();
      }
    }
  );
}

module.exports = walletScene;