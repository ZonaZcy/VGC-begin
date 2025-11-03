// HTTP Server configuration for proper headers
module.exports = {
  // Set custom headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable'
  }
};
