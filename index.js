const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const config = require('./config');

const app = express();
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN);
const activeChats = new Set(); // For broadcast functionality

// Middleware
app.use(express.json());

// Encryption functions
function encryptText(text) {
  return CryptoJS.AES.encrypt(text, config.SECRET_KEY).toString();
}

function decryptText(encryptedText) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, config.SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || null;
  } catch (e) {
    return null;
  }
}

// Webhook route
app.post(`/webhook`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Track active chats
bot.on('message', (msg) => {
  activeChats.add(msg.chat.id);
});

// Start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    `🔒 *EncryptBot*\n\n` +
    `Reply to messages with:\n` +
    `• "enc" → Encrypt\n` +
    `• "dec" → Decrypt\n\n` +
    `_Running on Render_`,
    { parse_mode: 'Markdown' }
  );
});

// Enc/Dec handling
bot.on('message', async (msg) => {
  if (!msg.reply_to_message || !msg.text) return;
  
  const replyText = msg.text.toLowerCase();
  const chatId = msg.chat.id;

  if (replyText === 'enc') {
    const encrypted = encryptText(msg.reply_to_message.text);
    bot.sendMessage(chatId, `🔐 *Encrypted:*\n\`${encrypted}\``, 
      { parse_mode: 'Markdown' });
  } 
  else if (replyText === 'dec') {
    const decrypted = decryptText(msg.reply_to_message.text);
    bot.sendMessage(chatId, 
      decrypted ? `🔓 *Decrypted:*\n\`${decrypted}\`` : "❌ Invalid encrypted text",
      { parse_mode: 'Markdown' }
    );
  }
});

// Admin broadcast command
bot.onText(/\/broadcast (.+)/, async (msg) => {
  if (msg.from.id.toString() !== config.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Admin only command");
  }

  const broadcastText = msg.text.replace('/broadcast ', '');
  const loadingMsg = await bot.sendMessage(msg.chat.id, "📢 Preparing broadcast...");

  let success = 0;
  const chats = Array.from(activeChats);
  
  for (const chatId of chats) {
    try {
      await bot.sendMessage(chatId, 
        `📢 *Broadcast Message*\n\n${broadcastText}\n\n` +
        `_Powered by EncryptBot_`,
        { parse_mode: 'Markdown' }
      );
      success++;
    } catch (error) {
      activeChats.delete(chatId); // Remove inactive chats
    }
    await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
  }

  await bot.editMessageText(
    `✅ Broadcast complete\n` +
    `Sent to: ${success} chats\n` +
    `Failed: ${chats.length - success} chats`,
    {
      chat_id: msg.chat.id,
      message_id: loadingMsg.message_id
    }
  );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set webhook automatically on Render
  if (process.env.RENDER_EXTERNAL_URL) {
    await bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);
    console.log('Webhook configured for Render');
  }
});
