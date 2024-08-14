import express, { json } from 'express'
import playwriting from "playwright"
import { chromium } from "playwright"
import readline from "readline"
import cron from 'node-cron';
import nodemailer from 'nodemailer'
import chatgptMessage from './utils/chatGpt.js';

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
                    shop: item.querySelector('.thread-title')?.textContent.includes(':')?item.querySelector('.thread-title')?.textContent.split(':')[0]: 'no disponible',
                    cupon :item.querySelector('[data-t="copyVoucherCode"]')?.value || 'no disponible',
                }
            })
           
    })
    
    const idsInMostRecentItems = new Set(mostRecentItems.map(item => item.id));
    const filteredContent = content.filter(item => !idsInMostRecentItems.has(item.id));
    if(filteredContent && filteredContent.length>0){
        filteredContent.forEach(async(item)=>{

            if (item.price === 'no disponible' || item.cupon !== 'no disponible') {
                item.type='descuento'
                item.realName = item.name
            }

            let nameFormated = {name:item.name,type:'descuento'}
            if (item.type!=='descuento') {
                nameFormated= await chatgptMessage(item.name)
                item.realName = JSON.parse(nameFormated).name
                item.type = JSON.parse(nameFormated).type
            }
            
            const finalResults= await compareProducts(item)

            if (finalResults && finalResults.type==='producto') {
                const discount=parseFloat(finalResults.discount.replace(/[^0-9.-]+/g, ''));
                if (finalResults.realDiscount>35 || discount<-50) {
                    sendMail(item)
                }
            }
            if (finalResults && finalResults.type==='descuento') {
                    sendMail(item)
            }
        })
        
    }
    else{
        console.log('no hay nuevos productos')
    }

       

    mostRecentItems= content

}

cron.schedule('*/5 * * * *', () => {
    console.log('Ejecutando tarea periódica...');
    getOffersPD()
  });

const compareProducts=async(item)=>{
    const product = item.realName
    const results= await getPrices(product,2)
    const name= item.realName
    const priceWithDiscount=parseFloat(item.price.replace(/[^0-9.-]+/g, ''))
    const others=results.map(result=>{
        return{ name:result.name,price:result.price,shop:result.shop}
     })
     const originalPrice = parseFloat(results[0].price.replace(/[^0-9.-]+/g, ''))
    const realDiscount = ((originalPrice - priceWithDiscount) / originalPrice) * 100;

   return{
        name,
        discount: item.discount,
        priceWithDiscount,
        others,
        originalPrice,
        realDiscount,
        type: item.type
    }
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