import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { handleInteraction, handleMessage } from "./src/command-handler.js";
import {
  assignAutorole,
  logError,
  sendWelcomeMessage,
} from "./src/logging.js";
import { JsonStore } from "./src/store.js";

const requiredIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

const client = new Client({ intents: requiredIntents });

async function start() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is missing. Add it in Replit Secrets before starting Sukuna.");
  }

  const store = await JsonStore.fromEnvironment().load();

  client.once(Events.ClientReady, (readyClient) => {
    console.info(
      `[Sukuna] Logged in as ${readyClient.user.tag}; connected to ${readyClient.guilds.cache.size} server(s).`,
    );
  });

  client.on(Events.MessageCreate, (message) => {
    void handleMessage(message, client, store);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, store);
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void sendWelcomeMessage(member, store);
    void assignAutorole(member, store);
  });

  client.on(Events.Error, (error) => {
    logError(error, "Discord client error");
  });

  await client.login(process.env.DISCORD_TOKEN);
}

process.on("unhandledRejection", (error) => {
  logError(error, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logError(error, "Uncaught exception; stopping the bot");
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    console.info(`[Sukuna] Received ${signal}; shutting down.`);
    client.destroy();
    process.exit(0);
  });
}

start().catch((error) => {
  logError(error, "Startup failed. Check the token, enabled Discord intents, and data file.");
  process.exitCode = 1;
});
