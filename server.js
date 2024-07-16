const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const { check, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 3001;

const SECRET_KEY = 'doggee-secret';
const REFRESH_SECRET_KEY = 'doggee-refresh-secret';

const expiresIn = '30m';
const refreshExpiresIn = '7d';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

function createToken(payload) {
    return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

function createRefreshToken(payload) {
    return jwt.sign(payload, REFRESH_SECRET_KEY, { expiresIn: refreshExpiresIn });
}

function verifyToken(token) {
    return jwt.verify(token, SECRET_KEY, (err, decode) => decode !== undefined ? decode : err);
}

function verifyRefreshToken(token) {
    return jwt.verify(token, REFRESH_SECRET_KEY, (err, decode) => decode !== undefined ? decode : err);
}

async function isAuthenticated({ username, password }) {
    const user = await User.findOne({ where: { username } });
    if (!user) return false;
    return bcrypt.compareSync(password, user.password);
}

// Импортируйте модели и ассоциации
const db = require('./models');
const User = db.User;
const Dog = db.Dog;
const RefreshToken = db.RefreshToken; // Импорт модели RefreshToken

// Middleware для проверки авторизации
app.use((req, res, next) => {
    if (req.originalUrl === '/api-docs' || req.originalUrl.startsWith('/api-docs/') || req.originalUrl === '/auth/register' || req.originalUrl === '/auth/login' || req.originalUrl === '/auth/refresh-token') {
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader.split(' ')[0] !== 'Bearer') {
        res.status(401).json({ message: 'Bad authorization header' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const verifyTokenResult = verifyToken(token);

        if (verifyTokenResult instanceof Error) {
            res.status(401).json({ message: 'Error: access_token is not valid' });
            return;
        }
        req.user = verifyTokenResult;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token not valid' });
    }
});

app.post('/auth/register', [
    check('username').isLength({ min: 5 }).withMessage('Username must be at least 5 chars long'),
    check('password').isLength({ min: 5 }).withMessage('Password must be at least 5 chars long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });

    if (user) {
        res.status(401).json({ message: 'User already exists' });
        return;
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    await User.create({ username, password: hashedPassword });

    res.status(200).json({ message: 'User created successfully' });
});

app.post('/auth/login', [
    check('username').isLength({ min: 5 }).withMessage('Username must be at least 5 chars long'),
    check('password').isLength({ min: 5 }).withMessage('Password must be at least 5 chars long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { username, password } = req.body;

    if (!await isAuthenticated({ username, password })) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }

    const user = await User.findOne({ where: { username } });
    const access_token = createToken({ username: user.username, id: user.id });
    const refresh_token = createRefreshToken({ username: user.username, id: user.id });

    // Сохранение рефреш токена в базе данных
    await RefreshToken.create({ token: refresh_token, userId: user.id });

    res.status(200).json({ access_token, refresh_token, userId: user.id });
});

app.post('/auth/refresh-token', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(401).json({ message: 'Refresh token not provided' });
    }

    try {
        const decoded = verifyRefreshToken(refresh_token);

        const tokenInDb = await RefreshToken.findOne({ where: { token: refresh_token, userId: decoded.id } });
        if (!tokenInDb) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const new_access_token = createToken({ username: decoded.username, id: decoded.id });
        const new_refresh_token = createRefreshToken({ username: decoded.username, id: decoded.id });

        // Обновление рефреш токена в базе данных
        await tokenInDb.update({ token: new_refresh_token });

        res.status(200).json({ access_token: new_access_token, refresh_token: new_refresh_token });
    } catch (err) {
        res.status(401).json({ message: 'Invalid refresh token' });
    }
});

// Маршруты для профиля пользователя
app.get('/users/:id/profile', async (req, res) => {
    const user = await User.findByPk(req.params.id, {
        include: [Dog]
    });
    if (!user) {
        res.status(404).json({});
        return;
    }
    res.status(200).json({
        id: user.id,
        username: user.username,
        name: user.name,
        city: user.city,
        birthdate: user.birthdate,
        dogs: user.Dogs // Добавление списка собак пользователя
    });
});

app.put('/users/:id/profile', async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) {
        res.status(404).json({});
        return;
    }
    await user.update(req.body);
    res.status(200).json({});
});

// Маршруты для работы с собаками
app.get('/dogs', async (req, res) => {
    const dogs = await Dog.findAll();
    res.status(200).json(dogs);
});

app.get('/dogs/:id', async (req, res) => {
    const dog = await Dog.findByPk(req.params.id);
    if (!dog) {
        res.status(404).json({});
        return;
    }
    res.status(200).json(dog);
});

app.post('/dogs', async (req, res) => {
    const newDog = req.body;
    newDog.ownerId = req.user.id;
    const dog = await Dog.create(newDog);
    res.status(200).json(dog);
});

app.put('/dogs/:id', async (req, res) => {
    const dog = await Dog.findByPk(req.params.id);
    if (!dog || dog.ownerId !== req.user.id) {
        res.status(404).json({ message: 'Dog not found or access denied' });
        return;
    }
    await dog.update(req.body);
    res.status(200).json({});
});

app.delete('/dogs/:id', async (req, res) => {
    const dog = await Dog.findByPk(req.params.id);
    if (!dog || dog.ownerId !== req.user.id) {
        res.status(404).json({ message: 'Dog not found or access denied' });
        return;
    }
    await dog.destroy();
    res.status(200).json({});
});

// Маршрут для создания собаки и добавления её в профиль пользователя
app.post('/users/:id/dogs', async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const newDog = req.body;
    newDog.ownerId = user.id;

    const dog = await Dog.create(newDog);
    res.status(200).json(dog);
});

// Маршрут для получения всех собак пользователя
app.get('/users/:id/dogs', async (req, res) => {
    const user = await User.findByPk(req.params.id, { include: Dog });
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.status(200).json(user.Dogs);
});

// Убедитесь, что путь к Swagger UI правильный
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

db.sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
});