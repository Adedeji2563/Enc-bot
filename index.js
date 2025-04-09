const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const app = express();
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: false });
const activeChats = new Set();

// Middleware
app.use(express.json());

// ========================
// CORE FUNCTIONS
// ========================

/**
 * Displays the banner image with custom caption
 */
async function showBanner(chatId, caption = "") {
  try {
    await bot.sendPhoto(chatId, config.BANNER_IMAGE, {
      caption: `🔒 *Shadow EncryptBot*\n\n${caption}\n_Developer: @Shadow_2563_`,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Failed to send banner:', error);
    await bot.sendMessage(chatId, `🔒 *Shadow EncryptBot*\n\n${caption}\n_Developer: @Shadow_2563_`, {
      parse_mode: 'Markdown'
    });
  }
}

/**
 * Encrypts text using AES-256
 */
function encryptText(text) {
  return CryptoJS.AES.encrypt(text, config.SECRET_KEY).toString();
}

/**
 * Decrypts text using AES-256
 */
function decryptText(encryptedText) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, config.SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Downloads files from Telegram servers
 */
async function downloadFile(fileId) {
  const filePath = await bot.getFile(fileId);
  const downloadUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${filePath.file_path}`;
  const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  return response.data.toString();
}

/**
 * Shows loading animation with progress
 */
async function showLoadingAnimation(chatId, messageId, action, progress) {
  const progressBar = '▰'.repeat(progress) + '▱'.repeat(10 - progress);
  await bot.editMessageText(
    `⏳ ${action}... (${progress * 10}%)\n` +
    `${progressBar}\n` +
    `_Powered by Shadow_`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    }
  );
}

// ========================
// BOT COMMAND HANDLERS
// ========================

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
bot.onText(/\/start/, async (msg) => {
  await showBanner(msg.chat.id, "Secure message encryption/decryption");
  await bot.sendMessage(msg.chat.id, '🔮 *Choose an action:*', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['🔒 Encrypt', '🔓 Decrypt'],
        ['ℹ️ Help', '📢 Broadcast (Owner)']
      ],
      resize_keyboard: true
    }
  });
});

// Help command
bot.onText(/\/help/, async (msg) => {
  await showBanner(msg.chat.id, "Command Help Center");
  await bot.sendMessage(msg.chat.id,
    `🛠 *How to use:*\n` +
    `1. Send any text/file\n` +
    `2. Reply with:\n` +
    `   • "enc" → Encrypt\n` +
    `   • "dec" → Decrypt\n\n` +
    `*Owner commands:*\n` +
    `/broadcast - Send message to all users\n\n` +
    `_Running on Render_`,
    { parse_mode: 'Markdown' }
  );
});

// Main encryption/decryption handler
bot.on('message', async (msg) => {
  if (!msg.reply_to_message || !msg.text) return;

  const replyText = msg.text.toLowerCase();
  const chatId = msg.chat.id;
  const isEncrypt = replyText === 'enc' || replyText === '🔒 encrypt';
  const isDecrypt = replyText === 'dec' || replyText === '🔓 decrypt';

  if (!isEncrypt && !isDecrypt) return;

  try {
    // Show initial banner
    await showBanner(chatId, `${isEncrypt ? 'Encryption' : 'Decryption'} initiated`);

    // Create loading message
    const loadingMsg = await bot.sendMessage(
      chatId,
      `⏳ Processing... (0%)\n` +
      `▱▱▱▱▱▱▱▱▱▱\n` +
      `_Powered by Shadow_`,
      { parse_mode: 'Markdown' }
    );

    // Animate loading
    for (let i = 1; i <= 10; i++) {
      await showLoadingAnimation(chatId, loadingMsg.message_id, 
        isEncrypt ? 'Encrypting' : 'Decrypting', i);
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Get content to process
    let originalContent;
    if (msg.reply_to_message.text) {
      originalContent = msg.reply_to_message.text;
    } else if (msg.reply_to_message.document) {
      originalContent = await downloadFile(msg.reply_to_message.document.file_id);
    }

    if (!originalContent) throw new Error("No content to process");

    // Process content
    const result = isEncrypt ? encryptText(originalContent) : decryptText(originalContent);
    if (!result) throw new Error(isEncrypt ? "Encryption failed" : "Invalid encrypted content");

    // Save to temporary file
    const fileName = isEncrypt ? 'encrypted.txt' : 'decrypted.txt';
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, result);

    // Send result
    await bot.sendDocument(
      chatId,
      filePath,
      {
        caption: `✅ ${isEncrypt ? 'Encrypted' : 'Decrypted'} (100%)\n` +
                `▰▰▰▰▰▰▰▰▰▰\n` +
                `_Powered by Shadow_`,
        parse_mode: 'Markdown'
      }
    );

    // Cleanup
    fs.unlinkSync(filePath);
    await bot.deleteMessage(chatId, loadingMsg.message_id);

  } catch (error) {
    await showBanner(chatId, `❌ Error: ${error.message}`);
    console.error('Processing error:', error);
  }
});

// Broadcast command
bot.onText(/\/broadcast|📢 broadcast \(owner\)/i, async (msg) => {
  if (msg.from.id.toString() !== config.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "🚫 Owner-only command");
  }

  const broadcastText = msg.text.replace(/\/broadcast|📢 broadcast \(owner\)/i, '').trim();
  if (!broadcastText) return bot.sendMessage(msg.chat.id, "Usage: /broadcast <message>");

  await showBanner(msg.chat.id, "Preparing broadcast...");
  const loadingMsg = await bot.sendMessage(msg.chat.id, "📡 Sending to all users...");

  let success = 0;
  const totalChats = activeChats.size;
  
  for (const chatId of activeChats) {
    try {
      await bot.sendMessage(chatId, 
        `📢 *Owner Announcement*\n\n${broadcastText}\n\n` +
        `_@Shadow_2563_`,
        { parse_mode: 'Markdown' }
      );
      success++;
      
      // Update progress every 10 sends
      if (success % 10 === 0) {
        await bot.editMessageText(
          `📡 Broadcasting...\n` +
          `• Progress: ${Math.floor((success / totalChats) * 100)}%\n` +
          `• Sent: ${success}/${totalChats}`,
          {
            chat_id: msg.chat.id,
            message_id: loadingMsg.message_id
          }
        );
      }
    } catch (error) {
      activeChats.delete(chatId);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  await showBanner(msg.chat.id, 
    `✅ Broadcast complete\n` +
    `• Sent: ${success} chats\n` +
    `• Failed: ${totalChats - success} chats`
  );
  await bot.deleteMessage(msg.chat.id, loadingMsg.message_id);
});

// ========================
// SERVER SETUP
// ========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set webhook automatically on Render
  if (process.env.RENDER_EXTERNAL_URL) {
    await bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);
    console.log('Webhook configured for Render');
  }
});
