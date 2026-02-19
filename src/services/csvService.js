const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Product = require('../models/Product');

const CSV_PATH = path.join(__dirname, '../../data/products.csv');

async function initializeProducts() {
  return new Promise((resolve, reject) => {
    const products = [];
    
    // Check if file exists
    if (!fs.existsSync(CSV_PATH)) {
      console.log('No products.csv found, skipping import');
      resolve({ count: 0 });
      return;
    }

    // Clear existing products
    Product.deleteMany({})
      .then(() => {
        fs.createReadStream(CSV_PATH)
          .pipe(csv())
          .on('data', (row) => {
            try {
              const product = {
                sku: row.sku || row.SKU || row.code,
                name: row.name || row.Name || row.product,
                description: row.description || row.Description || '',
                price: parseFloat(row.price || row.Price || row.cost || 0),
                currency: row.currency || row.Currency || 'USD',
                category: row.category || row.Category || 'General',
                stock: parseInt(row.stock || row.Stock || row.quantity || 0),
                imageUrl: row.imageUrl || row.image || row.Image || ''
              };
              
              if (product.sku && product.name && !isNaN(product.price)) {
                products.push(product);
              }
            } catch (err) {
              console.error('Error parsing row:', err);
            }
          })
          .on('end', async () => {
            try {
              if (products.length > 0) {
                await Product.insertMany(products);
                console.log(`Successfully imported ${products.length} products`);
              }
              resolve({ count: products.length });
            } catch (err) {
              reject(err);
            }
          })
          .on('error', reject);
      })
      .catch(reject);
  });
}

module.exports = { initializeProducts };
