require('aws-sdk/lib/maintenance_mode_message').suppress = true; //temp code to block maintenance message
const crypto = require('crypto');
const fs = require('fs'); //file system module
const archiver = require('archiver'); //archiver module
const {PassThrough} = require('stream'); //import passthrough
const {DateTime} = require('luxon'); //for setting time
const EventEmitter = require('events')

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
async function insertFileUpload(id, ipAddress, fileName, pageLink, s3Link, fileSize) {
  try {  
      // Hash the sensitive fields
      const encryptedIpAddress = await encryptData(ipAddress);
      const encryptedFileName = await encryptData(fileName);
      const encryptedS3Link = await encryptData(s3Link);
      const encryptedPageLink = await encryptData(pageLink);

      // no encryption to test for mysql database, remove later
      //const encryptedIpAddress = ipAddress;
      //const encryptedFileName = fileName;
      //const encryptedS3Link = s3Link;
      //const encryptedPageLink = pageLink;

      // upload size
      const uploadSize = fileSize;

      // Time fields 
      // Get current time in UTC, and adjust format for mysql
      const currentTime = DateTime.now().setZone('America/Los_Angeles').toSQL({ includeOffset: false });
      // Expiration time (set to 24 hours later), and adjust format for mysql
      const expirationTime = DateTime.now().setZone('America/Los_Angeles').plus({ hours: 24 }).toSQL({ includeOffset: false });

      // Insert the hashed data into the file_uploads table
      const query = 'INSERT INTO file_uploads (id, ip_address, ip_hash, file_name, page_link, s3_link, file_size, expiration_date, created_at) VALUES (?, ?, SHA2(?, 256), ?, ?, ?, ?, ?, ?)';
      const values = [id, encryptedIpAddress,ipAddress, encryptedFileName, encryptedPageLink, encryptedS3Link, uploadSize, expirationTime, currentTime];

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

// Insert file upload data into the database at given id
async function updateS3Link(id, data) {
    try { 
        // Make sure id is present in parameters
        if (!id) {
            return reject(new Error('ID parameter is missing.'));
        }

        // Hash the sensitive fields
        const hashedData = await encryptData(data);
  
        // no encryption to test for mysql database, remove later
        //const hashedData = data;
  
        // Insert the hashed data into the file_uploads table
        const query = `UPDATE file_uploads SET s3_link = ? WHERE id = ?`;
        const values = [hashedData,id];

        pool.query(query, values, (err, results) => {
            if (err) {
                console.error('Error updating s3 link:', err);
                return;
            }
            if (results.affectedRows === 0) {
                console.error(`No matching id found: ${id}`);
                return;
            }
            //console.log('S3 link updated successfully.');
        });
    } catch (error) {
        console.error('Error in updateS3Link:', error);
    }
}

// function to delete file upload data from database with corresponding id
async function deleteFileUpload(id) {
    return new Promise((resolve, reject) => {
        // Insert the hashed data into the file_uploads table
        const query = 'DELETE FROM file_uploads WHERE id = ?';

        // Make sure id is present in parameters
        if (!id) {
            return reject(new Error('ID parameter is missing.'));
        }

        // send query
        pool.query(query, [id], (err, results) => {
            // error handling
            if (err) {
                console.error('Error deleting file upload:', err);
                return reject(err);
            }
            if (results.affectedRows === 0) {
                return reject(new Error(`No data found with id: ${id}`));
            }
            // success
            console.log(`File upload with id: ${id}, deleted successfully.`);
            resolve({ message: `File upload with id: ${id}, deleted successfully.` });
        });
    });
}

// function to retrieve file upload data from database with corresponding id
async function retrieveFileUploadData(id, field) {
    return new Promise((resolve, reject) => {

        // Define allowed fields to prevent SQL injection
        const allowedFields = ['ip_address', 'ip_hash', 'file_name', 'page_link', 's3_link', 'file_size', 'expiration_date', 'created_at'];

        // Validate the field input
        if (!allowedFields.includes(field)) {
            return reject(new Error(`Invalid field requested: ${field}`));
        }

        // Make sure id is present in parameters
        if (!id) {
            return reject(new Error('ID parameter is missing.'));
        }

        // Insert the hashed data into the file_uploads table
        const query = `SELECT ?? FROM file_uploads WHERE id = ?`;

        // send query
        pool.query(query, [field,id], (err, results) => {
            // error handling
            if (err) {
                console.error('Error retrieving file upload data:', err);
                return reject(err);
            }
            // check if any data is retrieved
            if (results.length === 0){
                return reject(new Error(`No data found with id: ${id}`));
            }
            // success
            // console.log(`File upload data with id: ${id}, retrieved successfully.`);
            // retrieve from the results array, the requested field
            resolve(results[0][field]);
        });
    }).then(data => { // 
        // return data
        //data = decryptData(data); //testing decryption
        //console.log(`${field} retrieved:`, data);
        return data;
    });
}

async function checkIpCount(ipAddress) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT COUNT(*) AS count FROM file_uploads WHERE ip_hash = SHA2(?, 256)';

        pool.query(query, [ipAddress], (err, results) => {
            if (err) {
                console.error('Error checking IP count:', err);
                return reject(err);
            }
            const count = results[0].count;
            resolve(count);
        });
    }); 
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
    const forwarded = req.headers['x-forwarded-for']; // get client ip from reverse proxy
    if(forwarded){
        return forwarded.split(',')[0]; //retrieve the first ip returned. That's the client's ip
    }
    return req.connection.remoteAddress || req.socket.remoteAddress; //fallbacks
}


