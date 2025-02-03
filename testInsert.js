require('aws-sdk/lib/maintenance_mode_message').suppress = true; //temp code to block maintenance message
const {insertFileUpload, randomKey} = require('./utility.js');

(async () => {
    const ipAddress = '192.168.1.1';
    const fileName = 'example.txt';
    const s3Link = 'https://s3.amazonaws.com/example.txt';
    const id = randomKey();
    const fileSize = 10000;

    try {
        console.log('Attempting to insert...');
        await insertFileUpload(id, ipAddress, fileName, s3Link, fileSize);
        console.log('Insert successful.');
    } catch (err) {
        console.error('Error inserting file upload:', err);
    }
})();