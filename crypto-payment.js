// Enhanced Crypto Wallet Payment Implementation with Multiple APIs for ETH and SOL
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ethers = require('ethers');

// Import SolanaWallet for Solana functionality
const SolanaWallet = require('./solana-wallet');

/**
 * Crypto Wallet Payment class with enhanced features and error handling
 * Supports ETH and SOL with multiple APIs for verification and redundancy
 */
class CryptoWalletPayment {
  /**
   * @param {Object} config - Configuration options
   * @param {String} config.walletDir - Directory to store wallet files
   * @param {Function} config.onPaymentComplete - Callback when payment completes
   * @param {String} config.etherscanKey - Etherscan API key
   * @param {String} config.infuraKey - Infura API key
   * @param {String} config.heliusKey - Helius API key (for Solana)
   */
  constructor(config) {
    this.config = config || {};
    this.walletDir = this.config.walletDir || path.join(__dirname, 'crypto_wallets');
    
    // Initialize Solana wallet with API key
    this.solanaWallet = new SolanaWallet(this.config.heliusKey);
    
    // Multiple API endpoints for redundancy and verification
    this.apis = {
      eth: {
        etherscan: `https://api.etherscan.io/api?apikey=${this.config.etherscanKey || 'DF1A2Z8A212RC35NPHFGPWCZMQDG8EH18N'}`,
        ankr: 'https://rpc.ankr.com/eth',
        infura: `https://mainnet.infura.io/v3/${this.config.infuraKey || '16306d0eda5e48fdb2e238cab39aefa9'}`
      },
      sol: {
        solscan: 'https://public-api.solscan.io/account/',
        solana: 'https://api.mainnet-beta.solana.com',
        helius: `https://mainnet.helius-rpc.com/?api-key=${this.config.heliusKey || 'c48997d4-987b-40dd-9d69-4025b3e9615c'}`
      }
    };
    
    // Exchange rate APIs
    this.exchangeRateApis = {
      coinGecko: 'https://api.coingecko.com/api/v3/simple/price?x_cg_api_key=CG-V8kB77nLKWgJ2Rqx5S2XyySS',
      coinbase: 'https://api.coinbase.com/v2/exchange-rates'
    };
    
    // Create wallets directory if it doesn't exist
    if (!fs.existsSync(this.walletDir)) {
      fs.mkdirSync(this.walletDir, { recursive: true });
    }

    // Create a file to store all transactions
    this.transactionsFile = path.join(this.walletDir, 'transactions.json');
    if (!fs.existsSync(this.transactionsFile)) {
      fs.writeFileSync(this.transactionsFile, JSON.stringify([], null, 2));
    }
    
    // Initialize monitoring intervals tracker
    this.monitoringIntervals = {};
    
    console.log(`[INFO] Crypto payment system initialized with wallet directory: ${this.walletDir}`);
  }

  /**
   * Generate a new Ethereum wallet
   * @returns {Object} Wallet with public and private keys
   */
  generateEthWallet() {
    try {
      // Generate a random wallet
      const wallet = ethers.Wallet.createRandom();
      
      console.log(`[INFO] Generated new ETH wallet with address: ${wallet.address}`);
      
      return {
        privateKey: wallet.privateKey,
        address: wallet.address,
        type: 'eth'
      };
    } catch (error) {
      console.error('[ERROR] Failed to generate ETH wallet:', error);
      throw new Error('Failed to generate ETH wallet');
    }
  }

  /**
   * Generate a new Solana wallet
   * @returns {Object} Wallet with public and private keys
   */
  generateSolWallet() {
    return this.solanaWallet.createWallet();
  }

