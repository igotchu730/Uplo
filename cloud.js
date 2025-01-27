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
const setPartSize = 64;

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
    console.log('Generated presigned URL')


    console.log(`Uploading ${fileName}...`);

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
    console.log(`${fileName} uploaded successfully`);
};


// Multipart upload function.
// Takes in a readable stream for the file being uploaded, the file name, and file type
const uploadFileMultiPart = async (readStream, fileName, fileType) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Fallback for development

    // preserve original file name just in case
    const origName = fileName;

    // retrieve file size of uploaded file
    const fileStats = fs.statSync(readStream.path);
    const fileSize = fileStats.size;

    // rename file name to standardized file name for clean storage
    const extension = fileName.substring(fileName.lastIndexOf('.')); // Extract file extension
    const baseName = fileName.substring(0,fileName.lastIndexOf('.')); // Extract file name
    const uniqueFileName = `${baseName}-${randomKey()}${extension}`; // Generate unique file name
    fileName = uniqueFileName;

    // Request presigned URL
    const response = await fetch(`${baseUrl}/initiate-multipart-upload`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            fileName,
            fileType,
            fileSize
        }),
    });
    if (!response.ok) {
        throw new Error(`Failed to get presigned URL: ${response.statusText}`);
    }

    // Retrieve response
    const {uploadId, parts} = await response.json();
      

    console.log(`Initiated multipart upload for ${fileName}.`);

    const etags = []; // Initializer array top store etags (part numbers)
    const chunkSize = setPartSize * 1024 * 1024; // Size for each part is 64 mb
    let partNumber = 1; //initilize number of parts
    // create read stream to the file at the given path.
    // Highwatermark controls the amount of data read at a time.
    const stream = fs.createReadStream(readStream.path, {highWaterMark:chunkSize});

    // Upload the file stream by chunks
    for await (const chunk of stream){
    
        console.log(`Uploading part ${partNumber}`);
        const uploadResponse = await fetch(parts[partNumber - 1], {
            method: 'PUT',
            headers: {
                'Content-Length': chunk.length,
            },
            body: chunk,
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`Failed to upload part ${partNumber}:`, errorText);
            throw new Error(`Failed to upload part ${partNumber}: ${errorText}`);
        };

        // Update etag array
        const eTag = uploadResponse.headers.get('Etag');
        etags.push({PartNumber: partNumber, ETag: eTag});


        console.log(`Part ${partNumber} uploaded successfully.`);
        partNumber++; // iterate
    };

    // Complete the multipart upload
    const completeResponse = await fetch(`${baseUrl}/complete-multipart-upload`,{
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            uploadId,
            fileName,
            parts: etags,
        }),
    });
    if (!completeResponse.ok) {
        throw new Error(`Failed to complete multipart upload: ${completeResponse.statusText}`);
    };

    console.log(`${origName} uploaded successfully using multipart upload.`);
}



// export objects and functions
module.exports = {
    s3, 
    generatePresignedURL,
    uploadFile,
    uploadFileMultiPart,
    setPartSize
};