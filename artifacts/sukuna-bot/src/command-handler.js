import { sendBotErrorLog, logError } from "./logging.js";
import { UserFacingError } from "./permissions.js";
import { handleModeration } from "./commands/moderation.js";
import { handleAnimeInteraction } from "./commands/anime-interactions.js";
import { handleRoleButton, handleRoleManagement } from "./commands/roles.js";
import { handleUtility } from "./commands/utility.js";

const COMMAND_PREFIX = "s";

export function parseCommand(content) {
  const match = /^s(?:\s+([\s\S]*))?$/.exec(content ?? "");
  if (!match) return null;

  const words = (match[1] ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    command: words.shift()?.toLowerCase() ?? "",
    args: words,
  };
}

async function replySafely(message, content) {
  try {
    await message.reply({
      content,
      allowedMentions: { repliedUser: false, parse: [] },
    });
  } catch (error) {
    logError(error, "Could not reply to a server command");
  }
}

export async function handleMessage(message, client, store) {
  if (message.author?.bot || !message.guild) return;

  const parsed = parseCommand(message.content);
  if (!parsed) return;
  if (!parsed.command) {
    await replySafely(message, "Use `s help` to see the available commands.");
    return;
  }

  try {
    const handled =
      (await handleModeration(message, parsed.command, parsed.args, store)) ||
      (await handleRoleManagement(message, parsed.command, store)) ||
      (await handleUtility(message, parsed.command, parsed.args, client)) ||
      (await handleAnimeInteraction(message, parsed.command, client, store));

    if (!handled) {
      await replySafely(message, "Unknown command. Use `s help` to see the command list.");
    }
  } catch (error) {
    if (error instanceof UserFacingError) {
      await replySafely(message, error.message);
      return;
    }

    await sendBotErrorLog(message.guild, store, `Command ${parsed.command}`, error);
    await replySafely(message, "That command could not be completed. Please try again later.");
  }
}

export async function handleInteraction(interaction, store) {
  if (!interaction.isButton()) return;

  try {
    await handleRoleButton(interaction, store);
  } catch (error) {
    await sendBotErrorLog(interaction.guild, store, "Button interaction", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "That action could not be completed. Try again later.", ephemeral: true })
        .catch(() => {});
    }
  }
}

export { COMMAND_PREFIX };
