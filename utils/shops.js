const shops = [
    {
        vendedor: 'Mercado libre',
        getInfo: async (page, answer) => {
            const path = 'https://listado.mercadolibre.com.mx/' + answer.replace(/ /g, '-');
            await page.goto(path);

            const list = await page.evaluate((path) => {
                return Array.from(document.querySelectorAll('.ui-search-layout__item')).map((item) => ({
                    vendedor: 'Mercado libre',
                    name: item.querySelector('.ui-search-item__title')?.textContent || 'No disponible',
                    price: item.querySelector('.andes-money-amount__fraction')?.textContent || 'No disponible',
                    path: item.querySelector('.ui-search-link')?.href || 'No disponible',
                }));
            }, path); // Pasar el path como argumento

            return list;
        }
    },
    {
        vendedor: 'Amazon',
        getInfo: async (page, answer) => {
            const path = 'https://www.amazon.com.mx/s?k=' + answer.replace(/ /g, '+');
            await page.goto(path);

            const list = await page.$$eval('[data-component-type="s-search-result"]', (items, path) => {
                return items.map((item) => ({
                    vendedor: 'Amazon',
                    name: item.querySelector('.s-title-instructions-style')?.textContent || 'No disponible',
                    price: item.querySelector('.a-price-whole')?.textContent || 'No disponible',
                    path: item.querySelector('.a-link-normal')?.href || 'No disponible',
                }));
            }, path); // Pasar el path como argumento

            return list;
        }
    }
];

export default shops