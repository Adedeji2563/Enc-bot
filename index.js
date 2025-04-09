const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const config = require('./config');
const fs = require('fs');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
const CHAT_STORAGE = 'chats.json';

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

// Chat storage functions
function saveChatId(chatId) {
  let chats = [];
  if (fs.existsSync(CHAT_STORAGE)) {
    chats = JSON.parse(fs.readFileSync(CHAT_STORAGE));
  }
  if (!chats.includes(chatId)) {
    chats.push(chatId);
    fs.writeFileSync(CHAT_STORAGE, JSON.stringify(chats));
  }
}

function getAllChatIds() {
  if (fs.existsSync(CHAT_STORAGE)) {
    return JSON.parse(fs.readFileSync(CHAT_STORAGE));
  }
  return [];
}

// Loading animation
async function showLoading(chatId, originalMsgId, action) {
  const symbols = ['▱▱▱▱▱▱▱▱▱▱', '▰▱▱▱▱▱▱▱▱▱', '▰▰▱▱▱▱▱▱▱▱', '▰▰▰▱▱▱▱▱▱▱', 
                  '▰▰▰▰▱▱▱▱▱▱', '▰▰▰▰▰▱▱▱▱▱', '▰▰▰▰▰▰▱▱▱▱', '▰▰▰▰▰▰▰▱▱▱',
                  '▰▰▰▰▰▰▰▰▱▱', '▰▰▰▰▰▰▰▰▰▱', '▰▰▰▰▰▰▰▰▰▰'];
  
  const loadingMsg = await bot.sendMessage(chatId, 
    `🔒 *EncryptBot*\n\n` +
    `⏳ ${action === 'encrypt' ? 'Encrypting' : 'Decrypting'}... (0%)\n` +
    `${symbols[0]}\n\n` +
    `_Powered by Shadow_`,
    { 
      parse_mode: 'Markdown',
      reply_to_message_id: originalMsgId
    }
  );

  for (let i = 1; i <= 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    await bot.editMessageText(
      `🔒 *EncryptBot*\n\n` +
      `${i === 10 ? '✅' : '⏳'} ${action === 'encrypt' ? 'Encrypting' : 'Decrypting'}... (${i*10}%)\n` +
      `${symbols[i]}\n\n` +
      `_Powered by Shadow_`,
      {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: 'Markdown'
      }
    );
  }

  return loadingMsg.message_id;
}

// Menu with banner
async function showMenu(chatId) {
  try {
    await bot.sendPhoto(chatId, config.BANNER_IMAGE, {
      caption: `🔒 *EncryptBot*\n\n` +
               `Secure your messages with military-grade encryption\n\n` +
               `_Powered by Shadow_`,
      parse_mode: 'Markdown'
    });

    await bot.sendMessage(chatId, 'Choose an option:', {
      reply_markup: {
        keyboard: [
          ['🔒 Encrypt', '🔓 Decrypt'],
          ['ℹ️ Help', '📢 Broadcast (Admin)']
        ],
        resize_keyboard: true
      }
    });
  } catch (error) {
    console.error('Menu error:', error);
  }
}

// Start command
bot.onText(/\/start/, async (msg) => {
  saveChatId(msg.chat.id);
  await showMenu(msg.chat.id);
});

// Help command
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `*EncryptBot Help*\n\n` +
    `🔹 *Reply to any message with:*\n` +
    `- "enc" to encrypt it\n` +
    `- "dec" to decrypt it\n\n` +
    `🔹 *Admin Commands:*\n` +
    `/broadcast - Send message to all users\n\n` +
    `_Powered by Shadow_`,
    { parse_mode: 'Markdown' }
  );
});

// Handle reply-based encryption/decryption
bot.on('message', async (msg) => {
  if (!msg.reply_to_message) return;

  const chatId = msg.chat.id;
  const replyText = msg.text ? msg.text.toLowerCase() : '';
  const isEncrypt = replyText === 'enc';
  const isDecrypt = replyText === 'dec';

  if (!isEncrypt && !isDecrypt) return;

  try {
    const action = isEncrypt ? 'encrypt' : 'decrypt';
    const loadingMsgId = await showLoading(chatId, msg.reply_to_message.message_id, action);

    if (msg.reply_to_message.text) {
      const originalText = msg.reply_to_message.text;
      let result = isEncrypt ? encryptText(originalText) : decryptText(originalText);

      await bot.editMessageText(
        `🔒 *EncryptBot*\n\n` +
        `${result ? '✅' : '❌'} ${isEncrypt ? 'Encrypted' : 'Decrypted'}${!result && isDecrypt ? ' (Invalid format)' : ''}:\n` +
        `${result ? `\`\`\`\n${result}\n\`\`\`` : ''}\n\n` +
        `_Powered by Shadow_`,
        {
          chat_id: chatId,
          message_id: loadingMsgId,
          parse_mode: 'Markdown'
        }
      );
    }
  } catch (error) {
    console.error("Error:", error);
  }
});

// Admin broadcast
bot.onText(/\/broadcast (.+)/, async (msg) => {
  if (msg.from.id.toString() !== config.ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Admin access required");
  }

  const broadcastText = msg.text.replace('/broadcast ', '');
  const chats = getAllChatIds();
  const loadingMsg = await bot.sendMessage(msg.chat.id, `📢 Preparing broadcast to ${chats.length} chats...`);

  let success = 0;
  for (const chatId of chats) {
    try {
      await bot.sendMessage(chatId, `📢 *Broadcast*\n\n${broadcastText}\n\n_Powered by Shadow_`, {
        parse_mode: 'Markdown'
      });
      success++;
    } catch (error) {
      console.error(`Failed to send to ${chatId}:`, error);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  await bot.editMessageText(
    `📢 *Broadcast Results*\n\n` +
    `✅ Sent to: ${success} chats\n` +
    `❌ Failed: ${chats.length - success} chats\n\n` +
    `_Powered by Shadow_`,
    {
      chat_id: msg.chat.id,
      message_id: loadingMsg.message_id,
      parse_mode: 'Markdown'
    }
  );
});

console.log('🤖 Shadow EncryptBot is fully operational');
