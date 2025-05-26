
I am sharing my source code today with you, can be customized to sell other things. Customize setupdb.js to add your files to MongoDB and run it after editing to put your data into the DB which the bot will use for sales.

# Log Marketplace Bot - Setup Tutorial

## 📋 Prerequisites

- **Node.js** (version 16 or higher)
- **MongoDB** installed and running
- **TG Bot Token** from @BotFather
- **Windows Server** (recommended for full functionality)

## 🚀 Quick Setup

### 1. Download & Install
```bash
# Clone or download the bot files
# Extract to your desired directory
cd tg-bot
npm install
```

### 2. Configure Bot Token
Edit `config/config.main.yml`:
```yaml
bot:
  token: "YOUR_BOT_TOKEN_HERE"  # Get from @BotFather
  username: "your_bot_username"
  admins:
    - "YOUR_TG_USER_ID"  # Your TG ID
```

### 3. Database Setup
- Install MongoDB locally or use cloud service
- Default connection: `mongodb://127.0.0.1:27017/shop`
- Database will be created automatically

### 4. Start the Bot
```bash
node app.js
```

## ⚙️ Features

### 🛒 **Log Marketplace**
- Browse log by category (Amazon, eBay, PayPal, Crypto)
- Purchase log with account balance
- Automatic log delivery via download links

### 💰 **Payment System**
- Deposit funds via **Ethereum (ETH)** or **Solana (SOL)**
- Automatic balance updates after payment confirmation
- Support for multiple crypto wallets

### 👥 **Referral Program**
- Earn $10 for each successful referral
- Automatic referral tracking and rewards
- Separate referral balance management

### 🔧 **Admin Features**
- Update log prices globally or by category
- Add funds to user accounts manually
- Broadcast messages to all users
- User management and statistics

## 📱 Bot Commands

### User Commands
- `/start` - Start the bot and access main menu
- No other commands needed - everything is menu-driven

### Admin Commands
- `/updateprice [price]` - Update all log prices
- `/updateprice [category] [price]` - Update specific category
- `/addfunds [user_id] [amount]` - Add funds to user
- `/broadcast [message]` - Send message to all users
- `/listusers` - Show registered users
- `/adminhelp` - Show admin commands

## 💡 Usage Guide

### For Users:
1. **Start** the bot with /start
2. **Deposit** funds using crypto payments
3. **Browse** available log by category
4. **Purchase** log using account balance
5. **Download** purchased log via provided links
6. **Refer** friends to earn rewards

### For Admins:
1. **Monitor** user activity and transactions
2. **Manage** log inventory and pricing
3. **Process** support requests via built-in contact system
4. **Broadcast** announcements to users
5. **Add** funds manually when needed

## 🔐 Security Features

- Encrypted crypto wallet generation
- Secure payment processing
- Admin authentication
- Database transaction logging
- Automatic cleanup of temporary files

## 📞 Support

- Users can contact support directly through the bot
- Messages are forwarded to all admins
- Admins can reply directly to users
- Built-in user management system

## 🚨 Important Notes

- Keep your bot token secure
- Regularly backup your MongoDB database
- Monitor crypto payments for accuracy
- Update log inventory regularly
- Set appropriate admin permissions

---

**Bot Status:** Ready for production use
**Supported Platforms:** Windows Server (recommended), Linux
**Database:** MongoDB required
**Payment Methods:** ETH, SOL cryptocurrencies