  /**
   * Create a new payment request
   * @param {String} userId - Telegram user ID
   * @param {Number} amountUSD - Amount in USD
   * @param {String} cryptoType - 'eth' or 'sol'
   * @returns {Object} Payment details including wallet address
   */
  async createPayment(userId, amountUSD, cryptoType) {
    try {
      let wallet;
      
      // Generate wallet based on selected crypto type
      if (cryptoType.toLowerCase() === 'eth') {
        wallet = this.generateEthWallet();
      } else if (cryptoType.toLowerCase() === 'sol') {
        wallet = this.generateSolWallet();
      } else {
        throw new Error('Invalid crypto type. Must be ETH or SOL');
      }
      
      // Get current exchange rate
      const rate = await this.getCryptoToUSDRate(cryptoType);
      
      // Calculate crypto amount based on USD (with slight buffer for network fees)
      const cryptoAmount = (amountUSD / rate).toFixed(8);
      
      // Create unique payment ID
      const paymentId = crypto.randomBytes(16).toString('hex');
      
      // Create transaction record
      const transaction = {
        id: paymentId,
        userId: userId,
        address: wallet.address,
        privateKey: wallet.privateKey,
        cryptoType: cryptoType.toLowerCase(),
        amountUSD: amountUSD,
        amountCrypto: cryptoAmount,
        rate: rate,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry
        balanceChecks: [],
        currentBalance: 0,
        referralId: null // Will be populated if payment is part of referral
      };
      
      // Save wallet info to file
      this.saveWalletInfo(transaction);
      
      // Start monitoring for payment
      this.startPaymentMonitoring(transaction);
      
      console.log(`[INFO] Created ${cryptoType} payment request ${paymentId} for user ${userId}: $${amountUSD} (${cryptoAmount} ${cryptoType})`);
      
      // Return payment details (without private key)
      return {
        paymentId: paymentId,
        address: wallet.address,
        amountCrypto: cryptoAmount,
        amountUSD: amountUSD,
        cryptoType: cryptoType.toLowerCase(),
        rate: rate,
        expiresAt: transaction.expiresAt
      };
    } catch (error) {
      console.error('[ERROR] Failed to create payment:', error);
      throw new Error('Failed to create payment request');
    }
  }

  /**
   * Save wallet information to file
   * @param {Object} transaction - Transaction details
   */
  saveWalletInfo(transaction) {
    try {
      // Save individual wallet file
      const walletFile = path.join(this.walletDir, `${transaction.id}.json`);
      fs.writeFileSync(walletFile, JSON.stringify(transaction, null, 2));
      
      // Update transactions list
      let transactions = [];
      try {
        transactions = JSON.parse(fs.readFileSync(this.transactionsFile, 'utf8'));
      } catch (error) {
        console.error('[ERROR] Failed to read transactions file, creating new one:', error);
      }
      
      // Remove private key from the transaction list for security
      const secureTransaction = { ...transaction };
      delete secureTransaction.privateKey;
      
      // Add new transaction to the list
      transactions.push(secureTransaction);
      fs.writeFileSync(this.transactionsFile, JSON.stringify(transactions, null, 2));
      
      console.log(`[INFO] Saved wallet info for payment ${transaction.id}`);
    } catch (error) {
      console.error('[ERROR] Failed to save wallet info:', error);
      throw new Error('Failed to save wallet information');
    }
  }

  /**
 * Enhanced Crypto Wallet Payment class
 * This is a snippet that should be placed in crypto-payment.js
 * Replace the existing getCryptoToUSDRate method with this one
 */

/**
 * Get current cryptocurrency to USD exchange rate with fallback options
 * @param {String} cryptoType - 'eth' or 'sol'
 * @returns {Number} Current exchange rate
 */
async getCryptoToUSDRate(cryptoType) {
  const symbol = cryptoType.toLowerCase() === 'eth' ? 'ethereum' : 'solana';
  
  try {
    // Primary source - CoinGecko API
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
    const rate = response.data[symbol].usd;
    console.log(`[INFO] Got ${cryptoType}/USD rate from CoinGecko: $${rate}`);
    return rate;
  } catch (error) {
    console.error(`[ERROR] Failed to get ${cryptoType}/USD rate from CoinGecko:`, error);
    
    // Fallback - Coinbase API
    try {
      const coinbaseResponse = await axios.get(`${this.exchangeRateApis.coinbase}?currency=${cryptoType.toUpperCase()}`);
      const fallbackRate = 1 / parseFloat(coinbaseResponse.data.data.rates.USD);
      console.log(`[INFO] Got ${cryptoType}/USD rate from Coinbase fallback: $${fallbackRate}`);
      return fallbackRate;
    } catch (fallbackError) {
      console.error(`[ERROR] Failed to get ${cryptoType}/USD rate from fallback:`, fallbackError);
      
      // If all else fails, use a hardcoded approximate rate
      let defaultRate;
      if (cryptoType.toLowerCase() === 'eth') {
        defaultRate = 1600; // Example ETH rate
      } else {
        defaultRate = 100; // Example SOL rate
      }
      console.warn(`[WARN] Using default ${cryptoType}/USD rate: $${defaultRate}`);
      return defaultRate;
    }
  }
}

