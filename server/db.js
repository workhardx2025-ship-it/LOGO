const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let db = null;

function init() {
  try {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        db = null;
        return;
      }
      console.log('Connected to SQLite database');
      createTables();
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    db = null;
  }
}

function createTables() {
  // Таблица учеников
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating students table:', err);
    } else {
      console.log('Students table ready');
    }
  });

  // Таблица уроков
  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      target_sounds TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // Таблица слов в уроке
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      image_path TEXT,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    )
  `);

  // Таблица сессий урока (занятия)
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    )
  `);

  // Таблица попыток произношения
  db.run(`
    CREATE TABLE IF NOT EXISTS pronunciation_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      is_correct INTEGER DEFAULT 0,
      attempt_number INTEGER DEFAULT 1,
      recognized_text TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES lesson_sessions(id),
      FOREIGN KEY (word_id) REFERENCES lesson_words(id)
    )
  `);

  // Таблица базы картинок
  db.run(`
    CREATE TABLE IF NOT EXISTS image_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      image_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating image_library table:', err);
    } else {
      console.log('Image library table ready');
    }
  });
}

function getDb() {
  return db;
}

module.exports = {
  init,
  getDb
};

