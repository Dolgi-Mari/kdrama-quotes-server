// Модуль подключения к PostgreSQL базе данных через Railway
const { Pool } = require('pg');

// Railway автоматически предоставляет DATABASE_URL через переменные окружения
const connectionString = process.env.DATABASE_URL;

// Создание пула подключений к базе данных
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Отключение проверки SSL для Railway
  }
});

// Проверка подключения к базе данных при запуске
pool.connect((err, client, release) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.stack);
  } else {
    console.log('✅ Успешное подключение к PostgreSQL БД на Railway');
    release(); // Освобождение клиента обратно в пул
  }
});

module.exports = pool;
