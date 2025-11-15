const express = require('express');
const router = express.Router();
const db = require('../db');

// Получить все уроки для ученика
router.get('/student/:studentId', (req, res) => {
  const database = db.getDb();
  const { studentId } = req.params;
  
  database.all(
    'SELECT * FROM lessons WHERE student_id = ? ORDER BY created_at DESC',
    [studentId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Получить урок с словами
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.get('SELECT * FROM lessons WHERE id = ?', [id], (err, lesson) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Получить слова урока
    database.all(
      'SELECT * FROM lesson_words WHERE lesson_id = ? ORDER BY order_index',
      [id],
      (err, words) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ ...lesson, words });
      }
    );
  });
});

// Создать новый урок
router.post('/', (req, res) => {
  const database = db.getDb();
  const { student_id, name, description, target_sounds, words } = req.body;

  if (!student_id || !name || !words || !Array.isArray(words)) {
    return res.status(400).json({ error: 'Student ID, name, and words array are required' });
  }

  database.run(
    'INSERT INTO lessons (student_id, name, description, target_sounds) VALUES (?, ?, ?, ?)',
    [student_id, name, description || null, target_sounds || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const lessonId = this.lastID;

      // Добавить слова урока
      const stmt = database.prepare(
        'INSERT INTO lesson_words (lesson_id, word, image_path, order_index) VALUES (?, ?, ?, ?)'
      );

      words.forEach((wordObj, index) => {
        stmt.run([lessonId, wordObj.word, wordObj.image_path || null, index]);
      });

      stmt.finalize((err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ id: lessonId, message: 'Lesson created successfully' });
      });
    }
  );
});

// Начать сессию урока
router.post('/:id/start', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;

  database.run(
    'INSERT INTO lesson_sessions (lesson_id) VALUES (?)',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ session_id: this.lastID });
    }
  );
});

// Завершить сессию урока
router.post('/complete', (req, res) => {
  const database = db.getDb();
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  database.run(
    'UPDATE lesson_sessions SET completed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [sessionId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json({ message: 'Session completed' });
    }
  );
});

// Обновить урок
router.put('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;
  const { name, description, target_sounds, words } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Обновляем информацию об уроке
  database.run(
    'UPDATE lessons SET name = ?, description = ?, target_sounds = ? WHERE id = ?',
    [name, description || null, target_sounds || null, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      // Если есть слова, обновляем их
      if (words && Array.isArray(words)) {
        // Удаляем старые слова
        database.run('DELETE FROM lesson_words WHERE lesson_id = ?', [id], (deleteErr) => {
          if (deleteErr) {
            return res.status(500).json({ error: deleteErr.message });
          }

          // Добавляем новые слова
          const stmt = database.prepare(
            'INSERT INTO lesson_words (lesson_id, word, image_path, order_index) VALUES (?, ?, ?, ?)'
          );

          words.forEach((wordObj, index) => {
            stmt.run([id, wordObj.word, wordObj.image_path || null, index]);
          });

          stmt.finalize((finalizeErr) => {
            if (finalizeErr) {
              return res.status(500).json({ error: finalizeErr.message });
            }
            res.json({ message: 'Lesson updated successfully' });
          });
        });
      } else {
        res.json({ message: 'Lesson updated successfully' });
      }
    }
  );
});

// Сохранить попытку произношения
router.post('/attempt', (req, res) => {
  const database = db.getDb();
  const { session_id, word_id, is_correct, recognized_text } = req.body;

  if (!session_id || !word_id || is_correct === undefined) {
    return res.status(400).json({ error: 'Session ID, word ID, and is_correct are required' });
  }

  // Получить номер попытки
  database.get(
    'SELECT COUNT(*) as count FROM pronunciation_attempts WHERE session_id = ? AND word_id = ?',
    [session_id, word_id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const attemptNumber = (row.count || 0) + 1;

      database.run(
        'INSERT INTO pronunciation_attempts (session_id, word_id, is_correct, attempt_number, recognized_text) VALUES (?, ?, ?, ?, ?)',
        [session_id, word_id, is_correct ? 1 : 0, attemptNumber, recognized_text || null],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ id: this.lastID, attempt_number: attemptNumber });
        }
      );
    }
  );
});

// Получить статистику прогресса ученика
router.get('/student/:studentId/progress', (req, res) => {
  const database = db.getDb();
  const { studentId } = req.params;

  const query = `
    SELECT 
      ls.id as session_id,
      ls.started_at,
      ls.completed_at,
      l.name as lesson_name,
      COUNT(pa.id) as total_attempts,
      SUM(CASE WHEN pa.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
      COUNT(DISTINCT pa.word_id) as words_attempted
    FROM lesson_sessions ls
    JOIN lessons l ON ls.lesson_id = l.id
    LEFT JOIN pronunciation_attempts pa ON ls.id = pa.session_id
    WHERE l.student_id = ?
    GROUP BY ls.id
    ORDER BY ls.started_at DESC
  `;

  database.all(query, [studentId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Удалить урок
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  if (!database) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  const { id } = req.params;

  // Сначала получаем все сессии урока для удаления связанных попыток
  database.all('SELECT id FROM lesson_sessions WHERE lesson_id = ?', [id], (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const sessionIds = sessions.map(s => s.id);

    // Удаляем попытки произношения для всех сессий этого урока
    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      database.run(
        `DELETE FROM pronunciation_attempts WHERE session_id IN (${placeholders})`,
        sessionIds,
        (err) => {
          if (err) {
            console.error('Error deleting pronunciation attempts:', err);
            // Продолжаем удаление даже если есть ошибка
          }
        }
      );
    }

    // Удаляем сессии урока
    database.run('DELETE FROM lesson_sessions WHERE lesson_id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Удаляем слова урока
      database.run('DELETE FROM lesson_words WHERE lesson_id = ?', [id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Удаляем сам урок
        database.run('DELETE FROM lessons WHERE id = ?', [id], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
          }
          res.json({ message: 'Lesson deleted successfully' });
        });
      });
    });
  });
});

module.exports = router;

