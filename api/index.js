const app = require('../server');

module.exports = async (req, res) => {
  if (app.dbPromise) {
    try {
      await app.dbPromise;
    } catch (e) {
      console.error('[Vercel Serverless] DB initialization error:', e);
    }
  }
  return app(req, res);
};
