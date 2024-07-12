require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { PrismaClient } = require("@prisma/client");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const prisma = new PrismaClient();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "leaderboard") {
    await handleLeaderboard(interaction);
  } else if (commandName === "matches") {
    await handleMatches(interaction);
  }
});

async function handleLeaderboard(interaction) {
  try {
    const pageSize = 10;
    let currentPage = 0;

    const totalPlayers = await prisma.player.count();
    const totalPages = Math.ceil(totalPlayers / pageSize);

    const fetchPlayersForPage = async (page) => {
      return prisma.player.findMany({
        skip: page * pageSize,
        take: pageSize,
        orderBy: {
          elo: "desc",
        },
      });
    };

    const generateLeaderboardEmbed = (players, page) => {
      let response = `Leaderboard (Page ${page + 1}/${totalPages}):\n\n`;
      players.forEach((player, index) => {
        const globalRank = page * pageSize + index + 1;
        response += `${globalRank}. ${player.name} - ELO: ${player.elo.toFixed(
          2
        )} | Matches: ${player.matches} | Wins: ${player.wins}\n`;
      });
      return response;
    };

    const updateMessage = async (interaction, page) => {
      const players = await fetchPlayersForPage(page);
      const content = generateLeaderboardEmbed(players, page);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      return { content, components: [row] };
    };

    const message = await interaction.reply({
      ...(await updateMessage(interaction, currentPage)),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "previous") {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === "next") {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      await i.update(await updateMessage(interaction, currentPage));
    });

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      interaction.editReply({ components: [disabledRow] });
    });
  } catch (error) {
    console.error(error);
    await interaction.reply(
      "An error occurred while fetching the leaderboard."
    );
  }
}

async function handleMatches(interaction) {
  try {
    const pageSize = 5;
    let currentPage = 0;

    const totalMatches = await prisma.match.count();
    const totalPages = Math.ceil(totalMatches / pageSize);

    const fetchMatchesForPage = async (page) => {
      return prisma.match.findMany({
        skip: page * pageSize,
        take: pageSize,
        orderBy: {
          date: "desc",
        },
        include: {
          players: {
            include: {
              player: true,
            },
          },
        },
      });
    };

    const generateMatchesEmbed = (matches, page) => {
      let response = `Matches (Page ${page + 1}/${totalPages}):\n\n`;
      matches.forEach((match, index) => {
        response += `${index + 1}. Date: ${match.date.toDateString()}, Time: ${
          match.time
        }, Location: ${match.location}\n`;

        const teams = match.players.reduce((acc, pm) => {
          if (!acc[pm.team]) {
            acc[pm.team] = [];
          }
          acc[pm.team].push(pm.player.name);
          return acc;
        }, {});

        Object.entries(teams).forEach(([teamName, players]) => {
          response += `   Team ${teamName}: ${players.join(", ")}\n`;
        });

        if (match.result) {
          response += `   Result: ${match.result}\n`;
        }
        response += "\n";
      });
      return response;
    };

    const updateMessage = async (interaction, page) => {
      const matches = await fetchMatchesForPage(page);
      const content = generateMatchesEmbed(matches, page);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      return { content, components: [row] };
    };

    const message = await interaction.reply({
      ...(await updateMessage(interaction, currentPage)),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "previous") {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === "next") {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      await i.update(await updateMessage(interaction, currentPage));
    });

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      interaction.editReply({ components: [disabledRow] });
    });
  } catch (error) {
    console.error(error);
    await interaction.reply("An error occurred while fetching the matches.");
  }
}

async function registerCommands() {
  const commands = [
    {
      name: "leaderboard",
      description: "Show the player leaderboard",
    },
    {
      name: "matches",
      description: "Show recent matches",
    },
  ];

  try {
    console.log("Started refreshing application (/) commands.");
    await client.application.commands.set(commands);
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}

client.login(process.env.DISCORD_TOKEN);
