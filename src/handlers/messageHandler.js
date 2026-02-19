const UserSession = require('../models/UserSession');
const Product = require('../models/Product');
const Order = require('../models/Order');
const whatsappService = require('../services/whatsappService');

class MessageHandler {
  async handleMessage(from, messageBody, provider) {
    const phone = from.replace(/\D/g, '');
    const text = messageBody.trim().toUpperCase();
    
    console.log(`Message from ${phone}: ${messageBody}`);

    // Get or create user session
    let session = await UserSession.findOne({ phoneNumber: phone });
    if (!session) {
      session = new UserSession({ phoneNumber: phone });
    }

    // Update last activity
    session.lastActivity = new Date();

    try {
      // Command routing
      if (text === 'MENU' || text === 'START' || text === 'HI' || text === 'HELLO') {
        await this.showMenu(phone, session);
      } else if (text === 'PRODUCTS' || text === 'CATALOG') {
        await this.showProducts(phone, session);
      } else if (text === 'CART') {
        await this.showCart(phone, session);
      } else if (text === 'CHECKOUT') {
        await this.initiateCheckout(phone, session);
      } else if (text === 'CONFIRM') {
        await this.confirmOrder(phone, session);
      } else if (text === 'ADD') {
        await this.showProducts(phone, session);
      } else if (text === 'CANCEL') {
        await this.cancelOrder(phone, session);
      } else if (text.startsWith('REMOVE ')) {
        const itemIndex = parseInt(text.replace('REMOVE ', '')) - 1;
        await this.removeFromCart(phone, session, itemIndex);
      } else if (session.currentState === 'selecting_quantity' && /^\d+$/.test(text)) {
        await this.addToCart(phone, session, parseInt(text));
      } else if (/^\d+$/.test(text) && parseInt(text) > 0 && parseInt(text) <= 20) {
        // User selected a product number
        await this.selectProduct(phone, session, parseInt(text));
      } else {
        await this.sendHelp(phone);
      }

      await session.save();
    } catch (error) {
      console.error('Handler error:', error);
      await whatsappService.sendMessage(phone, 'Sorry, something went wrong. Please try again or type MENU.');
    }
  }

  async showMenu(phone, session) {
    session.currentState = 'idle';
    session.cart = [];
    session.selectedProduct = null;
    
    const message = `👋 *Welcome to our WhatsApp Store!*\n\n` +
      `What would you like to do?\n\n` +
      `📦 *PRODUCTS* - Browse catalog\n` +
      `🛒 *CART* - View your cart\n` +
      `💳 *CHECKOUT* - Complete order\n\n` +
      `Type any command to begin!`;
    
    await whatsappService.sendMessage(phone, message);
  }

  async showProducts(phone, session) {
    const products = await Product.find({ isActive: true, stock: { $gt: 0 } }).limit(10);
    
    if (products.length === 0) {
      await whatsappService.sendMessage(phone, 'Sorry, no products available at the moment.');
      return;
    }

    session.currentState = 'browsing';
    await whatsappService.sendProductList(phone, products);
  }

  async selectProduct(phone, session, productNumber) {
    const products = await Product.find({ isActive: true, stock: { $gt: 0 } }).limit(10);
    
    if (productNumber < 1 || productNumber > products.length) {
      await whatsappService.sendMessage(phone, 'Invalid product number. Please try again.');
      return;
    }

    const product = products[productNumber - 1];
    
    session.currentState = 'selecting_quantity';
    session.selectedProduct = {
      productId: product._id.toString(),
      name: product.name,
      price: product.price
    };

    const message = `You selected: *${product.name}*\n` +
      `Price: $${product.price.toFixed(2)}\n` +
      `Available: ${product.stock} units\n\n` +
      `How many would you like to order? (Reply with a number)`;
    
    await whatsappService.sendMessage(phone, message);
  }

