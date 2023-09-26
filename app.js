const express = require('express');
const request = require('request');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Serve the static PDF.js viewer files
app.use('/pdfjs', express.static(path.join(__dirname, 'pdfjs')));

// Serve the index.html file from the 'public' folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create the "/uploads" directory if it doesn't exist
const uploadsDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory);
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cache to store downloaded PDF files
const cacheFilePath = path.join(__dirname, 'pdfCache.json');
let pdfCache = new Map();

// Read cache data from file if it exists
if (fs.existsSync(cacheFilePath)) {
  try {
    const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
    pdfCache = new Map(JSON.parse(cacheData));
  } catch (error) {
    console.error('Error reading cache data:', error);
  }
}

// Function to save the cache to a file
function saveCacheToFile() {
  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify([...pdfCache]), 'utf8');
  } catch (error) {
    console.error('Error saving cache data to file:', error);
  }
}

// Route to download and display the PDF
app.get('/pdf', (req, res) => {
  const { fileUrl } = req.query;

  if (!fileUrl) {
    return res.status(400).send('Missing fileUrl parameter');
  }

  // Check if the PDF has already been downloaded
  if (pdfCache.has(fileUrl)) {
    const uniqueFilename = pdfCache.get(fileUrl);
    const viewerUrl = `/pdfjs/web/viewer.html?file=/uploads/${uniqueFilename}`;
    return res.redirect(viewerUrl);
  }

  // Generate a unique filename for the downloaded PDF
  const uniqueFilename = `pdf_${Date.now()}.pdf`;
  const filePath = path.join(uploadsDirectory, uniqueFilename);

  // Download the PDF from the external URL and save it to the "/uploads" directory
  const fileStream = fs.createWriteStream(filePath);
  request.get(fileUrl)
    .on('error', (error) => {
      console.error('Error fetching the PDF:', error);
      res.status(500).send('Error fetching the PDF');
    })
    .pipe(fileStream)
    .on('finish', () => {
      // Cache the filename for future requests
      pdfCache.set(fileUrl, uniqueFilename);
      // Save the cache to the file
      saveCacheToFile();

      // Redirect to the viewer.html page with the downloaded PDF file as a parameter
      const viewerUrl = `/pdfjs/web/viewer.html?file=/uploads/${uniqueFilename}`;
      res.redirect(viewerUrl);
    });
});

// Listen for server shutdown and save the cache to file
process.on('SIGINT', () => {
  saveCacheToFile();
  process.exit();
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