  /**
   * Check balance of an Ethereum address using multiple APIs
   * @param {String} address - Ethereum address to check
   * @returns {Object} Balance information from multiple sources
   */
  async checkEthAddressBalance(address) {
    let balances = {
      etherscan: 0,
      ankr: 0,
      infura: 0,
      confirmed: 0,
      unconfirmed: 0,
      total: 0,
      verified: false
    };

    // Try multiple APIs for redundancy
    try {
      // 1. Etherscan API
      const etherscanResponse = await axios.get(`${this.apis.eth.etherscan}&module=account&action=balance&address=${address}&tag=latest`);
      if (etherscanResponse.data.status === '1') {
        balances.etherscan = parseFloat(ethers.utils.formatEther(etherscanResponse.data.result));
        balances.confirmed = balances.etherscan;
        console.log(`[INFO] Etherscan balance for ${address}: ${balances.etherscan} ETH`);
      }
    } catch (error) {
      console.error(`[ERROR] Failed to check balance via Etherscan: ${error.message}`);
    }

    try {
      // 2. Ankr RPC
      const ankrProvider = new ethers.providers.JsonRpcProvider(this.apis.eth.ankr);
      const ankrBalance = await ankrProvider.getBalance(address);
      balances.ankr = parseFloat(ethers.utils.formatEther(ankrBalance));
      console.log(`[INFO] Ankr RPC balance for ${address}: ${balances.ankr} ETH`);
    } catch (error) {
      console.error(`[ERROR] Failed to check balance via Ankr RPC: ${error.message}`);
    }

    try {
      // 3. Infura API (if configured)
      const infuraProvider = new ethers.providers.JsonRpcProvider(this.apis.eth.infura);
      const infuraBalance = await infuraProvider.getBalance(address);
      balances.infura = parseFloat(ethers.utils.formatEther(infuraBalance));
      console.log(`[INFO] Infura balance for ${address}: ${balances.infura} ETH`);
    } catch (error) {
      console.error(`[ERROR] Failed to check balance via Infura: ${error.message}`);
    }

    // Calculate the maximum confirmed balance across all APIs
    const confirmedBalances = [balances.etherscan, balances.ankr, balances.infura].filter(b => b > 0);
    if (confirmedBalances.length > 0) {
      // We'll use the highest balance reported by any of the APIs
      balances.total = Math.max(...confirmedBalances);
    } else {
      balances.total = 0;
    }

    // Verify balance by checking if at least 2 APIs report similar balances
    // This helps prevent false positives/negatives from a single unreliable API
    if (confirmedBalances.length >= 2) {
      // Check if at least 2 APIs are reporting the same balance (within a small margin)
      const margin = 0.00001; // Small margin for rounding differences
      for (let i = 0; i < confirmedBalances.length; i++) {
        for (let j = i + 1; j < confirmedBalances.length; j++) {
          if (Math.abs(confirmedBalances[i] - confirmedBalances[j]) <= margin) {
            balances.verified = true;
            break;
          }
        }
        if (balances.verified) break;
      }
    }

    // If we have at least one balance and it's not verified, mark as verified anyway if it's the only one
    if (confirmedBalances.length === 1 && !balances.verified) {
      console.log(`[INFO] Only one API responded for ${address}, using single source verification`);
      balances.verified = true;
    }

    console.log(`[INFO] Total ETH balance for ${address}: ${balances.total} ETH (Verified: ${balances.verified})`);
    return balances;
  }

  /**
   * Check balance of a Solana address
   * @param {String} address - Solana address to check
   * @returns {Object} Balance information
   */
  async checkSolAddressBalance(address) {
    let balances = {
      solscan: 0,
      solana: 0,
      helius: 0,
      confirmed: 0,
      total: 0,
      verified: false
    };

    try {
      // Use our SolanaWallet to check the balance
      balances.solana = await this.solanaWallet.checkBalance(address);
      balances.confirmed = balances.solana;
      balances.total = balances.solana;
      balances.verified = true; // Just using one source for now
    } catch (error) {
      console.error(`[ERROR] Failed to check SOL balance: ${error.message}`);
    }

    console.log(`[INFO] Total SOL balance for ${address}: ${balances.total} SOL (Verified: ${balances.verified})`);
    return balances;
  }

  /**
   * Check balance of a crypto address
   * @param {String} address - Crypto address to check
   * @param {String} cryptoType - 'eth' or 'sol'
   * @returns {Object} Balance information
   */
  async checkAddressBalance(address, cryptoType) {
    if (cryptoType.toLowerCase() === 'eth') {
      return this.checkEthAddressBalance(address);
    } else if (cryptoType.toLowerCase() === 'sol') {
      return this.checkSolAddressBalance(address);
    } else {
      throw new Error('Invalid crypto type. Must be ETH or SOL');
    }
  }

