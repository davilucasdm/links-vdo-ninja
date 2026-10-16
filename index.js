require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const cliente = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CANAL_DESTINO_ID = process.env.DESTINATION_CHANNEL_ID;

// Função original para extrair links
function extrairLinksVdoNinja(texto) {
    const regex = /\b(?:https?:\/\/)?(?:[\w-]+\.)*vdo\.ninja(?:[^\s<>]*)?/gi;
    const encontrados = texto.match(regex) || [];
    return [...new Set(
        encontrados.map(link => link.replace(/[.,!?;:)\]}]+$/g, ''))
    )];
}

// Evento Ready: Conecta o bot e registra o comando /tela
cliente.once('ready', async () => {
    console.log(`Bot conectado como ${cliente.user.tag}`);

    // Criação do comando de barra /tela
    const comandos = [
        new SlashCommandBuilder()
            .setName('tela')
            .setDescription('Inicia uma sessão de compartilhamento de tela pelo VDO.Ninja')
    ].map(comando => comando.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Registrando comando /tela no Discord...');
        await rest.put(
            Routes.applicationCommands(cliente.user.id),
            { body: comandos }
        );
        console.log('Comando registrado com sucesso!');
    } catch (erro) {
        console.error('Erro ao registrar o comando de barra:', erro);
    }
});

// Evento para interações de Comandos de Barra (/tela)
cliente.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'tela') {
        try {
            // Gera um ID de sessão único baseado no ID do usuário e no timestamp atual
            const sessionId = `tela_${interaction.user.id}_${Date.now()}`;

            // Gera os links com os parâmetros adequados de automação
            const linkTransmissao = `https://vdo.ninja/?push=${sessionId}&screenshare&autostart&displaysurface`;
            const linkVisualizacao = `https://vdo.ninja/?view=${sessionId}`;

            // 1. Envia o link de transmissão de forma PRIVADA (efêmera) para o usuário que executou o comando
            await interaction.reply({
                content: `🎥 **Sua sessão de tela foi criada!**\n\nClique no link abaixo para começar a compartilhar sua tela no navegador. **(Não compartilhe este link com ninguém!)**\n🔗 [Iniciar Compartilhamento de Tela](${linkTransmissao})\n\n*O link para o pessoal assistir já foi enviado para o canal público.*`,
                ephemeral: true 
            });

            // 2. Busca o canal de destino configurado e envia o link PÚBLICO de visualização
            const canalDestino = await cliente.channels.fetch(CANAL_DESTINO_ID);
            
            if (canalDestino && canalDestino.isTextBased()) {
                await canalDestino.send({
                    content: `📺 **Transmissão de Tela (VDO.Ninja)**\n**Iniciada por:** ${interaction.user}\n🔗 **Assista aqui:** ${linkVisualizacao}`
                });
            } else {
                console.error('Falha ao enviar link de visualização: Canal de destino inválido.');
            }

        } catch (erro) {
            console.error('Erro ao executar o comando /tela:', erro);
            // Responde em caso de erro para não deixar a interação travada no Discord
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Ocorreu um erro ao tentar criar a sessão de tela.', ephemeral: true });
            }
        }
    }
});

// Evento original: Gerenciamento de mensagens com links VDO.Ninja (mantido intacto)
cliente.on('messageCreate', async mensagem => {
    try {
        if (mensagem.author.bot || !mensagem.guild) return;
        if (mensagem.channel.id === CANAL_DESTINO_ID) return;

        const links = extrairLinksVdoNinja(mensagem.content);
        if (links.length === 0) return;

        const canalDestino = await cliente.channels.fetch(CANAL_DESTINO_ID);

        if (!canalDestino || !canalDestino.isTextBased()) {
            console.error('Canal de destino inválido.');
            return;
        }

        const permissoesDestino = canalDestino.permissionsFor(cliente.user);
        if (!permissoesDestino || !permissoesDestino.has(PermissionsBitField.Flags.ViewChannel) || !permissoesDestino.has(PermissionsBitField.Flags.SendMessages)) {
            console.error('O bot não tem permissão para publicar no destino.');
            return;
        }

        const permissoesOrigem = mensagem.channel.permissionsFor(cliente.user);
        if (!permissoesOrigem || !permissoesOrigem.has(PermissionsBitField.Flags.ViewChannel) || !permissoesOrigem.has(PermissionsBitField.Flags.ManageMessages)) {
            console.error(`Sem permissão para apagar a mensagem em ${mensagem.channel.id}.`);
            return;
        }

        const conteudo = [
            `📹 **Link(s) do VDO.Ninja**`,
            `**Enviado por:** ${mensagem.author.username}`,
            `**Canal original:** <#${mensagem.channel.id}>`,
            '',
            ...links
        ].join('\n');

        await canalDestino.send({
            content: conteudo,
            allowedMentions: { parse: [] }
        });

        await mensagem.delete();
        console.log(`${links.length} link(s) encaminhado(s) e mensagem apagada.`);

    } catch (erro) {
        console.error('Erro ao processar mensagem:', erro);
    }
});

if (!TOKEN || !CANAL_DESTINO_ID) {
    throw new Error('Configure DISCORD_TOKEN e DESTINATION_CHANNEL_ID no arquivo .env.');
}

cliente.login(TOKEN);
