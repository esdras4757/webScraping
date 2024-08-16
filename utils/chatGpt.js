import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// Asegúrate de que la variable de entorno OPENAI_API_KEY esté configurada
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chatgptMessage = async (message) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: [
        {
          role: "system",
          content:
            "dame un JSON valido con las props type:String,name:String,precio:string,discount:String,cupon:String,shop:String,nameforSearchInOtherShop:String. El type con valor producto si habla de un producto en especifico y la prop name que contenga solo la marca y modelo. Si no encuentras una propiedad mandala como null, en nameforSearchInOtherShop manda el nombre del producto formateado incluyendo modelo y marca para que sea facil de encontrar en otras tienda",
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
