module.exports = async function handler(req, res) {
  // Some third-party scripts attempt to hit relative paths like /jms/...
  // We return a successful empty response to avoid noisy 404s in console.
  res.statusCode = 204;
  res.setHeader("Cache-Control", "no-store");
  res.end();
};

