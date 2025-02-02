require('aws-sdk/lib/maintenance_mode_message').suppress = true; //temp code to block maintenance message
const crypto = require('crypto');
const fs = require('fs'); //file system module
const archiver = require('archiver'); //archiver module
const {PassThrough} = require('stream'); //import passthrough

const {
    pool
} = require('./database');


// import env
require('dotenv').config();


// function to encrypt data using AES
function encryptData(data) {
    const iv = crypto.randomBytes(16); //initialization vector
    // create a cipher instance
    const cipher = crypto.createCipheriv(process.env.AES_ALGORITHM, Buffer.from(process.env.AES_SECRET_KEY), iv);
    // encrypts input data from utf8 to hex
    let encrypted = cipher.update(data, 'utf8', 'hex');
    // completes encryption and appends final data
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

// function to decrypt AES encrypted data
function decryptData(encryptedData){
    // split encryptedData into iv and encryptedText
    const [ivHex, encryptedText] = encryptedData.split(':');
    // create a decipher (decryption instance) to decrypt data using necessary info
    const decipher = crypto.createDecipheriv(process.env.AES_ALGORITHM, Buffer.from(process.env.AES_SECRET_KEY), Buffer.from(ivHex,'hex'));
    // process the encrypted text and start decryption
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    // complete decryption resulting in utf8 string
    decrypted += decipher.final('utf8');
    return decrypted;
}


// Insert file upload data into the database
async function insertFileUpload(ipAddress, fileName, s3Link, fileSize) {
  try {  
      // Hash the sensitive fields
      //const hashedIpAddress = await encryptData(ipAddress);
      //const hashedFileName = await encryptData(fileName);
      //const hashedS3Link = await encryptData(s3Link);

      // no encryption to test for mysql database
      const hashedIpAddress = ipAddress;
      const hashedFileName = fileName;
      const hashedS3Link = s3Link;

      // upload size
      const uploadSize = fileSize;

      // Time fields 
      const currentTime = new Date();
      const expirationTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
      
      // Randomized ID field
      const id = randomKey();

      // Insert the hashed data into the file_uploads table
      const query = 'INSERT INTO file_uploads (id, ip_address, file_name, s3_link, file_size, expiration_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const values = [id, hashedIpAddress, hashedFileName, hashedS3Link, uploadSize, expirationTime, currentTime];

      pool.query(query, values, (err, results) => {
          if (err) {
              console.error('Error inserting data:', err);
              return;
          }
          //console.log('File upload data inserted successfully:', results);
      });
  } catch (error) {
      console.error('Error in insertFileUpload:', error);
  }
}


// Function to create a randomized key for secure presigned urls
const randomKey = () => {
    const rawBytes = crypto.randomBytes(16);
    return rawBytes.toString('hex');
}


// Function to zip/compress files from an array of files
const zipper = async (files) => {
    console.log('Zipping file.')
    const passThrough = new PassThrough(); // use passthrough stream to pass data without manipulating it
    const archive = archiver('zip', { zlib: { level: 9 } }); // format zip and compression settings
  
    // error handling
    archive.on('error', (err) => {
      console.error('Archive Error: ', err.message);
      throw err;
    });
  
    archive.pipe(passThrough); //archive output is piped into passthrough stream
  
    // loop through array
    for (const file of files) {
      //archive.append(file.buffer, { name: file.originalname }); // Append each file buffer to the archive
      const fileStream = fs.createReadStream(file.path); // Create stream from file path
      archive.append(fileStream, {name: file.originalname});
    }
  
    archive.finalize(); //signals the archiver that we are finished adding files and it can finish the zip
    console.log('File successfully zipped.')
    
    return passThrough;
};


// function to get user ip when sending request
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if(forwarded){
        return forwarded.split(',')[0];
    }
    return req.connection.remoteAddress || req.socket.remoteAddress;
}


// function to sanitize titles
function sanitizeFileName(title) {
    return title
        .trim()                            // remove leading/trailing spaces
        .replace(/[^a-zA-Z0-9._-]/g, '_')  // keep only alphanumeric, dots, underscores, and dashes
        .replace(/_{2,}/g, '_')            // replace multiple underscores with a single one
        .slice(0, 255);                    // ensure filename length is within 255 characters
}


// export objects and functions
module.exports = {
    randomKey,
    zipper,
    pool,
    insertFileUpload,
    getClientIp,
    sanitizeFileName
};
