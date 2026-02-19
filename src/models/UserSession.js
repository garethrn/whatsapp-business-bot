const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: String,
  name: String,
  quantity: Number,
  price: Number
});

const userSessionSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  currentState: { 
    type: String, 
    enum: ['idle', 'browsing', 'selecting_quantity', 'reviewing_cart', 'confirming_order'],
    default: 'idle'
  },
  selectedProduct: {
    productId: String,
    name: String,
    price: Number
  },
  cart: [cartItemSchema],
  lastActivity: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserSession', userSessionSchema);