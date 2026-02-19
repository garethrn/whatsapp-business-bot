const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.provider = process.env.META_ACCESS_TOKEN ? 'meta' : 'twilio';
  }

  async sendMessage(to, message, buttons = null) {
    try {
      // Clean phone number
      const cleanPhone = to.replace(/\D/g, '');
      
      if (this.provider === 'meta') {
        await this.sendMetaMessage(cleanPhone, message, buttons);
      } else {
        await this.sendTwilioMessage(cleanPhone, message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendMetaMessage(phone, message, buttons) {
    const url = `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`;
    
    let payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: buttons ? 'interactive' : 'text',
    };

    if (buttons) {
      payload.interactive = {
        type: 'button',
        body: { text: message },
        action: {
          buttons: buttons.map((btn, idx) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${idx}`,
              title: btn.title
            }
          }))
        }
      };
    } else {
      payload.text = { body: message };
    }

    await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async sendTwilioMessage(phone, message) {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    await client.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${phone}`
    });
  }

  async sendProductList(phone, products) {
    let message = '📦 *Available Products*\n\n';
    
    products.forEach((product, index) => {
      message += `${index + 1}. *${product.name}*\n`;
      message += `   💰 $${product.price.toFixed(2)}\n`;
      if (product.description) {
        message += `   📝 ${product.description}\n`;
      }
      message += `   🔢 Stock: ${product.stock}\n\n`;
    });
    
    message += '\nReply with the number of the product you want to order, or type:\n';
    message += '• *CART* - View your cart\n';
    message += '• *CHECKOUT* - Complete order\n';
    message += '• *CANCEL* - Clear cart';

    await this.sendMessage(phone, message);
  }

  async sendCartReview(phone, cart, total) {
    let message = '🛒 *Your Cart Review*\n\n';
    
    cart.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      message += `${index + 1}. ${item.name}\n`;
      message += `   ${item.quantity} x $${item.price.toFixed(2)} = $${itemTotal.toFixed(2)}\n\n`;
    });
    
    message += `*Total: $${total.toFixed(2)}*\n\n`;
    message += 'Reply:\n';
    message += '• *CONFIRM* - Place order\n';
    message += '• *ADD* - Add more items\n';
    message += '• *REMOVE [number]* - Remove item\n';
    message += '• *CANCEL* - Cancel order';

    await this.sendMessage(phone, message);
  }

  async sendOrderConfirmation(phone, orderId, total) {
    const message = `✅ *Order Confirmed!*\n\n` +
      `Order ID: #${orderId}\n` +
      `Total: $${total.toFixed(2)}\n\n` +
      `Thank you for your order! We'll process it shortly.\n` +
      `Type *MENU* to start a new order.`;
    
    await this.sendMessage(phone, message);
  }
}

module.exports = new WhatsAppService();