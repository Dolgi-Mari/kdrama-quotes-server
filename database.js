const { Pool } = require('pg');

// Railway автоматически предоставляет DATABASE_URL
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Проверка подключения к базе данных
pool.connect((err, client, release) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err.stack);
  } else {
    console.log('✅ Успешное подключение к PostgreSQL БД на Railway');
    release();
  }
});

module.exports = pool;
