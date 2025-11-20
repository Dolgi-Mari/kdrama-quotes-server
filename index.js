// Главный файл сервера Express для K-Drama Quotes API
const express = require('express');          // Фреймворк для веб-приложений
const cors = require('cors');                // Middleware для CORS
const pool = require('./database');          // Пул подключений к PostgreSQL
const bcrypt = require('bcryptjs');          // Библиотека для хеширования паролей


const app = express();
const PORT = process.env.PORT || 8080;  // Порт из переменных окружения или 8080

// Middleware
app.use(cors());                             // Разрешение кросс-доменных запросов
app.use(express.json());                     // Парсинг JSON в теле запросов


// АУТЕНТИФИКАЦИЯ

// Регистрация пользователя
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Проверка обязательных полей
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    // Проверка существующего пользователя
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание нового пользователя в базе данных
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});



// Вход пользователя
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Валидация входных данных
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    // Поиск пользователя
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const user = userResult.rows[0];

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Успешная аутентификация
    res.json({
      message: 'Успешный вход',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});


// РОУТЫ ДЛЯ ЦИТАТ

// Получить все цитаты
app.get('/quotes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title, u.username as user_username
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      LEFT JOIN users u ON q.user_id = u.id
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
    const { text, drama_title, character_name, season, episode, user_id } = req.body;
    
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
      `INSERT INTO quotes (text, drama_id, character_name, season, episode, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [text, dramaId, character_name, season, episode, user_id]
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
      auth: ['/register', '/login'],
      quotes: '/quotes',
      dramas: '/dramas',
      test: '/test'
    }
  });
});

// Тестовый роут (главная страница)
app.get('/', (req, res) => {
  res.json({ 
    message: 'K-Drama Quotes API работает!',
    endpoints: {
      auth: ['/register', '/login'],
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
