# KyrsovaBD - UPL Fantasy League

Курсова робота: веб-додаток для управління фантазійною лігою українського футболу.

## 🚀 Запуск проекту

### Вимоги:
- Node.js (v18+)
- PostgreSQL (v12+)

### 1. Встановлення залежностей

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd client && npm install
```

### 2. Налаштування БД

**Створіть файл `.env` в корені проекту:**
```env
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=kyrsovabd
DB_PASSWORD=password
DB_PORT=5432
PORT=3000
```

**Запустіть SQL скрипт для створення таблиць:**
```bash
psql -U postgres -f init.sql
```

### 3. Запуск

**Terminal 1 - Backend:**
```bash
npm run dev
```
Сервер буде доступний на `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```
Клієнт буде доступний на `http://localhost:3000`

## 📁 Структура проекту

```
KyrsovaBD/
├── server.js                 # Express сервер
├── config/
│   └── db.js                # Налаштування PostgreSQL
├── controllers/
│   └── authController.js    # Логіка реєстрації та логіну
├── routes/
│   └── authRoutes.js        # API маршрути
├── client/                  # React додаток
│   ├── src/
│   │   ├── pages/
│   │   │   ├── login/
│   │   │   └── Registration/
│   │   └── App.js
│   └── package.json
└── .env                     # Змінні середовища
```

## 🔑 API Endpoints

### Реєстрація
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "John Doe",
  "email": "john@example.com",
  "password": "secure_password"
}
```

### Логін
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secure_password"
}
```

## 🛠️ Технологічний стек

**Backend:**
- Express.js - веб-фреймворк
- PostgreSQL - база даних
- bcrypt - хешування паролів

**Frontend:**
- React 19
- React Router Dom - маршрутизація
- CSS - стилізація

## 📝 Ліцензія

ISC
