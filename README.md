# Backend-Doggee

## Обзор

Backend-Doggee - это RESTful API сервер, построенный на Node.js, Express и Sequelize ORM, предназначенный для управления профилями пользователей и их собаками. Сервер использует PostgreSQL в качестве базы данных и включает функции аутентификации, управления пользователями и собаками.

## Функции

- Регистрация и аутентификация пользователей
- Аутентификация на основе JWT
- Управление профилем пользователя
- Управление собаками (операции CRUD)
- Взаимосвязь между пользователями и собаками
- Интеграция со Swagger для документирования API

## Структура проекта
```
backend-doggee
├── config
│   ├── config.js
│   └── database.js
├── migrations
├── models
│   ├── dog.js
│   ├── index.js
│   ├── refreshToken.js
│   └── user.js
├── node_modules
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── server.js
└── swagger.json
```

## Установка

1. Установите зависимости:
```console
npm install
```

2. Создайте файл `.env` в корне проекта и добавьте в него параметры подключения к базе данных:
```
DATABASE_URL=postgres://username:password@host:port/database
```

3. Настройте файл config/database.js:
```
const { Sequelize } = require('sequelize');
require('dotenv').config(); 

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false // Отключение логов Sequelize
});

module.exports = sequelize;
```

4. Добавьте файл `.env` в .gitignore:
```
# .gitignore

node_modules/
.env
```

## Запуск

Запустите сервер с помощью команды:
```console
npm run start
```


Сервер будет доступен по адресу http://localhost:3001.

## Маршруты API

### Аутентификация

- POST `/auth/register` - Регистрация пользователя
- POST `/auth/login` - Вход пользователя
- POST `/auth/refresh-token` - Обновление токена

### Пользователи

- GET `/users/:id/profile` - Получение профиля пользователя
- PUT `/users/:id/profile` - Обновление профиля пользователя
- GET `/users/:id/dogs` - Получение всех собак пользователя
- POST `/users/:id/dogs` - Добавление собаки к пользователю

### Собаки

- GET `/breeds` - Получение списка пород
- GET `/users/:userId/dogs/:dogId` - Получение данных о конкретной собаке пользователя
- PUT `/users/:userId/dogs/:dogId` - Обновление информации о конкретной собаке пользователя
- DELETE `/users/:userId/dogs/:dogId` - Удаление конкретной собаки пользователя

## Документация API

Документация API доступна по адресу http://localhost:3001/api-docs после запуска сервера. Она создана с использованием Swagger.