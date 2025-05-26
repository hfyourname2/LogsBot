const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

/**
 * Solana wallet utilities for the Crypto Payment system
 */
class SolanaWallet {
  /**
   * @param {String} heliusKey - Helius API key
   * @param {String} rpcUrl - Optional custom RPC URL
   */
  constructor(heliusKey, rpcUrl) {
    // Use Helius API if key is provided, otherwise use the default RPC URL
    this.heliusKey = heliusKey || 'c48997d4-987b-40dd-9d69-4025b3e9615c';
    this.rpcUrl = rpcUrl || `https://mainnet.helius-rpc.com/?api-key=${this.heliusKey}`;
    this.connection = new Connection(this.rpcUrl);
    
    // Fallback connection to public Solana API
    this.fallbackConnection = new Connection('https://api.mainnet-beta.solana.com');
  }

  /**
   * Generate a new Solana wallet
   * @returns {Object} Wallet information
   */
  createWallet() {
    try {
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const privateKey = Buffer.from(keypair.secretKey).toString('base64');
      
      console.log(`[INFO] Generated new SOL wallet with address: ${publicKey}`);
      
      return {
        address: publicKey,
        privateKey: privateKey,
        type: 'sol'
      };
    } catch (error) {
      console.error('[ERROR] Failed to generate SOL wallet:', error);
      throw new Error('Failed to generate SOL wallet');
    }
  }

  /**
   * Check balance of a Solana wallet
   * @param {String} walletAddress - Solana wallet address
   * @returns {Promise<Number>} Balance in SOL
   */
  async checkBalance(walletAddress) {
    try {
      const pubKey = new PublicKey(walletAddress);
      let balance;
      
      // Try primary connection first
      try {
        balance = await this.connection.getBalance(pubKey);
        console.log(`[INFO] SOL balance via Helius for ${walletAddress}: ${balance / LAMPORTS_PER_SOL} SOL`);
      } catch (error) {
        console.error(`[ERROR] Failed to check SOL balance via Helius: ${error.message}`);
        
        // Try fallback connection
        balance = await this.fallbackConnection.getBalance(pubKey);
        console.log(`[INFO] SOL balance via fallback for ${walletAddress}: ${balance / LAMPORTS_PER_SOL} SOL`);
      }
      
      const solBalance = balance / LAMPORTS_PER_SOL;
      return solBalance;
    } catch (error) {
      console.error(`[ERROR] Failed to check SOL balance for ${walletAddress}: ${error.message}`);
      return 0;
    }
  }
}

module.exports = SolanaWallet;