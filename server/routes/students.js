const express = require('express');
const router = express.Router();
const db = require('../db');

// Получить всех учеников
router.get('/', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  database.all('SELECT * FROM students ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// Получить ученика по ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;
  
  database.get('SELECT * FROM students WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(row);
  });
});

// Создать нового ученика
router.post('/', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { first_name, last_name, middle_name } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  database.run(
    'INSERT INTO students (first_name, last_name, middle_name) VALUES (?, ?, ?)',
    [first_name, last_name, middle_name || null],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        first_name,
        last_name,
        middle_name
      });
    }
  );
});

// Обновить ученика
router.put('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;
  const { first_name, last_name, middle_name } = req.body;

  database.run(
    'UPDATE students SET first_name = ?, last_name = ?, middle_name = ? WHERE id = ?',
    [first_name, last_name, middle_name || null, id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }
      res.json({ message: 'Student updated successfully' });
    }
  );
});

// Удалить ученика
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;

  database.run('DELETE FROM students WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  });
});

module.exports = router;

