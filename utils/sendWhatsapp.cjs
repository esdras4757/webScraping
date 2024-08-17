const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

let client;
let isClientReady = false; // Variable para rastrear si el cliente está listo

function initializeClient(item) {
    client = new Client({
        authStrategy: new LocalAuth(), // Guarda la sesión localmente
        puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']}
    });

    // Genera el código QR para iniciar sesión por primera vez
    client.on("qr", (qr) => {
        qrcode.generate(qr, { small: true });
    });

    client.on('disconnected', (reason) => {
        console.log('Sesión desconectada:', reason);
        // Volver a inicializar el cliente después de la desconexión
        setTimeout(() => {
            initializeClient();
        }, 10000); // Esperar 10 segundos antes de intentar reconectar
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure:', msg);
        // Intentar reiniciar el cliente
        initializeClient();
    });

    client.on('change_state', (state) => {
        console.log('Client state changed:', state);
    });

    // Evento que indica que el cliente está listo
    client.on("ready", () => {
        console.log("Client is ready!");
        isClientReady = true; // Marcar que el cliente está listo
    });

    client.initialize();
}

// Inicializar el cliente por primera vez
initializeClient();

// Función para enviar un mensaje
async function sendMessage(number, message, img) {
    if (!isClientReady) {
        console.error("Client is not ready yet!");
        return;
    }

    try {
        // Convierte el número en el formato necesario
        const contacts = await client.getContacts();
        const contact = contacts.find(({ name }) => name === "Yo");
        if (!contact) {
            throw new Error("Contact not found");
        }

        const {
            id: { _serialized: chatId },
        } = contact;
        if (!img) {
            // Envía el mensaje sin imagen
            await client.sendMessage(chatId, message);
            console.log("Mensaje enviado con éxito a " + number);
            return;
        }

        const response = await axios.get(img, { responseType: "arraybuffer" });
        const imageBase64 = Buffer.from(response.data).toString("base64");

        const media = new MessageMedia("image/jpeg", imageBase64);

        // Envía el mensaje con la imagen
        await client.sendMessage(chatId, media, { caption: message });
        console.log("Whatsapp enviado con éxito ");

    } catch (err) {
        console.error('Error al enviar el mensaje: ', err);
        if (err.message.includes("Session closed") || err.message.includes("not ready") || err.message.includes("Evaluation failed")) {
            console.log("Sesión cerrada, intentando reiniciar...");
            initializeClient(); // Reiniciar el cliente en caso de error
        }
    }
}

// Exporta la función usando CommonJS
module.exports = sendMessage;
