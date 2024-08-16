import express, { json } from "express";
import playwriting from "playwright";
import { chromium } from "playwright";
import readline from "readline";
import cron from "node-cron";
import nodemailer from "nodemailer";
import chatgptMessage from "./utils/chatGpt.js";
import sendMessage from "./utils/sendWhatsapp.cjs";

let mostRecentItems = [];

const shops = [
    // {
    //     shop: "GoogleCompare",
    //     getInfo: async (page, answer) => {
    //       const path =
    //         // "https://listado.mercadolibre.com.mx/" + answer.replace(/ /g, "-");
    //         `https://www.google.com/search?tbm=shop&hl=es-419&psb=1&ved=2ahUKEwj0_d_zzviHAxV8UUgAHdJ7GzEQu-kFegQIABAJ&q=${answer.replace(/ /g, "+")}&oq=${answer.replace(/ /g, "+")}&gs_lp=Egtwcm9kdWN0cy1jYyIHcnl6ZW4gNUgAUABYAHAAeACQAQCYAQCgAQCqAQC4AQPIAQCYAgCgAgCYAwCSBwCgBwA&sclient=products-cc#spd=3945146843610265752`;
    //       await page.goto(path, { timeout: 60000 });
    
    //       const list = await page.evaluate((path) => {
    //         return Array.from(
    //           document.querySelectorAll(".sh-dgr__grid-result")
    //         ).map((item) => ({
    //           shop: "GoogleCompare",
    //           name:
    //             item.querySelector(".tAxDx")?.textContent || null,
    //           price:
    //             item.querySelector(".OFFNJ")?.textContent ||
    //             null,
    //           path: item.querySelector(".shntl")?.href || null,
    //         }));
    //       }, path); // Pasar el path como argumento
    
    //       return list;
    //     },
    //   },
  {
    shop: "Mercado libre",
    getInfo: async (page, answer) => {
      const path =
        "https://listado.mercadolibre.com.mx/" + answer.replace(/ /g, "-");
      await page.goto(path, { timeout: 60000 });

      const list = await page.evaluate((path) => {
        return Array.from(
          document.querySelectorAll(".ui-search-layout__item")
        ).map((item) => ({
          shop: "Mercado libre",
          name:
            item.querySelector(".ui-search-item__title")?.textContent || null,
          price:
            item.querySelector(".andes-money-amount__fraction")?.textContent ||
            null,
          path: item.querySelector(".ui-search-link")?.href || null,
        }));
      }, path); // Pasar el path como argumento

      return list;
    },
  },
  {
    shop: "Amazon",
    getInfo: async (page, answer) => {
      const path = "https://www.amazon.com.mx/s?k=" + answer.replace(/ /g, "+");
      await page.goto(path, { timeout: 60000 });

      const list = await page.$$eval(
        '[data-component-type="s-search-result"]',
        (items, path) => {
          return items.map((item) => ({
            shop: "Amazon",
            name:
              item.querySelector(".s-title-instructions-style")?.textContent ||
              null,
            price: item.querySelector(".a-price-whole")?.textContent || null,
            path: item.querySelector(".a-link-normal")?.href || null,
          }));
        },
        path
      ); // Pasar el path como argumento

      return list;
    },
  },
];

const app = express();
const port = 5001;

app.get("/getProducts", async (req, res) => {
  const producto = "ryzen 5 5600x";
  const list = await getPrices(producto, 5);
  res.send(list);
});

function formatMessage(item, finalResults) {
  const name = item.name != null && item.name !== undefined? `*${item.name}*` : "";
  const discount =
    finalResults.discount != null && finalResults.discount !== undefined && finalResults.discount !== NaN
      ? `con un descuento de *${finalResults.discount}*`
      : "";
  const priceWithDiscount =
    finalResults.priceWithDiscount !== null && finalResults.priceWithDiscount !== undefined && finalResults.priceWithDiscount !== NaN
      ? `por solo *$${finalResults.priceWithDiscount}*`
      : "";
  const realDiscount =
    finalResults.realDiscount != null && finalResults.realDiscount !== undefined && finalResults.realDiscount !== NaN
      ? `\n\nDescuento real estimado de *${finalResults.realDiscount?.toFixed(
          2
        )}%*`
      : "";
  const cupon =
    finalResults.cupon != null && finalResults.cupon !== undefined ? `con el cupón *${finalResults.cupon}*` : "";
  const shop = finalResults.shop != null && finalResults.shop !== undefined ? `en ${finalResults.shop}` : "";
  const path = finalResults.path !== null && finalResults.path !== undefined ? `\n\n${finalResults.path}%` : "";

  let message =
    `${name} ${discount} ${priceWithDiscount} ${cupon} ${shop} ${realDiscount}`.trim();

  return message;
}

