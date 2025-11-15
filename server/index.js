const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
const db = require('./db');
const studentsRoutes = require('./routes/students');
const lessonsRoutes = require('./routes/lessons');
const speechRoutes = require('./routes/speech');
const imagesRoutes = require('./routes/images');

const app = express();
const PORT = process.env.PORT || 3001;
// Используем 0.0.0.0 для доступа из локальной сети, или 127.0.0.1 только для локального доступа
// Для доступа с мобильного устройства в той же WiFi сети используйте 0.0.0.0
const HOST = process.env.HOST || '0.0.0.0';
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Инициализация базы данных
db.init();

// Middleware для проверки готовности базы данных
app.use('/api', (req, res, next) => {
  const database = db.getDb();
  if (!database) {
    return res.status(503).json({ error: 'Database is initializing, please try again in a moment' });
  }
  next();
});

// Маршруты
app.use('/api/students', studentsRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/speech', speechRoutes);
app.use('/api/images', imagesRoutes);

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Статические файлы для картинок
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  const database = db.getDb();
  res.json({ 
    status: 'ok',
    database: database ? 'connected' : 'not connected'
  });
});

// Игнорируем запросы от Chrome DevTools
app.get('/.well-known/*', (req, res) => {
  res.status(404).end();
});

// Обработчик для неизвестных маршрутов API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Обработчик для всех остальных маршрутов
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Функция для запуска сервера
const startServer = () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });

  const protocol = HTTPS_ENABLED ? 'https' : 'http';
  
  if (HTTPS_ENABLED) {
    // Настройка HTTPS
    const certPath = process.env.HTTPS_CERT_PATH || path.join(__dirname, 'certs', 'localhost+3.pem');
    const keyPath = process.env.HTTPS_KEY_PATH || path.join(__dirname, 'certs', 'localhost+3-key.pem');
    
    let httpsOptions = {};
    
    try {
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        httpsOptions = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };
        console.log(`✅ HTTPS сертификаты загружены: ${certPath}`);
      } else {
        console.warn(`⚠️  HTTPS включен, но сертификаты не найдены:`);
        console.warn(`   Cert: ${certPath}`);
        console.warn(`   Key: ${keyPath}`);
        console.warn(`   Создайте сертификаты с помощью mkcert (см. HTTPS_SETUP.md)`);
        console.warn(`   Или установите HTTPS_ENABLED=false в .env`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки HTTPS сертификатов:', error.message);
      console.error('   Установите HTTPS_ENABLED=false в .env для использования HTTP');
      process.exit(1);
    }
    
    https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
      console.log(`\n🔒 Server running on ${protocol}://${HOST}:${PORT}`);
      console.log(`Health check: ${protocol}://${HOST}:${PORT}/api/health`);
      
      if (addresses.length > 0) {
        console.log(`\n📱 Для доступа с мобильного устройства в той же WiFi сети:`);
        addresses.forEach(addr => {
          console.log(`   ${protocol}://${addr}:${PORT}`);
        });
      }
      
      console.log(`\n💻 Для локального доступа: ${protocol}://127.0.0.1:${PORT}`);
      if (HOST === '0.0.0.0') {
        console.log(`⚠️  Если используете VPN, установите HOST=127.0.0.1 в .env`);
      }
    });
  } else {
    // HTTP режим
    app.listen(PORT, HOST, () => {
      console.log(`\n🌐 Server running on ${protocol}://${HOST}:${PORT}`);
      console.log(`Health check: ${protocol}://${HOST}:${PORT}/api/health`);
      
      if (addresses.length > 0) {
        console.log(`\n📱 Для доступа с мобильного устройства в той же WiFi сети:`);
        addresses.forEach(addr => {
          console.log(`   ${protocol}://${addr}:${PORT}`);
        });
        console.log(`\n⚠️  ВАЖНО: Используйте ${protocol}:// при открытии на мобильном устройстве!`);
      }
      
      console.log(`\n💻 Для локального доступа: ${protocol}://127.0.0.1:${PORT}`);
      if (HOST === '0.0.0.0') {
        console.log(`⚠️  Если используете VPN, установите HOST=127.0.0.1 в .env`);
      }
      console.log(`\n💡 Для работы микрофона на Safari (iOS) включите HTTPS (см. HTTPS_SETUP.md)`);
    });
  }
};

startServer();

