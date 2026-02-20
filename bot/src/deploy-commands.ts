import { REST, Routes } from 'discord.js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from './config'

interface Command {
  data: { toJSON: () => object; name: string }
}

async function deployCommands() {
  const commands: object[] = []

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
        if ('data' in command) {
          commands.push(command.data.toJSON())
          console.log(`[Deploy] Queued: /${command.data.name}`)
        }
      } catch (err) {
        console.error(`[Deploy] Failed to load ${filePath}:`, err)
      }
    }
  }

  const rest = new REST().setToken(config.botToken)

  console.log(`\n[Deploy] Registering ${commands.length} command(s) to guild ${config.guildId}...`)

  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    ) as object[]

    console.log(`✅ Successfully registered ${(data as any[]).length} guild command(s)`)
  } catch (error) {
    console.error('[Deploy] Failed to register commands:', error)
    process.exit(1)
  }
}

deployCommands()
