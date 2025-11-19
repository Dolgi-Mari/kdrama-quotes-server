const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// 📊 Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: 'Токен доступа отсутствует' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
};

// 👤 РОУТЫ ДЛЯ АУТЕНТИФИКАЦИИ

// Регистрация нового пользователя
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Проверка обязательных полей
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }

    // Проверка длины пароля
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Проверка существования пользователя
    const userExists = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, hashedPassword]
    );

    // Генерация JWT токена
    const token = jwt.sign(
      { userId: result.rows[0].id, username: result.rows[0].username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email
      },
      token
    });
  } catch (err) {
    console.error('Ошибка при регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Авторизация пользователя
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Проверка обязательных полей
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    // Поиск пользователя
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const user = result.rows[0];

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Генерация JWT токена
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Авторизация успешна',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (err) {
    console.error('Ошибка при авторизации:', err);
    res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

// Получение информации о текущем пользователе
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 📱 РОУТЫ ДЛЯ ЦИТАТ

// Получить все цитаты (доступно без авторизации)
app.get('/quotes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title, u.username as author
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

// Получить цитату по ID (доступно без авторизации)
app.get('/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title, d.description as drama_description, u.username as author
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      LEFT JOIN users u ON q.user_id = u.id
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

// Добавить новую цитату (требует авторизации)
app.post('/quotes', authenticateToken, async (req, res) => {
  try {
    const { text, drama_title, character_name, season, episode } = req.body;
    const userId = req.user.userId;
    
    // Проверка обязательных полей
    if (!text || !drama_title || !character_name) {
      return res.status(400).json({ error: 'Текст цитаты, название дорамы и имя персонажа обязательны' });
    }
    
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
    
    // Теперь добавляем цитату с привязкой к пользователю
    const result = await pool.query(
      `INSERT INTO quotes (text, drama_id, character_name, season, episode, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [text, dramaId, character_name, season, episode, userId]
    );
    
    // Получаем полные данные цитаты с названием дорамы и автором
    const quoteResult = await pool.query(`
      SELECT q.*, d.title as drama_title, u.username as author
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      LEFT JOIN users u ON q.user_id = u.id
      WHERE q.id = $1
    `, [result.rows[0].id]);
    
    res.status(201).json(quoteResult.rows[0]);
  } catch (err) {
    console.error('Ошибка при добавлении цитаты:', err);
    res.status(500).json({ error: 'Ошибка при добавлении цитаты: ' + err.message });
  }
});

// Получить цитаты текущего пользователя
app.get('/my-quotes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(`
      SELECT q.*, d.title as drama_title 
      FROM quotes q 
      LEFT JOIN dramas d ON q.drama_id = d.id 
      WHERE q.user_id = $1
      ORDER BY q.id DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
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

// 📍 СПЕЦИАЛЬНЫЕ РОУТЫ
app.get('/test', (req, res) => {
  res.json({ 
    message: '✅ K-Drama Quotes API работает!',
    database: '✅ Подключено к PostgreSQL',
    authentication: '✅ JWT авторизация настроена',
    status: '🚀 Сервер запущен и готов к работе',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: ['POST /register', 'POST /login', 'GET /profile'],
      quotes: ['GET /quotes', 'POST /quotes', 'GET /my-quotes'],
      dramas: ['GET /dramas'],
      test: '/test'
    }
  });
});

// Тестовый роут (главная страница)
app.get('/', (req, res) => {
  res.json({ 
    message: 'K-Drama Quotes API работает!',
    authentication: 'Для работы с защищенными маршрутами используйте JWT токен',
    endpoints: {
      auth: ['/register', '/login', '/profile'],
      quotes: ['/quotes', '/my-quotes'],
      dramas: ['/dramas'],
      test: '/test'
    }
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 API доступно по: http://localhost:${PORT}`);
  console.log(`🔐 JWT секрет: ${JWT_SECRET === 'your-secret-key-change-in-production' ? 'ИСПОЛЬЗУЕТСЯ СТАНДАРТНЫЙ КЛЮЧ (замените в production)' : 'используется кастомный ключ'}`);
});
