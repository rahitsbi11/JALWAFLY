const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const port = 8080;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Retrieve the Telegram bot token from the environment variable
const botToken = process.env.TELEGRAM_BOT_TOKEN;

// Create the Telegram bot instance
const bot = new TelegramBot(botToken, { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || "User";
  const welcomeMessage = `😇 Hello, ${username}!\n\n`
    + 'Welcome to the Indishort URL Shortener Bot!\n'
    + 'You can use this bot to shorten URLs using the jalwagame.42web.io API service.\n\n'
    + 'To shorten a URL, just type or paste the URL directly in the chat, and the bot will provide you with the shortened URL.\n\n'
    + 'If you haven\'t set your Indishort API token yet, use the command:\n/setapi YOUR_Indishort_API_TOKEN\n\n'
    + 'How To Use Me 👇👇 \n\n'
    + '✅1. Go to https://jalwagame.42web.io & complete your registration.\n\n'
    + '✅2. Copy your API key from: https://jalwagame.42web.io/member/tools/api\n\n'
    + '✅3. Then add your API using command:\n/setapi YOUR_API_KEY\n\n'
    + 'Example: /setapi c49399f821fc020161bc2a31475ec59f35ae5b4\n\n'
    + '⚠️ You must send link with https:// or http://\n\n'
    + 'Made with ❤️ By: @rahitx\n\n'
    + '**Now, go ahead and try it out!**';

  bot.sendMessage(chatId, welcomeMessage);
});

// Command: /setapi
bot.onText(/\/setapi (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userToken = match[1].trim();

  // Save the user's API token to the database
  saveUserToken(chatId, userToken);

  const response = `Your Indishort API token set successfully ✅\nYour token is: ${userToken}`;
  bot.sendMessage(chatId, response);
});

// Listen for any message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  // Check text or caption
  if (msg.text || msg.caption) {
    const text = msg.text || msg.caption;
    const links = extractLinks(text);

    if (links.length > 0) {
      const shortenedLinks = await shortenMultipleLinks(chatId, links);
      const updatedText = replaceLinksInText(text, links, shortenedLinks);
      bot.sendMessage(chatId, updatedText, { reply_to_message_id: msg.message_id });
    }
  }

  // If message has media
  if (msg.photo || msg.video || msg.document) {
    const caption = msg.caption || '';
    const links = extractLinks(caption);

    if (links.length > 0) {
      const shortenedLinks = await shortenMultipleLinks(chatId, links);
      const updatedCaption = replaceLinksInText(caption, links, shortenedLinks);
      bot.sendMessage(chatId, updatedCaption, { reply_to_message_id: msg.message_id });
    }
  }
});

// Extract URLs
function extractLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})([^\s]*)/g;
  return [...text.matchAll(urlRegex)].map(match => match[0]);
}

// Replace links
function replaceLinksInText(text, originalLinks, shortenedLinks) {
  let updatedText = text;
  originalLinks.forEach((link, index) => {
    updatedText = updatedText.replace(link, shortenedLinks[index]);
  });
  return updatedText;
}

// Shorten multiple links
async function shortenMultipleLinks(chatId, links) {
  const shortenedLinks = [];
  for (const link of links) {
    const shortenedLink = await shortenUrl(chatId, link);
    shortenedLinks.push(shortenedLink || link);
  }
  return shortenedLinks;
}

// Shorten single URL
async function shortenUrl(chatId, url) {
  const apiToken = getUserToken(chatId);

  if (!apiToken) {
    bot.sendMessage(chatId, 'Please set up 🎃 your INDISHORT API token first.\nUse: /setapi YOUR_API_TOKEN');
    return null;
  }

  try {
    const apiUrl = `https://jalwagame.42web.io/api?api=${apiToken}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(apiUrl);

    console.log('API URL:', apiUrl);
    console.log('API Response:', response.data);

    if (response.data.status === 'success') {
      return response.data.shortenedUrl || response.data.shortlink || null;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Shorten URL Error:', error.response ? error.response.data : error);
    return null;
  }
}

// Save API token
function saveUserToken(chatId, token) {
  const dbData = getDatabaseData();
  dbData[chatId] = token;
  fs.writeFileSync('database.json', JSON.stringify(dbData, null, 2));
}

// Get API token
function getUserToken(chatId) {
  const dbData = getDatabaseData();
  return dbData[chatId];
}

// Read database
function getDatabaseData() {
  try {
    return JSON.parse(fs.readFileSync('database.json', 'utf8'));
  } catch {
    return {};
  }
}
