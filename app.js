const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch');
const app = express();
const port = 3000;
const {
  generatePresignedURL,
  uploadFile,
  uploadFile2
} = require('./cloud');
const {
  zipper,
  randomKey
} = require('./utility');

// Serve static files from the "mainpage" directory and "assets" folder
app.use(express.static(path.join(__dirname, 'mainpage')));
app.use('/assets',express.static(path.join(__dirname,'assets')));
app.use(express.json());

// Serve index.html on the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mainpage', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
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
    // function to specify how uploaded files should be named
    filename: (req,file,cb) => {
        cb(null, randomKey() + '-' + file.originalname);
    },
});

// Initalize multer with custom storage
const upload = multer({storage});

// http post endppint, expects a single file.
app.post('/upload', upload.single('file'), async (req,res) => {

    // retrieve uploaded file's metadata
    const uploadedFile = req.file;

    // check if the file uploaded or not, send error if not.
    // req.file contains metadata of the uploaded file. 1)filename, 2)path
    if(!uploadedFile){
        return res.status(400).send('No file uploaded');
    }

    // create file path to uploads folder for temp storage and define metadata values
    const filePath = path.join(__dirname, 'uploads', uploadedFile.filename);
    const fileName = uploadedFile.originalname;
    const fileType = uploadedFile.mimetype;

    try{
      // creates a readable stream for the uploaded file using its saved location.
      const readStream = fs.createReadStream(filePath);

      // upload file to s3
      await uploadFile(readStream, fileName, fileType);

      // delete the file temporarily stored in disk
      fs.unlink(filePath, (err) =>{
          if(err) console.error('Error deleting file:', err);
          else console.log('File deleted after upload.');
      });
      // success
      res.send('File uploaded and processed successfully.');

  } catch(error){ //error handling
      console.error('Error uploading file: ', error);
      res.status(500).send('Error processing file.');
  }
});

