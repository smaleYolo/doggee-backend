const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');
const { check, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 3001;

const SECRET_KEY = 'doggee-secret';
const REFRESH_SECRET_KEY = 'doggee-refresh-secret';

const expiresIn = '30m';
const refreshExpiresIn = '7d';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Настраиваем CORS
app.use(
    cors({
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        optionsSuccessStatus: 204
    })
);

// Middleware для обработки preflight-запросов
app.options('*', cors());

function createToken(payload) {
    return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

function createRefreshToken(payload) {
    return jwt.sign(payload, REFRESH_SECRET_KEY, { expiresIn: refreshExpiresIn });
}

function verifyToken(token) {
    return jwt.verify(token, SECRET_KEY, (err, decode) =>
        decode !== undefined ? decode : err
    );
}

function verifyRefreshToken(token) {
    return jwt.verify(token, REFRESH_SECRET_KEY, (err, decode) =>
        decode !== undefined ? decode : err
    );
}

async function isAuthenticated({ username, password }) {
    const user = await User.findOne({ where: { username } });
    if (!user) return false;
    return bcrypt.compareSync(password, user.password);
}

// Импортируйте модели и ассоциации
const db = require('../models');
const User = db.User;
const Dog = db.Dog;
const RefreshToken = db.RefreshToken; // Импорт модели RefreshToken

// Middleware для проверки авторизации
app.use((req, res, next) => {
    if (
        req.originalUrl === '/api-docs' ||
        req.originalUrl.startsWith('/api-docs/') ||
        req.originalUrl === '/auth/register' ||
        req.originalUrl === '/auth/login' ||
        req.originalUrl === '/auth/refresh-token'
    ) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader.split(' ')[0] !== 'Bearer') {
        res.status(401).json({ message: 'backend.failure.badAuthorizationHeader' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const verifyTokenResult = verifyToken(token);

        if (verifyTokenResult instanceof Error) {
            res.status(401).json({ message: 'backend.failure.invalidAccessToken' });
            return;
        }
        req.user = verifyTokenResult;
        next();
    } catch (err) {
        res.status(401).json({ message: 'backend.failure.invalidToken' });
    }
});

app.post(
    '/auth/register',
    [
        check('username')
            .isLength({ min: 5 })
            .withMessage('backend.failure.usernameMinLength'),
        check('password')
            .isLength({ min: 5 })
            .withMessage('backend.failure.passwordMinLength'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, password } = req.body;
        const existingUser = await User.findOne({ where: { username } });

        if (existingUser) {
            res.status(401).json({ message: 'backend.failure.userAlreadyExists' });
            return;
        }

        const hashedPassword = bcrypt.hashSync(password, 8);
        const user = await User.create({ username, password: hashedPassword });

        // Создание токенов для нового пользователя
        const access_token = createToken({ username: user.username, id: user.id });
        const refresh_token = createRefreshToken({
            username: user.username,
            id: user.id,
        });

        // Сохранение рефреш токена в базе данных
        await RefreshToken.create({ token: refresh_token, userId: user.id });

        // Возвращение токенов и данных пользователя в ответе
        res.status(201).json({
            message: 'backend.success.userCreated',
            access_token,
            refresh_token,
            userId: user.id,
        });
    }
);

app.post(
    '/auth/login',
    [
        check('username')
            .isLength({ min: 5 })
            .withMessage('backend.failure.usernameMinLength'),
        check('password')
            .isLength({ min: 5 })
            .withMessage('backend.failure.passwordMinLength'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, password } = req.body;

        if (!(await isAuthenticated({ username, password }))) {
            res.status(401).json({ message: 'backend.failure.invalidCredentials' });
            return;
        }

        const user = await User.findOne({ where: { username } });
        const access_token = createToken({ username: user.username, id: user.id });
        const refresh_token = createRefreshToken({
            username: user.username,
            id: user.id,
        });

        // Сохранение рефреш токена в базе данных
        await RefreshToken.create({ token: refresh_token, userId: user.id });

        res.status(200).json({
            message: 'backend.success.userLogin',
            access_token,
            refresh_token,
            userId: user.id,
        });
    }
);

app.post('/auth/refresh-token', async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(401).json({ message: 'backend.failure.refreshTokenNotProvided' });
    }

    try {
        const decoded = verifyRefreshToken(refresh_token);

        const tokenInDb = await RefreshToken.findOne({
            where: { token: refresh_token, userId: decoded.id },
        });
        if (!tokenInDb) {
            return res.status(401).json({ message: 'backend.failure.invalidRefreshToken' });
        }

        const new_access_token = createToken({
            username: decoded.username,
            id: decoded.id,
        });
        const new_refresh_token = createRefreshToken({
            username: decoded.username,
            id: decoded.id,
        });

        // Обновление рефреш токена в базе данных
        await tokenInDb.update({ token: new_refresh_token });

        res.status(200).json({
            message: 'backend.success.tokenRefreshed',
            access_token: new_access_token,
            refresh_token: new_refresh_token,
        });
    } catch (err) {
        res.status(401).json({ message: 'backend.failure.invalidRefreshToken' });
    }
});

// Маршруты для профиля пользователя
app.get('/users/:id/profile', async (req, res) => {
    const user = await User.findByPk(req.params.id, {
        include: [Dog],
    });
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }
    res.status(200).json({
        message: 'backend.success.userProfileRetrieved',
        id: user.id,
        username: user.username,
        name: user.name,
        city: user.city,
        birthdate: user.birthdate,
        dogs: user.Dogs, // Добавление списка собак пользователя
    });
});

