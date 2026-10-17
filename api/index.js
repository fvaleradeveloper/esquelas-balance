// Entry point para Vercel Serverless Functions
// Exporta la app Express para que Vercel la sirve

const app = require('../server/app');

module.exports = app;