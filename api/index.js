// Entry point para Vercel Serverless Functions
// Exporta la app Express para que Vercel la sirva

const { app } = require('../server/app');

module.exports = app;