const { uploadFile } = require('../cloud');
const fs = require('fs');
const path = require('path');

async function uploadVideoFile() {

    const filePath = path.join(__dirname, 'test2.mp4');
    const fileType = 'video/mp4';

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

uploadVideoFile().catch(console.error);
