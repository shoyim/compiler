const { db } = require('./api/config');
const { options } = require('./config');

async function seed() {
    for (const [key, opt] of Object.entries(options)) {
        await db.query(
            `INSERT INTO config_settings (\`key\`, \`value\`, \`description\`) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             \`value\` = VALUES(\`value\`), 
             \`description\` = VALUES(\`description\`)`,
            [key, String(opt.default), opt.desc || '']
        );
    }
    console.log('Config settings seeded');
    process.exit();
}
seed();