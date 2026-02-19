const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const messageHandler = require('./handlers/messageHandler');
const { initializeProducts } = require('./services/csvService');

const app = express();
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Initialize products from CSV on startup
initializeProducts().then(() => {
  console.log('Products initialized from CSV');
}).catch(err => {
  console.error('Failed to initialize products:', err);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Webhook verification (for Meta/WhatsApp Business API)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Webhook for receiving messages
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // Handle different webhook payloads (Twilio or Meta)
    if (body.object === 'whatsapp_business_account') {
      // Meta WhatsApp Business API format
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (value?.messages?.[0]) {
        const message = value.messages[0];
        const from = message.from;
        const msgBody = message.text?.body || '';
        
        await messageHandler.handleMessage(from, msgBody, 'meta');
      }
    } else if (body.Body && body.From) {
      // Twilio format
      await messageHandler.handleMessage(body.From, body.Body, 'twilio');
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('OK'); // Always return 200 to prevent retries
  }
});

// Manual CSV import endpoint
app.post('/admin/import-csv', async (req, res) => {
  try {
    const result = await initializeProducts();
    res.json({ success: true, message: `Imported ${result.count} products` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});