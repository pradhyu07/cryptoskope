const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const app = express();

// config
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: 'backend/config/config.env' });
}

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

const user = require('./routes/userRoute');
const product = require('./routes/productRoute');
const order = require('./routes/orderRoute');
const payment = require('./routes/paymentRoute');

app.use('/api/v1', user);
app.use('/api/v1', product);
app.use('/api/v1', order);
app.use('/api/v1', payment);

// === NEW: Wallet address API endpoint (assessment task) ===
app.post('/api/v1/save-wallet', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ success: false, message: 'Valid wallet address is required' });
    }

    const mongoose = require('mongoose');

    const walletSchema = new mongoose.Schema({
      walletAddress: { type: String, required: true, unique: true },
      connectedAt: { type: Date, default: Date.now }
    });

    const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

    await Wallet.findOneAndUpdate(
      { walletAddress },
      { walletAddress, connectedAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`✅ Wallet address stored: ${walletAddress}`);
    res.status(200).json({ success: true, message: 'Wallet address stored successfully' });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ success: false, message: 'Failed to store wallet address' });
  }
});

// deployment
__dirname = path.resolve();
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '/frontend/build')))

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'frontend', 'build', 'index.html'))
    });
} else {
    app.get('/', (req, res) => {
        res.send('Server is Running! 🚀');
    });
}

module.exports = app;