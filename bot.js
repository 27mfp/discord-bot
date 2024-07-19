require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { PrismaClient } = require('@prisma/client');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const prisma = new PrismaClient();

console.log('Bot is starting up...');

client.once('ready', () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
    registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    console.log(`Command received: ${commandName}`);

    if (commandName === 'leaderboard') {
        console.log('Executing leaderboard command');
        await handleLeaderboard(interaction);
    } else if (commandName === 'matches') {
        console.log('Executing matches command');
        await handleMatches(interaction);
    }
});

async function handleLeaderboard(interaction) {
    console.log('Starting leaderboard command');
    try {
        await interaction.deferReply();
        console.log('Interaction deferred');

        const pageSize = 10;
        let currentPage = 0;

        console.log('Fetching total player count');
        const totalPlayers = await prisma.player.count();
        const totalPages = Math.ceil(totalPlayers / pageSize);

        console.log(`Total players: ${totalPlayers}, Total pages: ${totalPages}`);

        const fetchPlayersForPage = async (page) => {
            console.log(`Fetching players for page ${page}`);
            return prisma.player.findMany({
                skip: page * pageSize,
                take: pageSize,
                orderBy: {
                    elo: 'desc'
                }
            });
        };

        const generateLeaderboardEmbed = (players, page) => {
            console.log(`Generating leaderboard embed for page ${page}`);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🏆 Leaderboard')
                .setDescription(`Showing top players ${page * pageSize + 1}-${page * pageSize + players.length} out of ${totalPlayers}`)
                .setFooter({ text: `Page ${page + 1}/${totalPages}` });

            const leaderboardField = players.map((player, index) => {
                const globalRank = page * pageSize + index + 1;
                const medal = globalRank === 1 ? '🥇' : globalRank === 2 ? '🥈' : globalRank === 3 ? '🥉' : `${globalRank}.`;
                return `${medal} **${player.name}**\nELO: ${player.elo.toFixed(2)} | Matches: ${player.matches} | Wins: ${player.wins}`;
            }).join('\n\n');

            embed.addFields({ name: 'Rankings', value: leaderboardField });

            return embed;
        };

        const createMessage = async (page) => {
            console.log(`Creating message for page ${page}`);
            const players = await fetchPlayersForPage(page);
            const embed = generateLeaderboardEmbed(players, page);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1)
                );

            return { embeds: [embed], components: [row] };
        };

        console.log('Sending initial leaderboard message');
        await interaction.editReply(await createMessage(currentPage));

        const message = await interaction.fetchReply();
        console.log('Leaderboard message sent, setting up collector');

        const collector = message.createMessageComponentCollector({
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            console.log(`Button clicked: ${i.customId}`);
            await i.deferUpdate();
            if (i.customId === 'previous') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            console.log(`Updating leaderboard to page ${currentPage}`);
            await i.editReply(await createMessage(currentPage));
        });

        collector.on('end', () => {
            console.log('Leaderboard collector ended');
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );

            interaction.editReply({ components: [disabledRow] }).catch(() => {
                console.log('Failed to edit reply after collector end. Message may have been deleted.');
            });
        });

        console.log('Leaderboard command completed successfully');
    } catch (error) {
        console.error('Error in leaderboard command:', error);
        await interaction.editReply({ content: 'An error occurred while fetching the leaderboard.', components: [] }).catch(console.error);
    }
}

async function handleMatches(interaction) {
    console.log('Starting matches command');
    try {
        await interaction.deferReply();
        console.log('Interaction deferred');

        const pageSize = 5;
        let currentPage = 0;

        console.log('Fetching total match count');
        const totalMatches = await prisma.match.count();
        const totalPages = Math.ceil(totalMatches / pageSize);

        console.log(`Total matches: ${totalMatches}, Total pages: ${totalPages}`);

        const fetchMatchesForPage = async (page) => {
            console.log(`Fetching matches for page ${page}`);
            return prisma.match.findMany({
                skip: page * pageSize,
                take: pageSize,
                orderBy: {
                    date: 'desc'
                },
                include: {
                    players: {
                        include: {
                            player: true
                        }
                    }
                }
            });
        };

        const generateMatchesEmbed = (matches, page) => {
            console.log(`Generating matches embed for page ${page}`);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⚽ Recent Matches')
                .setDescription(`Showing matches ${page * pageSize + 1}-${page * pageSize + matches.length} out of ${totalMatches}`)
                .setFooter({ text: `Page ${page + 1}/${totalPages}` });

            matches.forEach((match, index) => {
                const teams = match.players.reduce((acc, pm) => {
                    if (!acc[pm.team]) {
                        acc[pm.team] = [];
                    }
                    acc[pm.team].push(pm.player.name);
                    return acc;
                }, {});

                let matchDetails = `📅 ${match.date.toDateString()}\n⏰ ${match.time}\n📍 ${match.location}\n\n`;
                Object.entries(teams).forEach(([teamName, players]) => {
                    matchDetails += `**Team ${teamName}:** ${players.join(', ')}\n`;
                });

                if (match.result) {
                    matchDetails += `\n**Result:** ${match.result}`;
                }

                embed.addFields({ name: `Match ${index + 1}`, value: matchDetails });
            });

            return embed;
        };

        const createMessage = async (page) => {
            console.log(`Creating message for page ${page}`);
            const matches = await fetchMatchesForPage(page);
            const embed = generateMatchesEmbed(matches, page);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1)
                );

            return { embeds: [embed], components: [row] };
        };

        console.log('Sending initial matches message');
        await interaction.editReply(await createMessage(currentPage));

        const message = await interaction.fetchReply();
        console.log('Matches message sent, setting up collector');

        const collector = message.createMessageComponentCollector({
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            console.log(`Button clicked: ${i.customId}`);
            await i.deferUpdate();
            if (i.customId === 'previous') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            console.log(`Updating matches to page ${currentPage}`);
            await i.editReply(await createMessage(currentPage));
        });

        collector.on('end', () => {
            console.log('Matches collector ended');
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                );

            interaction.editReply({ components: [disabledRow] }).catch(() => {
                console.log('Failed to edit reply after collector end. Message may have been deleted.');
            });
        });

        console.log('Matches command completed successfully');
    } catch (error) {
        console.error('Error in matches command:', error);
        await interaction.editReply({ content: 'An error occurred while fetching the matches.', components: [] }).catch(console.error);
    }
}

async function registerCommands() {
    console.log('Registering slash commands');
    const commands = [
        {
            name: 'leaderboard',
            description: 'Show the player leaderboard'
        },
        {
            name: 'matches',
            description: 'Show recent matches'
        }
    ];

    try {
        console.log('Started refreshing application (/) commands.');
        await client.application.commands.set(commands);
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

client.login(process.env.DISCORD_TOKEN);
