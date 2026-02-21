import { Client, GatewayIntentBits } from 'discord.js'

// Singleton Discord client — shared across the bot
export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})
