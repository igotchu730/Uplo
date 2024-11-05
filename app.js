const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const {
  generatePresignedURL
} = require('./cloud');

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

