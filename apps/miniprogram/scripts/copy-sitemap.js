const fs = require('fs');
fs.copyFileSync('sitemap.json', 'dist/sitemap.json');
console.log('Copied sitemap.json to dist/');
