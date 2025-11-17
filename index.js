const express = require('express');
const cors = require('cors');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// 📱 РОУТЫ ДЛЯ ЦИТАТ

// Получить все цитаты
app.get('/quotes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title 
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      ORDER BY q.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить цитату по ID
app.get('/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title, d.description as drama_description 
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      WHERE q.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Цитата не найдена' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавить новую цитату
app.post('/quotes', async (req, res) => {
  try {
    const { text, drama_title, character_name, season, episode } = req.body;
    
    // Сначала находим или создаем дораму
    let dramaResult = await pool.query('SELECT id FROM dramas WHERE title = $1', [drama_title]);
    let dramaId;
    
    if (dramaResult.rows.length === 0) {
      // Создаем новую дораму
      dramaResult = await pool.query(
        'INSERT INTO dramas (title) VALUES ($1) RETURNING id',
        [drama_title]
      );
      dramaId = dramaResult.rows[0].id;
    } else {
      dramaId = dramaResult.rows[0].id;
    }
    
    // Теперь добавляем цитату
    const result = await pool.query(
      `INSERT INTO quotes (text, drama_id, character_name, season, episode) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [text, dramaId, character_name, season, episode]
    );
    
    // Получаем полные данные цитаты с названием дорамы
    const quoteResult = await pool.query(`
      SELECT q.*, d.title as drama_title 
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      WHERE q.id = $1
    `, [result.rows[0].id]);
    
    res.status(201).json(quoteResult.rows[0]);
  } catch (err) {
    console.error('Ошибка при добавлении цитаты:', err);
    res.status(500).json({ error: 'Ошибка при добавлении цитаты: ' + err.message });
  }
});

// 📺 РОУТЫ ДЛЯ ДОРАМ

// Получить все дорамы
app.get('/dramas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dramas ORDER BY title');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 📍 СПЕЦИАЛЬНЫЙ ТЕСТОВЫЙ РОУТ
app.get('/test', (req, res) => {
  res.json({ 
    message: '✅ K-Drama Quotes API работает!',
    database: '✅ Подключено к PostgreSQL',
    status: '🚀 Сервер запущен и готов к работе',
    timestamp: new Date().toISOString(),
    endpoints: {
      all_quotes: '/quotes',
      all_dramas: '/dramas',
      test: '/test'
    }
  });
});

// Тестовый роут (главная страница)
app.get('/', (req, res) => {
  res.json({ 
    message: 'K-Drama Quotes API работает!',
    endpoints: {
      quotes: '/quotes',
      dramas: '/dramas',
      test: '/test'
    }
  });
});


// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 API доступно по: http://localhost:${PORT}`);
});