  async addToCart(phone, session, quantity) {
    if (!session.selectedProduct) {
      await whatsappService.sendMessage(phone, 'Please select a product first. Type PRODUCTS.');
      return;
    }

    // Check stock
    const product = await Product.findById(session.selectedProduct.productId);
    if (!product || product.stock < quantity) {
      await whatsappService.sendMessage(phone, `Sorry, only ${product?.stock || 0} units available. Please try a lower quantity.`);
      return;
    }

    // Add to cart
    const existingItem = session.cart.find(item => item.productId === session.selectedProduct.productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      session.cart.push({
        productId: session.selectedProduct.productId,
        name: session.selectedProduct.name,
        quantity: quantity,
        price: session.selectedProduct.price
      });
    }

    session.currentState = 'browsing';
    session.selectedProduct = null;

    const totalItems = session.cart.reduce((sum, item) => sum + item.quantity, 0);
    const message = `✅ Added ${quantity} x ${product.name} to cart!\n\n` +
      `You have ${totalItems} item(s) in cart.\n\n` +
      `Type:\n` +
      `• *PRODUCTS* - Add more items\n` +
      `• *CART* - Review cart\n` +
      `• *CHECKOUT* - Complete order`;
    
    await whatsappService.sendMessage(phone, message);
  }

  async showCart(phone, session) {
    if (session.cart.length === 0) {
      await whatsappService.sendMessage(phone, 'Your cart is empty. Type PRODUCTS to browse.');
      return;
    }

    const total = session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    await whatsappService.sendCartReview(phone, session.cart, total);
    session.currentState = 'reviewing_cart';
  }

  async removeFromCart(phone, session, itemIndex) {
    if (itemIndex < 0 || itemIndex >= session.cart.length) {
      await whatsappService.sendMessage(phone, 'Invalid item number. Please check your cart.');
      return;
    }

    const removed = session.cart.splice(itemIndex, 1)[0];
    await whatsappService.sendMessage(phone, `Removed ${removed.name} from cart.`);
    
    if (session.cart.length > 0) {
      await this.showCart(phone, session);
    } else {
      await whatsappService.sendMessage(phone, 'Cart is now empty. Type PRODUCTS to browse.');
      session.currentState = 'idle';
    }
  }

  async initiateCheckout(phone, session) {
    if (session.cart.length === 0) {
      await whatsappService.sendMessage(phone, 'Your cart is empty. Add some products first!');
      return;
    }

    await this.showCart(phone, session);
    session.currentState = 'confirming_order';
  }

  async confirmOrder(phone, session) {
    if (session.cart.length === 0) {
      await whatsappService.sendMessage(phone, 'No items to order. Type PRODUCTS to start.');
      return;
    }

    const total = session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create order
    const orderItems = session.cart.map(item => ({
      product: item.productId,
      quantity: item.quantity,
      priceAtTime: item.price
    }));

    const order = new Order({
      customerPhone: phone,
      items: orderItems,
      totalAmount: total,
      status: 'confirmed'
    });

    await order.save();

    // Update stock
    for (const item of session.cart) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear session
    session.cart = [];
    session.currentState = 'idle';
    session.selectedProduct = null;

    await whatsappService.sendOrderConfirmation(phone, order._id.toString().slice(-6).toUpperCase(), total);
  }

  async cancelOrder(phone, session) {
    const itemCount = session.cart.length;
    session.cart = [];
    session.currentState = 'idle';
    session.selectedProduct = null;
    
    await whatsappService.sendMessage(phone, 
      itemCount > 0 
        ? `Cancelled. Removed ${itemCount} item(s) from cart. Type MENU to start over.`
        : 'No active order to cancel. Type MENU to start.'
    );
  }

  async sendHelp(phone) {
    const message = `❓ *Help Menu*\n\n` +
      `Available commands:\n` +
      `• *MENU* - Main menu\n` +
      `• *PRODUCTS* - Browse products\n` +
      `• *CART* - View cart\n` +
      `• *CHECKOUT* - Place order\n` +
      `• *CANCEL* - Cancel current order\n\n` +
      `When browsing, reply with product numbers to select.`;
    
    await whatsappService.sendMessage(phone, message);
  }
}

module.exports = new MessageHandler();