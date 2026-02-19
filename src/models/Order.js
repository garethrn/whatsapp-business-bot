const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceAtTime: { type: Number, required: true } // Snapshot of price
});

const orderSchema = new mongoose.Schema({
  customerPhone: { type: String, required: true },
  items: [orderItemSchema],
  status: { 
    type: String, 
    enum: ['draft', 'confirmed', 'processing', 'completed', 'cancelled'],
    default: 'draft'
  },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);