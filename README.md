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
│ └── database.js 
├── models 
│ ├── dog.js 
│ ├── index.js 
│ └── user.js 
├── node_modules 
├── package.json 
├── package-lock.json 
├── server.js 
└── swagger.json
```

## Установка

1. Установите зависимости:
```console
bash npm install
```

2. Создайте файл `.env` в корне проекта и добавьте в него параметры подключения к базе данных:
```
DATABASE_URL=postgres://username:password@host:port/database
```

3. Настройте файл config/database.js:
```
const { Sequelize } = require('sequelize');
require('dotenv').config(); // Импортируйте и настройте dotenv

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
bash npm start
```


Сервер будет доступен по адресу http://localhost:3001.

## Маршруты API

### Аутентификация

- POST `/auth/register` - Регистрация пользователя
- POST `/auth/login` - Вход пользователя

### Пользователи

- GET `/users/:id/profile` - Получение профиля пользователя
- PUT `/users/:id/profile` - Обновление профиля пользователя
- GET `/users/:id/dogs` - Получение всех собак пользователя
- POST `/users/:id/dogs` - Добавление собаки к пользователю

### Собаки

- GET `/dogs` - Получение всех собак
- GET `/dogs/:id` - Получение информации о собаке по ID
- POST `/dogs` - Создание новой собаки
- PUT `/dogs/:id` - Обновление информации о собаке
- DELETE `/dogs/:id` - Удаление собаки

## Документация API

Документация API доступна по адресу http://localhost:3001/api-docs после запуска сервера. Она создана с использованием Swagger.