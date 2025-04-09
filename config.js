require('dotenv').config();

module.exports = {
  TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN,
  SECRET_KEY: process.env.SECRET_KEY || 'Shadow',
  ADMIN_ID: process.env.ADMIN_ID || '7092629860', // Your Telegram ID
  BANNER_IMAGE: 'https://files.catbox.moe/ljnxao.png'
};
