import { Client, Collection, GatewayIntentBits, Interaction, Events } from 'discord.js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from './config'
import { handleButton } from './handlers/button-handler'
import { handleModal } from './handlers/modal-handler'
import { handleSelect } from './handlers/select-handler'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Command {
  data: { name: string; toJSON: () => object }
  execute: (interaction: any) => Promise<void>
}

// ─── Client Setup ─────────────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})

const commands = new Collection<string, Command>()

// ─── Load Commands ────────────────────────────────────────────────────────────

function loadCommands() {
  const foldersPath = path.join(__dirname, 'commands')
  const commandFolders = fs.readdirSync(foldersPath)

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    if (!fs.statSync(commandsPath).isDirectory()) continue

    const ext = __filename.endsWith('.ts') ? '.ts' : '.js'
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(ext))
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      try {
        const command: Command = require(filePath)
        if ('data' in command && 'execute' in command) {
          commands.set(command.data.name, command)
          console.log(`[Commands] Loaded: /${command.data.name}`)
        } else {
          console.warn(`[Commands] Missing data/execute in ${filePath}`)
        }
      } catch (err) {
        console.error(`[Commands] Failed to load ${filePath}:`, err)
      }
    }
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot ready: ${c.user.tag}`)
  console.log(`📋 Loaded ${commands.size} command(s)`)
})

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName)
      if (!command) {
        console.warn(`[Commands] Unknown command: ${interaction.commandName}`)
        return
      }
      await command.execute(interaction)
      return
    }

    // Button Interactions
    if (interaction.isButton()) {
      await handleButton(interaction)
      return
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
      await handleModal(interaction)
      return
    }

    // Select Menus
    if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction)
      return
    }
  } catch (error) {
    console.error('[InteractionCreate] Unhandled error:', error)

    const errorMessage = { content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', ephemeral: true }

    try {
      if (interaction.isRepliable()) {
        if ((interaction as any).deferred || (interaction as any).replied) {
          await (interaction as any).editReply(errorMessage)
        } else {
          await (interaction as any).reply(errorMessage)
        }
      }
    } catch {}
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

loadCommands()
client.login(config.botToken)
