
require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField
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

// Detecta o domínio vdo.ninja, com ou sem protocolo HTTP/HTTPS.
function extrairLinksVdoNinja(texto) {
    const regex = /\b(?:https?:\/\/)?(?:[\w-]+\.)*vdo\.ninja(?:[^\s<>]*)?/gi;

    const encontrados = texto.match(regex) || [];

    return [...new Set(
        encontrados.map(link =>
            link.replace(/[.,!?;:)\]}]+$/g, '')
        )
    )];
}

cliente.once('ready', () => {
    console.log(`Bot conectado como ${cliente.user.tag}`);
});

cliente.on('messageCreate', async mensagem => {
    try {
        // Ignora mensagens de outros bots e mensagens privadas.
        if (mensagem.author.bot || !mensagem.guild) {
            return;
        }

        // Evita processar links enviados no próprio canal de destino.
        if (mensagem.channel.id === CANAL_DESTINO_ID) {
            return;
        }

        const links = extrairLinksVdoNinja(mensagem.content);

        if (links.length === 0) {
            return;
        }

        // Busca o canal em que os links serão publicados.
        const canalDestino = await cliente.channels.fetch(
            CANAL_DESTINO_ID
        );

        if (!canalDestino || !canalDestino.isTextBased()) {
            console.error('Canal de destino inválido.');
            return;
        }

        // Confere se o bot consegue publicar e apagar mensagens.
        const permissoesDestino =
            canalDestino.permissionsFor(cliente.user);

        if (
            !permissoesDestino ||
            !permissoesDestino.has(
                PermissionsBitField.Flags.ViewChannel
            ) ||
            !permissoesDestino.has(
                PermissionsBitField.Flags.SendMessages
            )
        ) {
            console.error(
                'O bot não tem permissão para publicar no destino.'
            );
            return;
        }

        const permissoesOrigem =
            mensagem.channel.permissionsFor(cliente.user);

        if (
            !permissoesOrigem ||
            !permissoesOrigem.has(
                PermissionsBitField.Flags.ViewChannel
            ) ||
            !permissoesOrigem.has(
                PermissionsBitField.Flags.ManageMessages
            )
        ) {
            console.error(
                `Sem permissão para apagar a mensagem em ${mensagem.channel.id}.`
            );
            return;
        }

        // Publica os links antes de apagar a mensagem original.
        const conteudo = [
            `📹 **Link(s) do VDO.Ninja**`,
            `**Enviado por:** ${mensagem.author.username}`,
            `**Canal original:** <#${mensagem.channel.id}>`,
            '',
            ...links
        ].join('\n');

        await canalDestino.send({
            content: conteudo,
            allowedMentions: {
                parse: []
            }
        });

        // Só apaga a mensagem se a publicação tiver dado certo.
        await mensagem.delete();

        console.log(
            `${links.length} link(s) encaminhado(s) e mensagem apagada.`
        );

    } catch (erro) {
        console.error('Erro ao processar mensagem:', erro);
    }
});

if (!TOKEN || !CANAL_DESTINO_ID) {
    throw new Error(
        'Configure DISCORD_TOKEN e DESTINATION_CHANNEL_ID no arquivo .env.'
    );
}

cliente.login(TOKEN);
