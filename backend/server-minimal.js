const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Node.js Server is Running on cPanel');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'API is working' });
});

const PORT = process.env.PORT || 5000;

// Phusion Passenger check
if (typeof (PhusionPassenger) !== 'undefined') {
    app.listen('passenger');
} else {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
