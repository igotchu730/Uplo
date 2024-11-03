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
    const params = {
        Bucket: process.env.S3_BUCKET_NAME, //s3 bucket name
        Key: fileName, // name of file
        Expires: 60, // expiration time of URL after generation
        ContentType: fileType //file type
    }
    try {
        return await s3.getSignedUrlPromise('putObject', params); // function from aws sdk to generate url
    } catch (error) {
        console.error("AWS error generating presigned URL:", error);
        throw error;
    }
}

// function that handles uploading file from client side
async function uploadFile(file){
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Fallback for development
    const response = await fetch(`${baseUrl}/generate-presigned-url?fileName=${file.name}&fileType=${file.type}`); //make get request to endpoint with query params, save the response
    const { url } = await response.json(); // retrieve presigned url from the response

    await fetch(url, { // send put request to presigned url to upload to s3
        method: 'PUT',
        headers:{
            'Content-Type': file.type, // indicate MIME type
        },
        body: file, //the file to be uploaded
    });

    console.log('File uploaded successfully');
}





// export objects and functions
module.exports = {
    s3, 
    generatePresignedURL,
    uploadFile
};