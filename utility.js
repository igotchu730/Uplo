const crypto = require('crypto');
const fs = require('fs'); //file system module
const archiver = require('archiver'); //archiver module
const {PassThrough} = require('stream'); //import passthrough

const {
    pool
} = require('./database');
const mysql = require('mysql2');
const bcrypt = require('bcrypt'); // bcrypt included



// Bcrypting database user info
//Code for bcrypt
const saltRounds = 10;

// Function to hash sensitve data before storing it
async function hashSensitiveData(data) {
  try {
      const saltRounds = 10;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedData = await bcrypt.hash(data, salt);
      return hashedData;
  } catch (error) {
      console.error('Error hashing data:', error);
      throw error;
  }
}


// Insert file upload data into the database
async function insertFileUpload(ipAddress, fileName, s3Link) {
  try {  

      // Hash the sensitive fields
      const hashedIpAddress = await hashSensitiveData(ipAddress);
      const hashedFileName = await hashSensitiveData(fileName);
      const hashedS3Link = await hashSensitiveData(s3Link);

      // Time fields 
      const currentTime = new Date();
      const expirationTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
      
      // Randomized ID field
      const id = randomKey();

      // Insert the hashed data into the file_uploads table
      const query = 'INSERT INTO file_uploads (id, ip_address, file_name, s3_link, expiration_date, created_at) VALUES (?, ?, ?, ?, ?, ?)';
      const values = [id, hashedIpAddress, hashedFileName, hashedS3Link, expirationTime, currentTime];

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


// export objects and functions
module.exports = {
    randomKey,
    zipper,
    pool,
    insertFileUpload
};