// Passenger-compatible startup file
// This file is designed to work with Phusion Passenger
const app = require('./server');

// Passenger handles the listening, so we don't need app.listen() here
// Just export the app
module.exports = app;
