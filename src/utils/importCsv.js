const { initializeProducts } = require('../services/csvService');

async function run() {
  try {
    const result = await initializeProducts();
    console.log(`Import completed: ${result.count} products`);
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

run();