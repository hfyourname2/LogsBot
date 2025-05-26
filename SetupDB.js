// Save this as t.js

// Import required modules
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/shop', { useNewUrlParser: true })
  .then(() => console.log('[INFO] Connected to MongoDB'))
  .catch(err => {
    console.error('[ERROR] Could not connect to MongoDB:', err);
    process.exit(1);
  });

// Define Log schema
const logSchema = new mongoose.Schema({
  values: Array,
  url: String,
  price: Number,
  country: String
});

// Create Log model
const Log = mongoose.model('logs', logSchema);

// Log data to insert
const logsToInsert = [
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["amazon.com", "localbitcoins.com"],
    "url": "Link",
    "price": 40,
    "country": "EU"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["w.qiwi.com", "paypal.com"],
    "url": "Link",
    "price": 40,
    "country": "US"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["crypto.com", "btcirect.eu"],
    "url": "Link",
    "price": 40,
    "country": "US"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["paypal.com"],
    "url": "Link",
    "price": 40,
    "country": "EU"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["amazon.com"],
    "url": "Link",
    "price": 40,
    "country": "US"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["blockchain.com"],
    "url": "Link",
    "price": 40,
    "country": "EU"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["amazon.com"],
    "url": "Link",
    "price": 40,
    "country": "EU"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["amazon.com"],
    "url": "Link",
    "price": 40,
    "country": "EU"
  },
  {
    "_id": new mongoose.Types.ObjectId(),
    "values": ["crypto.com"],
    "url": "Link",
    "price": 40,
    "country": "US"
  }
];

// Function to insert logs
async function insertCustomLogs() {
  console.log('[INFO] Inserting custom logs...');
  
  // Insert each log
  for (const logData of logsToInsert) {
    try {
      const newLog = new Log(logData);
      await newLog.save();
      console.log(`[INFO] Added log: ${logData.values.join(';')} | ${logData.country}`);
    } catch (error) {
      console.error(`[ERROR] Failed to add log ${logData.values.join(';')}: ${error.message}`);
    }
  }
  
  // Update logs count and show total
  const logsCount = await Log.countDocuments({});
  console.log(`[INFO] Total logs in database: ${logsCount}`);
  
  // Close the connection when done
  mongoose.connection.close();
  console.log('[INFO] Database connection closed');
}

// Run the function
insertCustomLogs().catch(err => {
  console.error('[ERROR] Failed to insert custom logs:', err);
  mongoose.connection.close();
});