// function to sanitize titles
function sanitizeFileName(title) {
    return title
        .trim()                            // remove leading/trailing spaces
        .replace(/[^a-zA-Z0-9._-]/g, '_')  // keep only alphanumeric, dots, underscores, and dashes
        .replace(/_{2,}/g, '_')            // replace multiple underscores with a single one
        .slice(0, 255);                    // ensure filename length is within 255 characters
}

// function to generate correct html based on retrieved file type
const generateFileEmbed = (fileExtension, url) => {
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExtension)) {
        return `<video controls id="video">
                    <source src="${url}" type="video/${fileExtension}">
                    Your browser does not support video.
                </video>`;
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(fileExtension)) {
        return `<div id="audio">
                    <div id="audioScreen">
                        <img src="/assets/audioBG.png" id="audioBG"/>
                        <img src="/assets/playIcon2.png" id="audioPausePlay"/>
                    </div>
                    <audio controls id="audioControl">
                        <source src="${url}" type="audio/${fileExtension}">
                        Your browser does not support audio.
                    </audio>
                </div>`;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(fileExtension)) {
        return `<img src="${url}" alt="Image Preview" width="600"/>`;
    }
    if (['pdf'].includes(fileExtension)) {
        return `<iframe src="${url}" width="600" height="800"></iframe>`;
    }
    if (['txt', 'md'].includes(fileExtension)) {
        return `<pre style="width: 600px; overflow: auto; border: 1px solid #ddd; padding: 10px;"><code>Fetching file...</code></pre>
                <script>
                    fetch("${url}")
                        .then(response => response.text())
                        .then(text => document.querySelector("pre code").textContent = text)
                        .catch(err => console.error("Error loading file:", err));
                </script>`;
    }
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)) {
        return `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}" width="600" height="800"></iframe>
                <p><a href="${url}" target="_blank">Open in Microsoft Office</a></p>`;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
        return `<p>Compressed file detected. <a href="${url}" download>Download File</a></p>`;
    }
    return `<p>File preview is not available. <a href="${url}" download>Download File</a></p>`;
};


// create new event emitter
const progressEmitter = new EventEmitter();
const trackReadProgress = (filePath) => {
    // create read stream to the filepath
    const readStream = fs.createReadStream(filePath);
    let totalBytesRead = 0; // keeps track of the number of bytes read so far
    const fileSize = fs.statSync(filePath).size; // get file size
    let lastLoggedProgress = 0; // stores the last logged progress

    // when data chunks are read from stream...
    readStream.on('data',(chunk) =>{
        totalBytesRead += chunk.length; // update how many bytes have been read
        const readProgress = ((totalBytesRead/fileSize)*100).toFixed(2); // calculate percentage
        // update progress every 5%
        if(readProgress - lastLoggedProgress >= 5){
            //console.log(`Reading progress: ${readProgress}`);
            progressEmitter.emit('readProgress', readProgress); // emit readProgress
            lastLoggedProgress = readProgress;
        }
    });
    // on success
    readStream.on('end', () => {
        //console.log('Read stream completed.');
        progressEmitter.emit('readProgress',100)
    });
    // error handling
    readStream.on('error', (err) => {
        console.error('Read stream error:', err);
        progressEmitter.emit('readError', err);
    });
    return readStream;
}



// export objects and functions
module.exports = {
    randomKey,
    zipper,
    pool,
    insertFileUpload,
    getClientIp,
    sanitizeFileName,
    deleteFileUpload,
    retrieveFileUploadData,
    generateFileEmbed,
    updateS3Link,
    decryptData,
    progressEmitter,
    trackReadProgress,
    checkIpCount
};