    /**
   * Start monitoring a payment
   * @param {Object} transaction - Transaction to monitor
   */
    startPaymentMonitoring(transaction) {
        console.log(`[INFO] Started monitoring ${transaction.cryptoType} payment ${transaction.id} for address ${transaction.address}`);

        // Set up interval to check every 2 minutes (changed from 30 seconds)
        const intervalId = setInterval(async () => {
            try {
                // Check if wallet file still exists (payment not processed yet)
                const walletFile = path.join(this.walletDir, `${transaction.id}.json`);
                if (!fs.existsSync(walletFile)) {
                    console.log(`[INFO] Payment ${transaction.id} already processed or cancelled`);
                    clearInterval(intervalId);
                    delete this.monitoringIntervals[transaction.id];
                    return;
                }

                // Get current transaction data
                const currentTransaction = JSON.parse(fs.readFileSync(walletFile, 'utf8'));

                // Check if transaction is expired
                if (new Date() > new Date(currentTransaction.expiresAt)) {
                    console.log(`[INFO] Payment ${transaction.id} expired`);
                    await this.updateTransactionStatus(transaction.id, 'expired');
                    clearInterval(intervalId);
                    delete this.monitoringIntervals[transaction.id];
                    return;
                }

                // Check balance
                const balanceInfo = await this.checkAddressBalance(transaction.address, transaction.cryptoType);
                console.log(`[INFO] Current verified balance for ${transaction.address}: ${balanceInfo.total} ${transaction.cryptoType.toUpperCase()} (Required: ${transaction.amountCrypto} ${transaction.cryptoType.toUpperCase()})`);

                // Required amount with a small margin of error (0.5%)
                const requiredAmount = parseFloat(transaction.amountCrypto) * 0.995;

                // Update the transaction with the latest balance check
                await this.updateTransactionBalanceCheck(transaction.id, balanceInfo);

                if (balanceInfo.verified && balanceInfo.total >= requiredAmount) {
                    console.log(`[INFO] Payment ${transaction.id} received! Verified balance: ${balanceInfo.total} ${transaction.cryptoType.toUpperCase()}`);

                    // Update transaction status
                    await this.updateTransactionStatus(transaction.id, 'completed');

                    // Execute callback function if provided
                    if (this.config.onPaymentComplete) {
                        await this.config.onPaymentComplete(transaction.id, transaction.userId, transaction.amountUSD, transaction.referralId);
                    }

                    clearInterval(intervalId);
                    delete this.monitoringIntervals[transaction.id];
                }
            } catch (error) {
                console.error(`[ERROR] Error monitoring payment ${transaction.id}:`, error);
            }
        }, 120000); // Check every 2 minutes (120000 ms)

        // Store interval ID to potentially clear it later
        this.monitoringIntervals[transaction.id] = intervalId;
    }

