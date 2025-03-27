const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);


// import env
require('dotenv').config();

// import objects and functions from other files
const {
  generatePresignedURL,
  uploadFile,
  s3,
  uploadFileMultiPart,
  setPartSize,
  maxUploadSize,
  generatePresignedURLView,
  generatePresignedURLViewNoDownload,
} = require('./cloud');
const {
  zipper,
  randomKey,
  insertFileUpload,
  getClientIp,
  sanitizeFileName,
  retrieveFileUploadData,
  generateFileEmbed,
  updateS3Link,
  decryptData,
  trackReadProgress,
  progressEmitter,
  checkIpCount,
} = require('./utility');

const PORT = process.env.PORT;
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const genericImg = `${baseUrl}/assets/testImg.png`;

// listen for overallProgress events and use socket to emit progress to connected clients
// basically redirecting the progress to the front end
progressEmitter.on('overallProgress', (progress) => {
    io.emit('overallProgress', progress);
});

// allow for reverse proxy
app.set('trust proxy', true);

// Serve static files from the "mainpage" directory and "assets" folder
app.use(express.static(path.join(__dirname, 'mainpage')));
app.use('/assets',express.static(path.join(__dirname,'assets')));

// serve files from public directory
app.use(express.static(path.join(__dirname, '')));


// Middleware
app.use(express.json());

// mount router to app
app.use(router);

// Serve index.html on the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mainpage', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


// Endpoint that takes get requests to create presigned urls for upload to s3. Returns json response with presigned url.
 app.get('/generate-presigned-url', async (req,res) => { // defines get request to endpoint
  const{ fileName, fileType } = req.query; // retrieves query parameters from request URL

  try{
    const url = await generatePresignedURL(fileName, fileType); //call function to create a presigned url
    res.status(200).json({ url }); //if successful, respond with 200 status and a json response containing the url
  }catch (error){ // error handling
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Error generating presigned URL' })
  };
});


// Custom storage to handle files as streams
const storage = multer.diskStorage({
    // directory where uploaded files will be stored.
    destination: (req, file, cb) => { // req is request object, file is file object, cb is callback to signal completion
        const uploadDir = path.join(__dirname, 'uploads'); //path of uploads folder
        if(!fs.existsSync(uploadDir)){ //check if uploads folder exists, if not create one
            fs.mkdirSync(uploadDir, {recursive: true});
        }
        cb(null, uploadDir); //callback
    },
});

// Initalize multer with custom storage
const upload = multer({storage});

