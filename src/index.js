

// Core
const {Client, GatewayIntentBits, Partials, ChannelType} = require('discord.js');
const Discord = require('discord.js');
//const client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES", "GUILD_INTEGRATIONS"] });
const client = new Client({ intents: [GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates

    ], partials: [Partials.Channel, Partials.Message] });



const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require("path")

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const config = require("../config.json");

const rest = new REST({ version: '9' }).setToken(config["BOT_TOKEN"]);
const Database = require('better-sqlite3');

client.pathDB = path.join(__dirname, 'database', 'database.db');

client.commands = new Discord.Collection(); 


for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
	client.commands.set(command.data.name, command);

}



(async () => {
	try {

		await rest.put(
			Routes.applicationGuildCommands(config["clientID"], config["guildID"]),
			{ body: commands },
		);

	} catch (error) {
		console.error(error);
	}
})();



client.once('ready', async () => {

    console.log(`On as ${client.user.tag}`)

    const db = new Database(client.pathDB)
        
    db.exec(`CREATE TABLE IF NOT EXISTS Track(
        channelId TEXT NOT NULL,
        channelName TEXT NOT NULL,
        creatorId TEXT NOT NULL,
        PRIMARY KEY (creatorId)
        );`);


    console.log("[+] Database connected");

    db.close();

    
    
})



client.on('voiceStateUpdate', async (oldState, newState) => {

    const {channel, channelId, guild, member} = newState;
    const {channel: oldChannel, channelId: oldChannelId, member:oldMember} = oldState;


    const db = new Database(client.pathDB)

    sql = db.prepare('SELECT channelId AS dbChannel FROM Track');


    let needsToBeChecked = false

    for (dbChannel of sql.iterate()) {
        if (dbChannel.dbChannel === oldChannelId) {
            needsToBeChecked = true   
        }
    }


    if (needsToBeChecked) {
        // Check if the room has to be deleted since there is nobody

        if (channel && (config["createChannels"]["basicPublic"][channelId])) {
            sql = db.prepare('SELECT creatorId AS hasAlreadyOneChannel FROM Track WHERE creatorId = ?');
            let {hasAlreadyOneChannel} = {...sql.get(member.id)};

            if (hasAlreadyOneChannel) {
                await member.send("Hai gia' un canale coglione")
                await member.voice.disconnect()

            }

        }
        
        if (oldChannel.members.size === 0) {
            console.log("Deve essere eliminata")
            oldChannel.delete("Autoremoval").then( () => console.log("Eliminata"))
            sql2 = db.prepare('DELETE FROM Track WHERE channelId = ?');
            sql2.run(oldChannelId)


        }

    } else {

    
        if (channel && (config["createChannels"]["basicPublic"][channelId])) {

            sql = db.prepare(`INSERT INTO Track
            VALUES (?, ?, ?);`);
    
            guild.channels.create({
                name: config["createChannels"]["basicPublic"][channelId]["channelName"],
                type: ChannelType.GuildVoice,
                parent : config["createChannels"]["basicPublic"][channelId]["categoryId"],
                nsfw : config["createChannels"]["basicPublic"][channelId]["isNsfw"]
                
            }).then( (newChannel) => {
                const {name, id} = newChannel;
                
                member.voice.setChannel(newChannel) 
                sql.run(id, name, member.id);
    
                })
            }
            }
        


});



client.on('interactionCreate', async interaction => {
	if (interaction.type !== InteractionType.ApplicationCommand) return;


	const command = client.commands.get(interaction.commandName);
	if (!command) return console.log("Doesn't exist!");

    if (interaction.commandName === "fetchuser" && interaction.member.roles.cache.has(...config["fetchRoles"])) await command.execute(interaction)
    else if (interaction.member.roles.cache.has(config["wiperRole"]) || interaction.member.roles.cache.has("814520164866326568")) await command.execute(interaction);
    else await interaction.reply("Non hai abbastanza permessi!");
    

});






client.login(config["BOT_TOKEN"]);

