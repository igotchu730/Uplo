const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the "mainpage" directory
app.use(express.static(path.join(__dirname, 'mainpage')));

// Serve index.html on the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mainpage', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});