// http post endppint
app.post('/upload', upload.array('files'), async (req,res) => {

    // retrieve user ip and check if they have surpassed daily limit
    const userIp = getClientIp(req);
    const IPCount = await checkIpCount(userIp);
    console.log('IP Count: ', IPCount);
    if(IPCount >= 3){
        if (req.files) { //delete file before returning
            req.files.forEach(file => {
                const filePath = path.join(__dirname, 'uploads', file.filename);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Error deleting file ${file.filename}:`, err);
                    else console.log(`Deleted file ${file.filename} due to upload limit.`);
                });
            });
        } //return user to home page and send alert 
        return res.status(400).send(`
            <html>
                <body>
                    <script>
                        alert("Daily limit of 3 uploads per user.");
                        window.history.back();
                    </script>
                </body>
            </html>
        `);
    };

    // retrieve user inputed title for upload
    let title = req.body.uploadTitle;
    //console.log('Uploaded Title:', title);

    // retrieve uploaded file's metadata
    const uploadedFiles = req.files;
    const multiThreshold = 100 *1024 * 1024;

    // check if the file uploaded or not, send error if not.
    if(!uploadedFiles || uploadedFiles.length === 0){
        return res.status(400).send('No file uploaded');
    };

    // if a single file is uploaded...
    if(uploadedFiles.length === 1){
        try{
            // iterate through array of uploaded files
            for(const file of uploadedFiles){
                
                // create file path to uploads folder for temp storage and define metadata values
                const filePath = path.join(__dirname, 'uploads', file.filename);
                const fileName = `${file.originalname}`;
                const fileType = file.mimetype;

                // reject if file size is above limit
                if (file.size > maxUploadSize) {
                    // delete the file temporarily stored in disk
                    fs.unlink(filePath, (err) =>{
                        if(err) console.error(`Error deleting file ${file.originalname} from disk.`, err);
                        else console.log(`${file.originalname} deleted from disk after upload.`);
                    });
                    return res.status(400).send(`Error: File ${file.originalname} exceeds 2GB limit.`);
                }

                // if user title is empty, use original file name
                if(!title || title.trim() === ''){
                    const fileNameNoExt  = path.basename(fileName, path.extname(fileName)); // extract file name without ext
                    const sanitizedFileName = sanitizeFileName(fileNameNoExt); // sanitize name
                    const fileExt = path.extname(fileName); //extract file extension from mime type
                    title = `${sanitizedFileName}-${randomKey()}${fileExt}`; // combine to make new title, ext includes '.'. Also added random Key
                }
                else{ // otherwise
                    // take user inputed title and reformat with proper extension
                    const fileExt = path.extname(fileName); //extract file extension from mime type
                    const sanitizedFileName = sanitizeFileName(title); // sanitize name
                    title = `${sanitizedFileName}-${randomKey()}${fileExt}` // combine to make new title, ext includes '.'. Also added random Key
                }

                const downloadLink = 'https://testlink.com'

                // create unique id for upload
                const id = `${randomKey()}${path.extname(fileName)}`;

                // create page link
                const pageLink = `${baseUrl}/file/${id}`;

                // if file size is less than the set size limit
                if(file.size < multiThreshold){
                    // create a readable stream for the uploaded file using its saved location.
                    const readStream = fs.createReadStream(filePath);
                    // upload file to s3 using normal upload
                    await uploadFile(readStream, title, fileType);
                    // insert upload info into MYSQL Database
                    insertFileUpload(id,userIp,title,pageLink,downloadLink,file.size);
                } // if file size is over set size limit
                else if(file.size >= multiThreshold){
                    // create a readable stream for the uploaded file using its saved location.
                    // use trackreadprogress to track the reading progress
                    const readStream = trackReadProgress(filePath);
                    // upload file to s3 using multipart upload
                    await uploadFileMultiPart(readStream, title, fileType);
                    // insert upload info into MYSQL Database
                    insertFileUpload(id,userIp,title,pageLink,downloadLink,file.size);
                }
                // delete the file temporarily stored in disk
                fs.unlink(filePath, (err) =>{
                    if(err) console.error(`Error deleting file ${title} from disk.`, err);
                    else console.log(`${title} deleted from disk after upload.`);
                });

                // respond by showing link to new page
                //res.json({ success: true, url: pageLink });
                // respond by redirecting to new page
                setTimeout(() => {
                    res.redirect(pageLink);
                }, 500); //wait .5 seconds

            }
      } catch(error){ //error handling
            console.error('Error uploading file: ', error);
            res.status(500).send('Error processing file.');
      }
    }
    // if multiple files are uploaded
    if(uploadedFiles.length > 1){
        try{
            // zip the array of files
            const zippedFileStream = await zipper(uploadedFiles);

            // if user title is empty, use a default name
            if (!title || title.trim() === '') {
                title = 'zipped_files';
            };

            const sanitizedFileName = sanitizeFileName(title); // sanitize name
            // else rename file to user title
            const zippedFileName = `${sanitizedFileName}-${randomKey()}.zip`;//`zipped-files-${randomKey()}.zip`;
            const zippedFilePath = path.join(__dirname, 'uploads', zippedFileName);

            // create write stream to specified file path
            const writeStream = fs.createWriteStream(zippedFilePath);
            zippedFileStream.pipe(writeStream); // write the zip stream to the file path
            await new Promise((resolve, reject) => { // this process is asynchronus
                writeStream.on('finish', resolve); // success
                writeStream.on('error', reject); // error handling
            });

            // retrieve file size of zip
            const zippedFileStats = fs.statSync(zippedFilePath);
            const zippedFileSize = zippedFileStats.size;

            const downloadLink = 'https://testlink.com'

            // create unique id for upload
            const id = `${randomKey()}${path.extname(zippedFileName)}`;

            // create page link
            const pageLink = `${baseUrl}/file/${id}`;

            // reject if zip exceeds 2 GB
            if (zippedFileSize > maxUploadSize) {
                console.error(`Error: Zipped file ${zippedFileName} exceeds 2GB limit.`);
                
                // delete the zipped file temporarily stored in disk
                fs.unlink(zippedFilePath, (err) => {
                    if (err) console.error(`Error deleting large file ${zippedFileName} from disk.`, err);
                    else console.log(`${zippedFileName} deleted from disk due to size limit.`);
                });

                // delete individual unzipped files
                for (const file of uploadedFiles) {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error deleting file ${file.originalname} from disk.`, err);
                        else console.log(`${file.originalname} deleted from disk.`);
                    });
                };
                return res.status(400).send(`Error: Zipped file ${zippedFileName} exceeds 2GB limit.`);
            };

            // if file size is less than set size limit, upload file to s3 using normal upload
            if(zippedFileSize < multiThreshold){
                // create read stream to zip file
                const readStream = fs.createReadStream(zippedFilePath);
                await uploadFile(readStream, zippedFileName, 'application/zip');
                // insert upload info into MYSQL Database
                insertFileUpload(id,userIp,zippedFileName,pageLink,downloadLink,zippedFileSize);
            } // if file size is over set size limit, upload file to s3 using multipart upload
            else if(zippedFileSize >= multiThreshold){
                // create read stream to zip file
                // use trackreadprogress to track the reading progress
                const readStream = trackReadProgress(zippedFilePath);
                await uploadFileMultiPart(readStream, zippedFileName, 'application/zip');
                // insert upload info into MYSQL Database
                insertFileUpload(id,userIp,zippedFileName,pageLink,downloadLink,zippedFileSize);
            };

            // delete the zipped file temporarily stored in disk
            fs.unlink(zippedFilePath, (err) =>{
                if(err) console.error(`Error deleting file ${zippedFileName} from disk.`, err);
                else console.log(`${zippedFileName} deleted from disk after upload.`);
            });
            // delete individual unzipped files
            for (const file of uploadedFiles) {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Error deleting file ${file.originalname} from disk.`, err);
                    else console.log(`${file.originalname} deleted from disk.`);
                });
            };

            // respond by showing link to new page
            //res.json({ success: true, url: pageLink });
            // respond by redirecting to new page
            setTimeout(() => {
                res.redirect(pageLink);
            }, 500); //wait .5 seconds

        } catch(error){ //error handling
            console.error('Error uploading file: ', error);
            res.status(500).send('Error processing file.');
        }
    }
});

// route to initiate multipart upload
router.post('/initiate-multipart-upload', async (req,res) =>{

    // retrieve request body
    const{ fileName, fileType, fileSize } = req.body;

    console.log(`Received request to initiate multipart upload for file: ${fileName}`);

    if (!fileName || !fileType || !fileSize) {
        console.error('Missing fileName, fileType, or fileSize in request body.');
        return res.status(400).json({ error: 'Missing fileName, fileType, or fileSize' });
    }

    // reject if file size is above limit
    if (fileSize > maxUploadSize) {
        console.error(`Error: File ${fileName} exceeds 2GB limit.`);
        return res.status(400).json({ error: `File ${fileName} exceeds 2GB limit.` });
    }

    try{
        // populate parameters for s3
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            ContentType: fileType,
        };

        // initiate multipart upload
        const {UploadId} = await s3.createMultipartUpload(params).promise();

        // Find amount of parts
        const partCount = Math.ceil(req.body.fileSize / (setPartSize*1024*1024));
        console.log('Part count:', partCount);

        // Array to contain presigned url for each part upload
        const presignedUrls = [];

        // loop through all parts of the upload and generate presigned urls
        for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    try {
        const url = await s3.getSignedUrlPromise('uploadPart', {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            UploadId,
            PartNumber: partNumber,
        });
        presignedUrls.push(url);
        console.log(`Generated presigned URL for part ${partNumber}`);
    } catch (err) {
        console.error(`Error generating presigned URL for part ${partNumber}:`, err);
        console.error('AWS Error Response:', err.message);
    }
}
        // response
        res.json({uploadId: UploadId, parts: presignedUrls});

    }catch(error){ //error handling
        console.error('Error initiating multipart upload:', error);
        res.status(500).json({ error: 'Failed to initiate multipart upload' });
    };
});

// route to complete multipart upload
router.post('/complete-multipart-upload', async (req,res) => {

    // retrieve request body
    const { uploadId, fileName, parts } = req.body;

    if(!uploadId || !fileName || !parts || !Array.isArray(parts)){
        return res.status(400).json({ error: 'Invalid request payload' });
    };

    try{
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(({ PartNumber, ETag }) => ({
                    PartNumber,
                    ETag,
                })),
            },
        };

        const result = await s3.completeMultipartUpload(params).promise();
        res.json({ message: 'Upload complete', location: result.location });

    }catch(error){
        console.error('Error completing multipart upload:', error);
        res.status(500).json({ error: 'Failed to complete multipart upload' });
    };

});

// when route is accessed, it dynamically creates a page for the request file
router.get('/file/:uniqueId', async (req,res) => {
    // retrieve file id from request for use
    const uniqueId = req.params.uniqueId;

    if (!uniqueId) {
        return res.status(400).send("Error: Missing file ID.");
    }

    try{
        // retrieve file name from database using id
        const retrievedfileName = await retrieveFileUploadData(uniqueId,'file_name');
        const fileName = decryptData(retrievedfileName);
        let cleanName = fileName.replace(/-(?!.*-).*?\./, '.');


        // retrieve share link from database using id
        const retrievedShareLink = await retrieveFileUploadData(uniqueId,'page_link');
        let shareLink = decryptData(retrievedShareLink);

        // retrieve expiration date and time from database using id
        const retrievedExpirationDate = await retrieveFileUploadData(uniqueId,'expiration_date');

        if (!fileName) {
            throw new Error(`No data found with id: ${uniqueId}`);
        }
        // determine file type by extracting ext
        const fileExt = fileName.split('.').pop().toLowerCase();

        // generate presigned url
        const presignedUrl = await generatePresignedURLView(fileName);
        // create a seperate variable to contain the presigned url to use
        let presignedUrlToUse= presignedUrl;
        // generate presigned url without forcing download for pdf preview, assign to urltouse
        if(fileExt === 'pdf'){
            presignedUrlToUse = await generatePresignedURLViewNoDownload(fileName);
        }

        //update s3 link
        updateS3Link(uniqueId,presignedUrl);

        // default generic thumbnail for unspecified file types
        const defaultThumbnail = genericImg; 

        // media type for Open Graph, to display in media sites etc
        let ogType = "website";
        let ogMediaTags = ""; // Store the  media tags
        let ogImage = defaultThumbnail; // Default to a generic thumbnail

        // for imgs, embed the img
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
            ogType = "image";
            ogImage = presignedUrl;
        // for videos, try to embed
        } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExt)) {
            shareLink = `${baseUrl}/video/${fileName}`;
            ogType = "video";
            ogMediaTags = `
                <meta property="og:video" content="${shareLink}" />
                <meta property="og:video:secure_url" content="${shareLink}" />
                <meta property="og:video:type" content="video/mp4" />
            `;
        }

        //html for new page
        res.send(`
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Uplo - View File</title>
                <link rel="stylesheet" href="/styleSharePage.css">

                <meta property="og:title" content="View File: ${cleanName}" />
                <meta property="og:description" content="Click to view or download this file." />
                <meta property="og:type" content="${ogType}" />
                <meta property="og:url" content="${baseUrl}/file/${uniqueId}" />
                <meta property="og:image" content="${ogImage}" />
                <meta property="og:site_name" content="Uplo File Sharing" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:image" content="${ogImage}" />
                ${ogMediaTags}

                <!-- Favicon & Theme Color -->
                <link rel="icon" href="${genericImg}" />
                <meta name="theme-color" content="#FA8072" />
            </head>
            <body>
                <div id="header">
                    <div id="logo">
                        <!--<img src="logo.jpg" id="logo" alt="Logo"> -->
                        ....LOGO
                    </div>
                    <div id="overallShare">
                        <div id="shareLinkAndButton">
                            <input type="text" value="${shareLink}" id="copyLink" readonly>
                            <button onclick="copyText()" id="copyButton">
                                <img class="iconClass" id="copyIcon" src="/assets/copyIcon.png">
                            </button>
                        </div>
                        <div id="toolTip">Copy Link</div>
                    </div>
                    <div id="downloadContainer">
                        <button id="downloadBtn" data-url="${presignedUrl}">
                            <img class="iconClass" src="/assets/downloadIcon.png">
                            <div id="downText">Download</div>
                        </button>
                    </div>
                </div>
                <div id="main-body">
                    <div id="embed">
                        ${generateFileEmbed(fileExt,presignedUrlToUse,cleanName)}
                    </div>
                    <div id="infoBox"></div>
                </div>

                <script src="/indexSharePage.js"></script>
            </body>
            </html>
        `);
    } catch(error){ //error handling
        console.error('Error retrieving data:', error);
        res.status(500).send(`Error retrieving file information: ${error.message}`);
    }
});

// streams videos from s3, allow seekiong
app.get("/video/:key", async (req, res) => {
    try {
        // get file name 
        const { key } = req.params;
        // get the range header
        const range = req.headers.range;

        // bucket and file name
        const headParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
        };

        // get the file metadata to determine size
        const headObject = await s3.headObject(headParams).promise();
        const fileSize = headObject.ContentLength;

        // if range header is not present, serve enitre video
        if (!range) {
            const streamParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: key,
            };
            const stream = s3.getObject(streamParams).createReadStream();
            res.writeHead(200, {
                "Content-Length": fileSize,
                "Content-Type": "video/mp4",
            });
            return stream.pipe(res);
        }

        // if range header exists, extract bytes from header and convert to int
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        // invalid range
        if (start >= fileSize || end >= fileSize) {
            return res.status(416).send("Requested range not satisfiable");
        }
        // stream only request portion
        const streamParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Range: `bytes=${start}-${end}`,
        };
        const stream = s3.getObject(streamParams).createReadStream();

        // handle range requests, allow partial content delivery
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": "video/mp4",
        });
        stream.pipe(res);

    // error handling
    } catch (error) {
        console.error("Error streaming video:", error);
        res.status(500).send("Error streaming video");
    }
});


