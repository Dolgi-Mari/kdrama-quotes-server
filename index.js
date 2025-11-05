const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка подключения к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// 📱 РОУТЫ ДЛЯ ЦИТАТ

// Получить все цитаты
app.get('/quotes', async (req, res) => {
  try {
    console.log('Получение всех цитат...');
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title 
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      ORDER BY q.id DESC
    `);
    console.log('Найдено цитат:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения цитат:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Добавить новую цитату
app.post('/quotes', async (req, res) => {
  try {
    const { text, drama_id, character_name, season, episode } = req.body;
    console.log('Добавление цитаты:', { text, drama_id, character_name });
    
    const result = await pool.query(
      `INSERT INTO quotes (text, drama_id, character_name, season, episode) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [text, drama_id, character_name, season, episode]
    );
    
    console.log('Цитата добавлена:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка добавления цитаты:', err);
    res.status(500).json({ error: 'Ошибка при добавлении цитаты' });
  }
});

// 📺 РОУТЫ ДЛЯ ДОРАМ
app.get('/dramas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dramas ORDER BY title');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Тестовый роут
app.get('/', (req, res) => {
  res.json({ 
    message: '🎬 K-Drama Quotes API работает!',
    timestamp: new Date().toISOString(),
    endpoints: {
      quotes: '/quotes',
      dramas: '/dramas', 
      add_quote: 'POST /quotes'
    }
  });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
