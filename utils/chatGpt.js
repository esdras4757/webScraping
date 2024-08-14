import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// Asegúrate de que la variable de entorno OPENAI_API_KEY esté configurada
const openai = new OpenAI({apiKey:process.env.OPENAI_API_KEY});

const chatgptMessage = async (message) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: [
        {
          role: "system",
          content: "dame un JSON con 2 props el type con valor producto si habla de un producto en especifico y la prop name que contenga la informacion que sirva para realizar la busqueda del producto en amazon. Si no identificas un producto y se trata de un descuento en una tienda como doto,amazon,walmart etc.. dame un JSON con el tipo descuento y el nombre de la oferta",
        },
        {
          role: "user",
          content: message, 
        },
      ],
    });
   return completion.choices[0].message.content; // Mostrar el contenido de la respuesta en la consola
  } catch (error) {
    console.error("Error al comunicarse con OpenAI API:", error);
  }
};

export default chatgptMessage;