// import objects and functions from other files
const {
    randomKey
} = require('./utility');

// import env
require('dotenv').config();

// Require AWS library
const AWS = require('aws-sdk');
require("aws-sdk/lib/maintenance_mode_message").suppress = true; //temp code to block maintenance message

// Configure AWS credentials
AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});




// Create s3 object
const s3 = new AWS.S3();


// function to generate a presigned URL using AWS SDK
const generatePresignedURL = async(fileName, fileType) => {
    const extension = fileName.substring(fileName.lastIndexOf('.')); // Extract file extension
    const baseName = fileName.substring(0,fileName.lastIndexOf('.')); // Extract file name
    const uniqueFileName = `${baseName}-${randomKey()}${extension}`; // Generate unique file name

    const params = {
        Bucket: process.env.S3_BUCKET_NAME, //s3 bucket name
        Key: uniqueFileName, // name of file
        Expires: 300, // expiration time of URL after generation
        ContentType: fileType //file type
    }
    try {
        const url = await s3.getSignedUrlPromise('putObject', params);
        //console.log("Generated presigned URL:", url);
        return url;
    } catch (error) { // error handling
        console.error("AWS error generating presigned URL:", error);
        throw error;
    }
};



// Upload functions

const fs = require('fs'); // for file system interactions
const fetch = require('node-fetch'); // for making http requests in nodejs

// Upload function.
// Takes in a readable stream for the file being uploaded, the file name, and file type
const uploadFile = async (readStream, fileName, fileType) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Fallback for development

    // Request presigned URL from the server
    const response = await fetch(`${baseUrl}/generate-presigned-url?fileName=${fileName}&fileType=${fileType}`);
    if (!response.ok) {
        throw new Error(`Failed to get presigned URL: ${response.statusText}`);
    }
    // extract presigned url from server response
    const { url } = await response.json();

    console.log(`Uploading ${fileName} with type ${fileType}...`);

    // use fs to obtain file size from the readStream's path property
    // S3 requires the exact content length.
    const fileStats = fs.statSync(readStream.path);
    const fileSize = fileStats.size;

    // Use the presigned URL to upload the file
    const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': fileType || 'application/octet-stream', // Ensure MIME type is correct, defaults to generic type
            'Content-Length': fileSize,
        },
        body: readStream, // Pass the readable stream directly as the body
        duplex: 'half', // Required for streaming body in Node.js fetch
    });

    // error handling
    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed:', uploadResponse.status, errorText);
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
    }

    // success
    console.log(`${fileName} uploaded successfully with type ${fileType}`);
};




// export objects and functions
module.exports = {
    s3, 
    generatePresignedURL,
    uploadFile
};