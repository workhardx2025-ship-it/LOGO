const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const router = express.Router();

// Настройка multer для загрузки картинок
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения (jpeg, jpg, png, gif, webp) разрешены!'));
    }
  }
});

// Получить все картинки из базы
router.get('/', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  database.all(
    'SELECT * FROM image_library ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows || []);
    }
  );
});

// Получить картинку по ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;

  database.get('SELECT * FROM image_library WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json(row);
  });
});

// Загрузить новую картинку
router.post('/upload', upload.single('image'), (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const { word } = req.body;
  if (!word) {
    // Удаляем загруженный файл если нет слова
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Word is required' });
  }

  // Сохраняем относительный путь для использования в приложении
  const imagePath = `/uploads/images/${req.file.filename}`;

  database.run(
    'INSERT INTO image_library (word, image_path) VALUES (?, ?)',
    [word, imagePath],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        // Удаляем файл если не удалось сохранить в БД
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        word,
        image_path: imagePath,
        message: 'Image uploaded successfully'
      });
    }
  );
});

// Обновить картинку (изменить слово)
router.put('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;
  const { word } = req.body;

  if (!word) {
    return res.status(400).json({ error: 'Word is required' });
  }

  database.run(
    'UPDATE image_library SET word = ? WHERE id = ?',
    [word, id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Image not found' });
      }
      res.json({ message: 'Image updated successfully' });
    }
  );
});

// Удалить картинку
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;

  // Сначала получаем информацию о картинке
  database.get('SELECT * FROM image_library WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Удаляем файл
    const filePath = path.join(__dirname, '..', row.image_path);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fileErr) {
        console.error('Error deleting file:', fileErr);
      }
    }

    // Удаляем запись из БД
    database.run('DELETE FROM image_library WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        console.error('Database error:', deleteErr);
        return res.status(500).json({ error: deleteErr.message });
      }
      res.json({ message: 'Image deleted successfully' });
    });
  });
});

module.exports = router;

