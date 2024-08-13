import express from 'express'
import playwriting from "playwright"
import { chromium } from "playwright"
import readline from "readline"
import cron from 'node-cron';
import nodemailer from 'nodemailer'
let mostRecentItems=[]

const shops = [
    {
        shop: 'Mercado libre',
        getInfo: async (page, answer) => {
            const path = 'https://listado.mercadolibre.com.mx/' + answer.replace(/ /g, '-');
            await page.goto(path);

            const list = await page.evaluate((path) => {
                return Array.from(document.querySelectorAll('.ui-search-layout__item')).map((item) => ({
                    shop: 'Mercado libre',
                    name: item.querySelector('.ui-search-item__title')?.textContent || 'No disponible',
                    price: item.querySelector('.andes-money-amount__fraction')?.textContent || 'No disponible',
                    path: item.querySelector('.ui-search-link')?.href || 'No disponible',
                }));
            }, path); // Pasar el path como argumento

            return list;
        }
    },
    {
        shop: 'Amazon',
        getInfo: async (page, answer) => {
            const path = 'https://www.amazon.com.mx/s?k=' + answer.replace(/ /g, '+');
            await page.goto(path);

            const list = await page.$$eval('[data-component-type="s-search-result"]', (items, path) => {

                return items.map((item) => ({
                    shop: 'Amazon',
                    name: item.querySelector('.s-title-instructions-style')?.textContent || 'No disponible',
                    price: item.querySelector('.a-price-whole')?.textContent || 'No disponible',
                    path: item.querySelector('.a-link-normal')?.href || 'No disponible',
                }));
            }, path); // Pasar el path como argumento

            return list;
        }
    }
];

const app= express()
const port = 5001

app.get('/getProducts',async(req,res)=>{
    const producto='ryzen 5 5600x'
    const list = await getPrices(producto, 5)
    res.send(list)
})


const getOffersPD=async()=>{
    const browser = await chromium.launch();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    });
    const page = await context.newPage();
    await page.goto('https://www.promodescuentos.com/nuevas');
    page.screenshot({path:'ss.png'})
    const content = await page.$$eval('.cept-thread-item', (items)=>{
            return items.slice(0,5).map((item)=>{
                return {
                    id:item.id,
                    name:item.querySelector('.thread-title')?.textContent || 'no disponible',
                    discount:item.querySelector('.size--fromW3-xl.text--color-charcoal')?.textContent || 'no disponible',
                    price :item.querySelector('.threadItemCard-price')?.textContent || 'no disponible',
                    realName:item.querySelector('.thread-title')?.textContent.split(':')[1] || 'no disponible',
                    shop: item.querySelector('.thread-title')?.textContent.includes(':')?item.querySelector('.thread-title')?.textContent.split(':')[0]: 'no disponible',
                }
            })
           
    })
    
    const idsInMostRecentItems = new Set(mostRecentItems.map(item => item.id));
    const filteredContent = content.filter(item => !idsInMostRecentItems.has(item.id));
    if(filteredContent && filteredContent.length>0){

        
    }
    else{
        console.log('no hay nuevos productos')
    }

    console.log(filteredContent)

        filteredContent.forEach(async(item)=>{
            compareProducts(item)
            if (item.discount) {
                const discountPercentaje=parseFloat(item.discount.replace(/[^0-9.-]+/g, ''));
                if (discountPercentaje<-30) {
                    // sendMail(item)
                }
            }
        })

    mostRecentItems= content

}

cron.schedule('* * * * *', () => {
    console.log('Ejecutando tarea periódica...');
    getOffersPD()
  });

const compareProducts=async(item)=>{
    const product = item.realName
    const results= await getPrices(product,2)
    const name= item.realName
    const priceWithDiscount=item.price
    const realPrices=results.map(result=>{
        return{ name:result.name,price:result.price}
     })
     const originalPrice=results[0].price
    const realDiscount = ((originalPrice - priceWithDiscount) / originalPrice) * 100;

    console.log({
        name,
        priceWithDiscount,
        realPrices,
        realDiscount
    })
}

const sendMail=async(item)=>{
    const to= 'esdras4757@gmail.com';
    const title = item.discount + ':' + item.name;
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
    console.log(error)
    }
}


const checkLowestPrice = (result) => {
    // Asegúrate de convertir precios a números si son cadenas
    const order = result.sort((a, b) => {
        // Convertir los precios a números para una comparación correcta
        const priceA = parseFloat(a.price.replace(/[^0-9.-]+/g, ''));
        const priceB = parseFloat(b.price.replace(/[^0-9.-]+/g, ''));

        if (priceA > priceB) {
            return 1;
        }
        if (priceA < priceB) {
            return -1;
        }
        return 0;
    });

    return order
};

const getPrices = async (answer,resultsPerShop) => {
    const browser = await chromium.launch();
    const result = [];

    // Usa map y Promise.all para manejar correctamente las promesas
    await Promise.all(shops.map(async (shop) => {
        const page = await browser.newPage();
        const info = await shop.getInfo(page, answer);
        result.push(...info.slice(0, resultsPerShop-1)); // Usa spread operator para agregar elementos al arreglo
        await page.close(); // Asegúrate de cerrar la página después de usarla
    }));

    await browser.close();


   const list = checkLowestPrice(result)
   browser.close()
   return list
};

app.listen(port, () => {
   
})


// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });
  
//   rl.question('Ingresa un producto para buscar?', (answer) => {
//     getPrices(answer)
//     rl.close();
//   });