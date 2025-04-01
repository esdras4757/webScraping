const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const express = require("express");
// const open = require("open"); // Para abrir imágenes
const axios = require("axios");

const app = express();
let client;
let isClientReady = false;
let latestQR = ""; // Guarda el último QR generado

// Servidor Express para mostrar el QR en el navegador
app.get("/qr", async (req, res) => {
  if (!latestQR) {
    return res.send("Esperando a que se genere el QR...");
  }
  const qrImg = await qrcode.toDataURL(latestQR);
  res.send(`<img src="${qrImg}" style="width:300px"/>`);
});

app.listen(5002, () => console.log("Servidor en http://localhost:5002/qr"));

function initializeClient() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr) => {
    latestQR = qr; // Guarda el QR
    console.log("Escanea el QR en http://localhost:5002/qr");
    qrcodeTerminal.generate(qr, { small: true });

    // Genera la imagen del QR
    await qrcode.toFile("qr.png", qr);
    // open("qr.png"); // Abre la imagen automáticamente
  });

  client.on("ready", () => {
    console.log("✅ Cliente listo!");
    isClientReady = true;
  });

  client.on("disconnected", (reason) => {
    console.log("❌ Sesión desconectada:", reason);
    setTimeout(initializeClient, 10000); // Intenta reconectar en 10 segundos
  });

  client.on("auth_failure", (msg) => {
    console.error("🚨 Fallo de autenticación:", msg);
    initializeClient(); // Reiniciar en caso de fallo
  });

  client.initialize();
}

initializeClient();

async function sendMessage(number, message, img) {
    if (!isClientReady) {
      console.error("Client is not ready yet!");
      return;
    }
  
    try {
      // Convierte el número en el formato necesario
      const contacts = await client.getContacts();
      const contact = contacts.find(({ number }) => number == "5215564978543");
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
      const responsewp = await client.sendMessage(chatId, media, {
        caption: message,
      });
  
      console.log("Mensaje enviado con éxito a " + number);
    } catch (err) {
      console.error("Error al enviar el mensaje: ", err);
      if (
        err.message.includes("Session closed") ||
        err.message.includes("not ready") ||
        err.message.includes("Evaluation failed")
      ) {
        console.log("Sesión cerrada, intentando reiniciar...");
        initializeClient(); // Reiniciar el cliente en caso de error
      }
    }
  }

module.exports = sendMessage;