app.put('/users/:id/profile', async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }
    await user.update(req.body);
    res.status(200).json({ message: 'backend.success.profileUpdated' });
});

// Создание собаки для пользователя
app.post('/users/:id/dogs', [
    check('name').notEmpty().withMessage('backend.failure.nameRequired'),
    check('weight').isFloat({ min: 0 }).withMessage('backend.failure.positiveWeight'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }

    const newDog = req.body;
    newDog.ownerId = user.id;

    const dog = await Dog.create(newDog);
    res.status(201).json({
        message: 'backend.success.dogCreated',
        dog
    });
});

// Предопределённый список пород собак
const dogBreeds = [
    'dogBreeds.LabradorRetriever',
    'dogBreeds.GermanShepherd',
    'dogBreeds.GoldenRetriever',
    'dogBreeds.FrenchBulldog',
    'dogBreeds.Bulldog',
    'dogBreeds.Poodle',
    'dogBreeds.Beagle',
    'dogBreeds.Rottweiler',
    'dogBreeds.GermanShorthairedPointer',
    'dogBreeds.YorkshireTerrier',
    'dogBreeds.Boxer',
    'dogBreeds.Dachshund',
    'dogBreeds.PembrokeWelshCorgi',
    'dogBreeds.SiberianHusky',
    'dogBreeds.AustralianShepherd',
    'dogBreeds.GreatDane',
    'dogBreeds.DobermanPinscher',
    'dogBreeds.CavalierKingCharlesSpaniel',
    'dogBreeds.MiniatureSchnauzer',
    'dogBreeds.ShihTzu',
    'dogBreeds.BostonTerrier',
    'dogBreeds.BerneseMountainDog',
    'dogBreeds.Pomeranian',
    'dogBreeds.Havanese',
    'dogBreeds.ShetlandSheepdog',
    'dogBreeds.Brittany',
    'dogBreeds.EnglishSpringerSpaniel',
    'dogBreeds.Pug',
    'dogBreeds.Mastiff',
    'dogBreeds.CockerSpaniel',
    'dogBreeds.Vizsla',
    'dogBreeds.CaneCorso',
    'dogBreeds.Chihuahua',
    'dogBreeds.BorderCollie',
    'dogBreeds.BassetHound',
    'dogBreeds.BelgianMalinois',
    'dogBreeds.WestHighlandWhiteTerrier',
    'dogBreeds.Collie',
    'dogBreeds.Weimaraner',
    'dogBreeds.Newfoundland',
    'dogBreeds.RhodesianRidgeback',
    'dogBreeds.ShibaInu',
    'dogBreeds.BichonFrise',
    'dogBreeds.Akita',
    'dogBreeds.StBernard',
    'dogBreeds.Bloodhound',
    'dogBreeds.ChesapeakeBayRetriever',
    'dogBreeds.Samoyed',
    'dogBreeds.AustralianCattleDog',
    'dogBreeds.Whippet'
];

// Маршрут для получения списка пород
app.get('/breeds', async (req, res) => {
    try {
        res.status(200).json({
            message: 'backend.success.breedsRetrieved',
            data: dogBreeds
        });
    } catch (error) {
        res.status(500).json({ message: 'backend.failure.errorRetrievingBreeds', error });
    }
});

// Получение списка собак пользователя
app.get('/users/:id/dogs', async (req, res) => {
    const user = await User.findByPk(req.params.id, { include: Dog });
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }
    res.status(200).json({
        message: 'backend.success.userDogsRetrieved',
        dogs: user.Dogs
    });
});

// Получение данных о конкретной собаке пользователя
app.put('/users/:userId/dogs/:dogId', [
    check('weight').optional().isFloat({ min: 0 }).withMessage('backend.failure.positiveWeight'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findByPk(req.params.userId, { include: Dog });
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }

    const dog = user.Dogs.find(d => d.id === parseInt(req.params.dogId));
    if (!dog) {
        res.status(404).json({ message: 'backend.failure.dogNotFound' });
        return;
    }

    if (dog.ownerId !== req.user.id) {
        res.status(403).json({ message: 'backend.failure.accessDenied' });
        return;
    }

    await dog.update(req.body);
    res.status(200).json({
        message: 'backend.success.dogUpdated',
        dog
    });
});

// Обновление конкретной собаки пользователя
app.put('/users/:userId/dogs/:dogId', async (req, res) => {
    const user = await User.findByPk(req.params.userId, { include: Dog });
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }

    const dog = user.Dogs.find(d => d.id === parseInt(req.params.dogId));
    if (!dog) {
        res.status(404).json({ message: 'backend.failure.dogNotFound' });
        return;
    }

    if (dog.ownerId !== req.user.id) {
        res.status(403).json({ message: 'backend.failure.accessDenied' });
        return;
    }

    await dog.update(req.body);
    res.status(200).json({
        message: 'backend.success.dogUpdated',
        dog
    });
});

// Удаление конкретной собаки пользователя
app.delete('/users/:userId/dogs/:dogId', async (req, res) => {
    const user = await User.findByPk(req.params.userId, { include: Dog });
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }

    const dog = user.Dogs.find(d => d.id === parseInt(req.params.dogId));
    if (!dog) {
        res.status(404).json({ message: 'backend.failure.dogNotFound' });
        return;
    }

    if (dog.ownerId !== req.user.id) {
        res.status(403).json({ message: 'backend.failure.accessDenied' });
        return;
    }

    await dog.destroy();
    res.status(200).json({ message: 'backend.success.dogDeleted' });
});

// Убедитесь, что путь к Swagger UI правильный
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

db.sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
});