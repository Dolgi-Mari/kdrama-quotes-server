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


/////////////////
// 📝 РОУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ

// Регистрация пользователя
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Проверяем, нет ли уже пользователя с таким email
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1', 
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    // Создаем нового пользователя
    const result = await pool.query(
      `INSERT INTO users (username, email, password) 
       VALUES ($1, $2, $3) RETURNING id, username, email`,
      [username, email, password]
    );
    
    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход пользователя
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Ищем пользователя
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE email = $1 AND password = $2',
      [email, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    res.json({
      message: 'Успешный вход',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновляем добавление цитат - теперь с user_id
app.post('/quotes', async (req, res) => {
  try {
    const { text, drama_title, character_name, season, episode, user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'Не указан пользователь' });
    }
    
    // Сначала находим или создаем дораму
    let dramaResult = await pool.query('SELECT id FROM dramas WHERE title = $1', [drama_title]);
    let dramaId;
    
    if (dramaResult.rows.length === 0) {
      dramaResult = await pool.query(
        'INSERT INTO dramas (title) VALUES ($1) RETURNING id',
        [drama_title]
      );
      dramaId = dramaResult.rows[0].id;
    } else {
      dramaId = dramaResult.rows[0].id;
    }
    
    // Добавляем цитату с user_id
    const result = await pool.query(
      `INSERT INTO quotes (text, drama_id, character_name, season, episode, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [text, dramaId, character_name, season, episode, user_id]
    );
    
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

// Получаем цитаты конкретного пользователя
app.get('/quotes/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title 
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      WHERE q.user_id = $1
      ORDER BY q.id DESC
    `, [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
////////////////////

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 API доступно по: http://localhost:${PORT}`);
});