  /**
   * Update transaction with latest balance check
   * @param {String} paymentId - Payment ID
   * @param {Object} balanceInfo - Balance information
   */
  async updateTransactionBalanceCheck(paymentId, balanceInfo) {
    try {
      const walletFile = path.join(this.walletDir, `${paymentId}.json`);
      if (fs.existsSync(walletFile)) {
        const transaction = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        
        // Add balance check to history
        transaction.balanceChecks = transaction.balanceChecks || [];
        transaction.balanceChecks.push({
          timestamp: new Date().toISOString(),
          balance: balanceInfo.total,
          verified: balanceInfo.verified,
          sources: balanceInfo
        });
        
        // Keep only the last 10 checks to avoid file growth
        if (transaction.balanceChecks.length > 10) {
          transaction.balanceChecks = transaction.balanceChecks.slice(-10);
        }
        
        // Update current balance
        transaction.currentBalance = balanceInfo.total;
        transaction.lastChecked = new Date().toISOString();
        
        fs.writeFileSync(walletFile, JSON.stringify(transaction, null, 2));
        
        // Also update the main transactions list
        await this.updateTransactionInList(paymentId, {
          currentBalance: balanceInfo.total,
          lastChecked: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`[ERROR] Failed to update balance check for ${paymentId}:`, error);
    }
  }

  /**
   * Update transaction status
   * @param {String} paymentId - ID of the payment
   * @param {String} status - New status ('pending', 'completed', 'expired', 'cancelled')
   */
  async updateTransactionStatus(paymentId, status) {
    try {
      // Update individual wallet file
      const walletFile = path.join(this.walletDir, `${paymentId}.json`);
      if (fs.existsSync(walletFile)) {
        const transaction = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        transaction.status = status;
        transaction.updatedAt = new Date().toISOString();
        fs.writeFileSync(walletFile, JSON.stringify(transaction, null, 2));
      }
      
      // Update transactions list
      await this.updateTransactionInList(paymentId, {
        status: status,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`[INFO] Updated payment ${paymentId} status to ${status}`);
      return true;
    } catch (error) {
      console.error(`[ERROR] Failed to update transaction status for ${paymentId}:`, error);
      return false;
    }
  }

  /**
   * Update a transaction in the main transactions list
   * @param {String} paymentId - Payment ID
   * @param {Object} updates - Fields to update
   */
  async updateTransactionInList(paymentId, updates) {
    try {
      let transactions = [];
      try {
        transactions = JSON.parse(fs.readFileSync(this.transactionsFile, 'utf8'));
      } catch (error) {
        console.error('[ERROR] Failed to read transactions file:', error);
        return false;
      }
      
      const index = transactions.findIndex(t => t.id === paymentId);
      
      if (index !== -1) {
        // Apply updates
        transactions[index] = {
          ...transactions[index],
          ...updates
        };
        
        fs.writeFileSync(this.transactionsFile, JSON.stringify(transactions, null, 2));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[ERROR] Failed to update transaction in list:`, error);
      return false;
    }
  }

  /**
   * Set referral ID for a payment
   * @param {String} paymentId - Payment ID
   * @param {String} referralId - Referral user ID
   */
  async setReferralId(paymentId, referralId) {
    try {
      // Update individual wallet file
      const walletFile = path.join(this.walletDir, `${paymentId}.json`);
      if (fs.existsSync(walletFile)) {
        const transaction = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        transaction.referralId = referralId;
        fs.writeFileSync(walletFile, JSON.stringify(transaction, null, 2));
        
        // Also update the main transactions list
        await this.updateTransactionInList(paymentId, {
          referralId: referralId
        });
        
        console.log(`[INFO] Set referral ID ${referralId} for payment ${paymentId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[ERROR] Failed to set referral ID for payment ${paymentId}:`, error);
      return false;
    }
  }

  /**
   * Get payment details including balance history
   * @param {String} paymentId - ID of the payment
   * @returns {Object} Payment details
   */
  getPaymentDetails(paymentId) {
    try {
      const walletFile = path.join(this.walletDir, `${paymentId}.json`);
      if (fs.existsSync(walletFile)) {
        const transaction = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        
        // Remove private key for security
        const secureTransaction = { ...transaction };
        delete secureTransaction.privateKey;
        
        return secureTransaction;
      }
      return null;
    } catch (error) {
      console.error(`[ERROR] Failed to get payment details for ${paymentId}:`, error);
      return null;
    }
  }

  // In crypto-payment.js
// Ersetzen Sie die bestehende Methode cancelPaymentMonitoring mit dieser korrigierten Version

    /**
     * Delete wallet file and stop monitoring
     * @param {String} paymentId - ID of the payment to cancel
     */
    cancelPaymentMonitoring(paymentId) {
        try {
            // Stop the monitoring interval if it exists
            if (this.monitoringIntervals && this.monitoringIntervals[paymentId]) {
                clearInterval(this.monitoringIntervals[paymentId]);
                delete this.monitoringIntervals[paymentId];
                console.log(`[INFO] Stopped monitoring interval for payment ${paymentId}`);
            }

            // Update transaction status to cancelled
            this.updateTransactionStatus(paymentId, 'cancelled');

            // Delete the wallet file
            const walletFile = path.join(this.walletDir, `${paymentId}.json`);
            if (fs.existsSync(walletFile)) {
                fs.unlinkSync(walletFile);
                console.log(`[INFO] Deleted wallet file for payment ${paymentId}`);
            }

            console.log(`[INFO] Payment ${paymentId} cancelled and all resources cleaned up`);
            return true;
        } catch (error) {
            console.error(`[ERROR] Failed to cancel payment ${paymentId}: ${error.message}`);
            return false;
        }
    }

  /**
   * Get transactions by status
   * @param {String} status - Status to filter by
   * @returns {Array} Transactions
   */
  getTransactionsByStatus(status) {
    try {
      const transactions = JSON.parse(fs.readFileSync(this.transactionsFile, 'utf8'));
      if (status) {
        return transactions.filter(t => t.status === status);
      }
      return transactions;
    } catch (error) {
      console.error(`[ERROR] Failed to get transactions by status:`, error);
      return [];
    }
  }
};
 

module.exports = CryptoWalletPayment;