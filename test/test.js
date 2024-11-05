const { uploadFile } = require('../cloud');
const fs = require('fs');
const path = require('path');

async function uploadTxtFile() {
    
    const filePath = path.join(__dirname, 'test.txt');
    const fileType = 'text/plain';

    // Get the file size using fs.statSync
    const fileSize = fs.statSync(filePath).size;

    // Create a read stream
    const fileStream = fs.createReadStream(filePath);

    // Create a file object with the stream, name, type, and size for uploadFile
    const file = {
        name: path.basename(filePath),
        type: fileType,
        size: fileSize,
        stream: fileStream,
    };

    try {
        // Upload the file to S3
        await uploadFile(file);
    } catch (error) {
        console.error('Video upload failed:', error);
    }
}

uploadTxtFile().catch(console.error);
