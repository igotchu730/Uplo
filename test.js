const { uploadFile } = require('./cloud');
const fs = require('fs');
const path = require('path');

async function testUploadFile() {
    // Define the test file path
    const filePath = path.join(__dirname, 'test.txt'); // Replace with your test file name
    const fileType = 'text/plain'; // Adjust based on your file type

    // Read the test file
    const fileData = fs.readFileSync(filePath);

    // Create a File-like object to pass to uploadFile function
    const file = {
        name: path.basename(filePath),
        type: fileType,
        size: fileData.length,
        slice: (start, end) => fileData.slice(start, end),
    };

    try {
        // Call the uploadFile function with the test file
        await uploadFile(file);
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

testUploadFile().catch(console.error);
