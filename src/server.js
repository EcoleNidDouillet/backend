// École Nid Douillet - Server Entry Point
// Starts the Express application

const app = require('./app');
const { logger } = require('./config/database');

// Server is started in app.js, this file is just for clarity
// and potential future server-specific configurations

logger.info('École Nid Douillet Backend Server initialized');

module.exports = app;
