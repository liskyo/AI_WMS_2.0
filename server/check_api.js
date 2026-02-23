const http = require('http');

http.get('http://localhost:3000/api/items?q=ITEM-001', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const items = JSON.parse(data);
            console.log('API Response Items:', items.length);
            if (items.length > 0) {
                console.log('Refreshed Keys:', Object.keys(items[0]));
                console.log('Locations Value:', items[0].locations);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
