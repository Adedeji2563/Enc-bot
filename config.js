require('dotenv').config();

module.exports = {
  TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN || '8018532058:AAExGZVU2VNaKX_53xPw7Ps8B82pqAf6zDc',
  ADMIN_ID: process.env.ADMIN_ID || '7092629860', // Your Telegram ID
  SECRET_KEY: process.env.SECRET_KEY || 'Shadow',
  BANNER_IMAGE: 'https://files.catbox.moe/ljnxao.png',
  
  BOT_SETTINGS: {
    encryptCommand: 'enc',
    decryptCommand: 'dec',
    maxFileSize: 5 * 1024 * 1024 // 5MB
  }
};
