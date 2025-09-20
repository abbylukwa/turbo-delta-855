const express = require('express');
const app = express();
const port = process.env.PORT || 4000;

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Keep-alive server is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Keep-alive server running on port ${port}`);
});

// Ping ourselves every 5 minutes to prevent Render from sleeping
setInterval(() => {
  const https = require('https');
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  
  https.get(`${url}/health`, (res) => {
    console.log(`Pinged keep-alive endpoint at ${new Date().toISOString()}`);
  }).on('error', (err) => {
    console.error('Error pinging keep-alive:', err.message);
  });
}, 5 * 60 * 1000); // 5 minutes