const getOffersPD = async () => {
  try {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    });
    const page = await context.newPage();
    await page.goto("https://www.promodescuentos.com/nuevas", {
      timeout: 60000,
    });
    await page.screenshot({ path: "ss.png" });
    const content = await page.$$eval(".cept-thread-item", (items) => {
      return items.slice(0, 4).map((item) => {
        return {
          id: item.id,
          name: item.querySelector(".thread-title")?.textContent || null,
          discount:
            item.querySelector(".size--fromW3-xl.text--color-charcoal")
              ?.textContent || null,
          price:
            item.querySelector(".threadItemCard-price")?.textContent || null,
          shop: item.querySelector(".thread-title")?.textContent.includes(":")
            ? item.querySelector(".thread-title")?.textContent.split(":")[0]
            : null,
          cupon:
            item.querySelector('[data-t="copyVoucherCode"]')?.value || null,
          image:
            item
              .querySelector(".thread-image")
              ?.src?.replace("300x300", "768x768") || null,
          path:
            item.querySelector(".width--all-12.button--shape-circle")?.href ||
            null,
        };
      });
    });

    const idsInMostRecentItems = new Set(
      mostRecentItems.map((item) => item.id)
    );
    const filteredContent = content.filter(
      (item) => !idsInMostRecentItems.has(item.id)
    );
    if (filteredContent && filteredContent.length > 0) {
      filteredContent.forEach(async (item) => {
        if (item.price === null || item.cupon !== null) {
          item.type = "descuento";
          item.realName = item.name;
        }

        let nameFormated = { name: item.name, type: "descuento" };
        if (item.type !== "descuento") {
          nameFormated = await chatgptMessage(
            ///formatea las propiedades del producto para que sean validas
            item.name +
              " " +
              "descuento:" +
              item.discount +
              " " +
              "$" +
              item.price +
              " " +
              "shop:" +
              item.shop +
              " " +
              "cupon:" +
              item.cupon
          );
          console.log(nameFormated, "nameFormated");
          item.name = JSON.parse(nameFormated).name;
          item.type = JSON.parse(nameFormated).type;
          item.realName = JSON.parse(nameFormated).name;
          item.price = JSON.parse(nameFormated).precio;
          item.discount = JSON.parse(nameFormated).discount;
          item.shop = JSON.parse(nameFormated).shop;
          item.cupon = JSON.parse(nameFormated).cupon;
          item.nameforSearchInOtherShop = JSON.parse(nameFormated).nameforSearchInOtherShop;
        }


        if (item.price === null) {
          item.type = "descuento";
          const message = formatMessage(item, item);
          sendMessage("525621530248", message, item.image);
            return
        }

        const finalResults = await compareProducts(item);

        if (finalResults && finalResults.type === "producto") {
          const discount = parseFloat(
            finalResults?.discount?.replace(/[^0-9.-]+/g, "")
          );
          if (finalResults.realDiscount > 35 || discount < -40) {
            sendMail(item);
            const message = formatMessage(item, finalResults);
            sendMessage("525621530248", message, item.image);
          }
        }
        
        if (finalResults && finalResults.type === "descuento") {
          sendMail(item);
          const message = formatMessage(item, finalResults);
          sendMessage("525621530248", message, item.image);
        }
      });
    } else {
    
      console.log("no hay nuevos productos");
    }

    mostRecentItems = content;
    await browser.close();
  } catch (error) {
    console.log(error);
    await browser.close();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return getOffersPD(); // Reintentar la función
  }
};

cron.schedule("*/1 * * * *", () => {
  console.log("Ejecutando tarea periódica...");
  getOffersPD();
});

const compareProducts = async (item) => {
  const product = item.realName;
  const results = await getPrices(product, 2);
  console.log(results, "results");
  const name = item.realName;
  const priceWithDiscount = item?.price? parseFloat(item?.price?.replace(/[^0-9.-]+/g, "")): null;

  const others = results.map((result) => {
    return { name: result.name, price: result.price, shop: result.shop };
  });
  const originalPrice = parseFloat(
    results[0]?.price?.replace(/[^0-9.-]+/g, "")
  );
  const realDiscount =
    ((originalPrice - priceWithDiscount) / originalPrice) * 100;

  return {
    name,
    discount: item.discount,
    priceWithDiscount,
    others,
    originalPrice,
    realDiscount,
    type: item.type,
    shop: item.shop,
    img: item?.image?.replace("300x300", "768x768"),
    cupon: item.cupon,
    path: item.path,
  };
};

const sendMail = async (item) => {
  const to = "esdras4757@gmail.com";
  const title = item.discount + ":" + item.name;
  const content = JSON.stringify(item);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    auth: {
      user: "itodo.services@gmail.com",
      pass: "hailaxkqdhngzfam",
    },
  });

  const mailOptions = {
    from: "itodo@services.com",
    to: to,
    subject: title,
    html: `<h1>${title}</h1> <div>${content}</div>`,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log(error);
  }
};

const checkLowestPrice = (result) => {
  // Asegúrate de convertir precios a números si son cadenas
  const order = result.sort((a, b) => {
    // Convertir los precios a números para una comparación correcta
    const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ""));
    const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ""));

    if (priceA > priceB) {
      return 1;
    }
    if (priceA < priceB) {
      return -1;
    }
    return 0;
  });

  return order;
};

const getPrices = async (answer, resultsPerShop) => {
  const browser = await chromium.launch( { headless: false } );
  const result = [];

  // Usa map y Promise.all para manejar correctamente las promesas
  await Promise.all(
    shops.map(async (shop) => {
      const page = await browser.newPage({ userAgent: "Mozilla/5.0" });
      const info = await shop.getInfo(page, answer);
      result.push(...info.slice(0, resultsPerShop - 1)); // Usa spread operator para agregar elementos al arreglo
      await page.close(); // Asegúrate de cerrar la página después de usarla
    })
  );

    // const page = await browser.newPage();
    // const info = await shops[0].getInfo(page, answer);
    // result.push(...info.slice(0, resultsPerShop - 1)); // Usa spread operator para agregar elementos al arreglo
    // await page.close(); // Asegúrate de cerrar la página después de usarla

  await browser.close();

  const list = checkLowestPrice(result);
  browser.close();
  return list;
};

app.listen(port, () => {});
