import { PermissionFlagsBits } from "discord.js";

export class UserFacingError extends Error {}

const privilegedRolePermissions = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "KickMembers",
  "BanMembers",
  "ModerateMembers",
  "ManageMessages",
  "ManageWebhooks",
  "ManageEvents",
  "ManageThreads",
  "ManageNicknames",
  "MentionEveryone",
  "ViewAuditLog",
  "ManageGuildExpressions",
  "ManageEmojisAndStickers",
  "ManageGuildScheduledEvents",
  "ManageSoundboard",
];

export function selfAssignableRoleProblem(role) {
  if (!role) return "That role could not be found.";
  if (role.id === role.guild.id) return "The @everyone role cannot be self-assigned.";
  if (role.managed) return "Integration-managed roles cannot be self-assigned.";

  const privilegedFlag = privilegedRolePermissions.find((name) => {
    const permission = PermissionFlagsBits[name];
    return permission !== undefined && role.permissions.has(permission);
  });

  if (privilegedFlag) {
    return "That role has staff-level permissions and cannot be self-assigned.";
  }

  return null;
}

export function requirePermission(message, permission, readableName) {
  const member = message.member;
  const isOwner = message.guild?.ownerId === message.author.id;

  if (!member || (!isOwner && !member.permissions.has(permission))) {
    throw new UserFacingError(`You need the **${readableName}** permission to do that.`);
  }
}

export function requireBotPermission(guild, permission, readableName) {
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has(permission)) {
    throw new UserFacingError(
      `I need the **${readableName}** permission in this server to do that.`,
    );
  }
  return botMember;
}

export function requireBotChannelPermission(guild, channel, permission, readableName) {
  const botMember = requireBotPermission(guild, permission, readableName);
  const channelPermissions = channel.permissionsFor?.(botMember);
  if (!channelPermissions?.has(permission)) {
    throw new UserFacingError(
      `I need the **${readableName}** permission in this channel to do that.`,
    );
  }
  return botMember;
}

export function requireTextChannel(channel) {
  if (!channel?.isTextBased?.() || !channel.send) {
    throw new UserFacingError("Use this command in a text channel.");
  }
}

export function requireManageableMember(message, target, { allowSelf = false } = {}) {
  const guild = message.guild;
  const actor = message.member;
  const botMember = guild.members.me;
  if (!actor) {
    throw new UserFacingError("I could not verify your server membership.");
  }
  if (!botMember) {
    throw new UserFacingError("I could not verify my server role. Try again in a moment.");
  }

  if (!target) throw new UserFacingError("I could not find that server member.");
  if (target.id === guild.ownerId) {
    throw new UserFacingError("The server owner cannot be managed by bot commands.");
  }
  if (!allowSelf && target.id === message.author.id) {
    throw new UserFacingError("You cannot use this command on yourself.");
  }
  if (target.id === botMember.id) {
    throw new UserFacingError("I cannot use this command on myself.");
  }

  const actorIsOwner = guild.ownerId === actor?.id;
  if (
    !actorIsOwner &&
    target.roles.highest.comparePositionTo(actor.roles.highest) >= 0
  ) {
    throw new UserFacingError(
      "Your highest role must be above the member's highest role to manage them.",
    );
  }

  if (target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
    throw new UserFacingError(
      "My highest role must be above the member's highest role to manage them.",
    );
  }

  return botMember;
}

export function requireManageableRole(message, role) {
  const guild = message.guild;
  if (!message.member) {
    throw new UserFacingError("I could not verify your server membership.");
  }
  const actorIsOwner = guild.ownerId === message.author.id;
  const botMember = requireBotPermission(guild, PermissionFlagsBits.ManageRoles, "Manage Roles");

  if (!role) throw new UserFacingError("I could not find that role.");
  if (role.id === guild.id) {
    throw new UserFacingError("The @everyone role cannot be assigned or removed.");
  }
  if (role.managed) {
    throw new UserFacingError("Integration-managed roles cannot be assigned or removed.");
  }

  if (
    !actorIsOwner &&
    role.comparePositionTo(message.member.roles.highest) >= 0
  ) {
    throw new UserFacingError(
      "Your highest role must be above the role you want to manage.",
    );
  }

  if (role.comparePositionTo(botMember.roles.highest) >= 0) {
    throw new UserFacingError(
      "My highest role must be above the role you want to manage.",
    );
  }
}

export function mentionedMember(message) {
  return message.mentions.members.first() ?? null;
}

export function mentionedRole(message) {
  return message.mentions.roles.first() ?? null;
}

export function mentionedTextChannel(message) {
  return message.mentions.channels.first() ?? null;
}
