const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Service proxies
const serviceProxyOptions = {
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({ error: 'Service unavailable' });
  }
};

// User service routes
app.use('/api/users', createProxyMiddleware({
  target: 'http://user-service:3001',
  pathRewrite: {'^/api/users': ''},
  ...serviceProxyOptions
}));

// Product service routes (public)
app.use('/api/products', createProxyMiddleware({
  target: 'http://product-service:3002',
  pathRewrite: {'^/api/products': ''},
  ...serviceProxyOptions
}));

// Cart service routes (protected)
app.use('/api/cart', authenticateToken, createProxyMiddleware({
  target: 'http://cart-service:3003',
  pathRewrite: {'^/api/cart': ''},
  ...serviceProxyOptions
}));

// Order service routes (protected)
app.use('/api/orders', authenticateToken, createProxyMiddleware({
  target: 'http://order-service:3004',
  pathRewrite: {'^/api/orders': ''},
  ...serviceProxyOptions
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
