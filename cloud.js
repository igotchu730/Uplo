const axios = require('axios');
const fs = require('fs'); // for file system interactions
const fetch = require('node-fetch'); // for making http requests in nodejs
const cron = require('node-cron'); // for automatically running code from server

//database pool
const {
    poolPromise
} = require('./database');


// import objects and functions from other files
const {
    randomKey,
    progressEmitter,
    trackReadProgress,
    decryptData
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
    const params = {
        Bucket: process.env.S3_BUCKET_NAME, //s3 bucket name
        Key: fileName, // name of file
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

// function to generate a presigned URL for viewing objects in s3 using AWS SDK
const generatePresignedURLView = async(fileKey) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME, //s3 bucket name
        Key: fileKey, // name of file
        Expires: 86400, // expiration time of URL after generation (24hrs)
        ResponseContentDisposition: `attachment; filename="${fileKey}"`, // force download when s3 link is visted
    }
    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        //console.log("Generated presigned URL:", url);
        return url;
    } catch (error) { // error handling
        console.error("AWS error generating presigned URL:", error);
        throw error;
    }
};

// function to generate a presigned URL for viewing objects in s3 using AWS SDK,no auto download
const generatePresignedURLViewNoDownload = async(fileKey) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME, //s3 bucket name
        Key: fileKey, // name of file
        Expires: 86400, // expiration time of URL after generation (24hrs)
    }
    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        //console.log("Generated presigned URL:", url);
        return url;
    } catch (error) { // error handling
        console.error("AWS error generating presigned URL:", error);
        throw error;
    }
};


// Upload functions

const setPartSize = 64;
const maxUploadSize = 2 * 1024 * 1024 * 1024; // 2GB limit

// Upload function.
// Takes in a readable stream for the file being uploaded, the file name, and file type
const uploadFile = async (readStream, fileName, fileType) => {

    // reset progress tracking
    readProgress = 0;
    uploadProgress = 0;

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

    // call trackReadProgress from utility to track read progress
    const trackedReadStream = trackReadProgress(readStream.path);

    // upload file using Axios with upload progress tracking
    // use axios.put to upload file to s3 link
    await axios.put(url, trackedReadStream, {
        headers: {
            'Content-Type': fileType || 'application/octet-stream', // Ensure MIME type is correct, defaults to generic type
            'Content-Length': fileSize
        },
        // prevent axios from size limits
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        //track progress using axios
        onUploadProgress: (progressEvent) => {
            trackUploadProgress(progressEvent.loaded, fileSize);
        }
    });

    // success
    console.log(`${fileName} uploaded successfully`);
};

// Multipart upload function.
// Takes in a readable stream for the file being uploaded, the file name, and file type
const uploadFileMultiPart = async (readStream, fileName, fileType) => {

    // reset progress tracking
    readProgress = 0;
    uploadProgress = 0;

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Fallback for development

    // preserve original file name just in case
    const origName = fileName;

    // retrieve file size of uploaded file
    const fileStats = fs.statSync(readStream.path);
    const fileSize = fileStats.size;

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

    //track progress
    let uploadedBytes = 0;

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

        // report progress
        uploadedBytes += chunk.length;
        trackUploadProgress(uploadedBytes, fileSize);

        // success
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


// tracks percent of file read
let readProgress = 0;
// tracks percent of file uploaded
let uploadProgress = 0;
// tracks last logged for overall progress
let lastLoggedOverallProgress = 0;

// listen for readprogress event from trackReadProgress function
progressEmitter.on('readProgress', (progress) => {
    // update readProgress with emitted percentage
    readProgress = parseFloat(progress);
    // update overall progress
    updateOverallProgress();
});

// takes in uploaded bytes and  total file size...
const trackUploadProgress = (uploadedBytes, totalBytes) => {
    // calulate percent progress
    uploadProgress = ((uploadedBytes/totalBytes)*100).toFixed(2);
    // emit uploadProgress
    //progressEmitter.emit('uploadProgress',uploadProgress);
    // update overall progress
    updateOverallProgress();
};

/*// calculates overall progress by taking the average of readProgress and uploadProgress
const updateOverallProgress = () => {
    const overallProgress = ((parseFloat(readProgress) + parseFloat(uploadProgress)) / 2).toFixed(2); //calculate
    console.log(`Overall Progress: ${overallProgress}%`); // log progress
    // update overall progress
    progressEmitter.emit('overallProgress', overallProgress);
};*/
const updateOverallProgress = () => {
    const overall = (
        0.4 * parseFloat(readProgress) +
        0.6 * parseFloat(uploadProgress)
    ).toFixed(2);
    progressEmitter.emit('overallProgress', overall);
};



// function to delete file directly from S3
async function deleteFileFromS3(fileKey) {

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey
    };

    try {
        await s3.deleteObject(params).promise();
        console.log(`Deleted from S3: ${fileKey}`);
        return true;
    } catch (err) {
        console.error(`Failed to delete from S3: ${fileKey}`, err);
        return false;
    }
}

// function to find expired files and delete them
async function deleteExpiredFiles(){
    if (!poolPromise) {
        console.error("Database pool is not initialized.");
        return;
    }
    const connection = await poolPromise.getConnection();
    try{
        
        // find expired files in mysql database
        const [rows] = await connection.execute(`
            SELECT id, file_name FROM file_uploads WHERE expiration_date < NOW()
        `);
        if(rows.length === 0){
            console.log('No expired files found for deletion.')
            return;
        };
        

        // loop through returned rows and delete file from s3 and delte entry from mysql database
        for(const file of rows){
            //decrypt file name
            const decryptedFileKey = decryptData(file.file_name);

            // delete from s3
            const deleted = await deleteFileFromS3(decryptedFileKey);

            // delete from mysql
            if (deleted) {
                await connection.execute(`DELETE FROM file_uploads WHERE id = ?`, [file.id]);
                console.log(`Deleted from MySQL: ${decryptedFileKey}`);
            }
        };
    }catch(dbError){
        console.error('Database query failed:', dbError);
    };
};

// automatically delete expired files every hour
cron.schedule('0 * * * *', () => {
    console.log("Running hourly cleanup job...");
    deleteExpiredFiles();
});



// export objects and functions
module.exports = {
    s3, 
    generatePresignedURL,
    uploadFile,
    uploadFileMultiPart,
    setPartSize,
    maxUploadSize,
    generatePresignedURLView,
    generatePresignedURLViewNoDownload
};