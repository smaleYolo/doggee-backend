const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { check, validationResult } = require('express-validator');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

const db = require('../models');
const User = db.User;
const Dog = db.Dog;
const RefreshToken = db.RefreshToken;

const app = express();
const port = process.env.PORT || 3001;

const SECRET_KEY = 'doggee-secret';
const REFRESH_SECRET_KEY = 'doggee-refresh-secret';

const expiresIn = '30m';
const refreshExpiresIn = '7d';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const allowedOrigins = [
    'http://localhost:5173',
    'https://react-doggee-vite.vercel.app',
    'http://192.168.1.67:3000',
    'http://localhost:3000'
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        optionsSuccessStatus: 204
    })
);

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

// Swagger setup
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Doggee API',
            version: '1.0.0',
            description: 'API documentation for Doggee backend',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'local server',
            },
            {
                url: 'https://backend-doggee.vercel.app',
                description: 'Prod server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{
            bearerAuth: []
        }],
    },
    apis: ['../api/index.js'],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the user
 *         username:
 *           type: string
 *           description: The username of the user
 *         password:
 *           type: string
 *           description: The password of the user
 *     Dog:
 *       type: object
 *       required:
 *         - name
 *         - weight
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the dog
 *         name:
 *           type: string
 *           description: The name of the dog
 *         weight:
 *           type: number
 *           description: The weight of the dog
 */

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: User already exists
 */
app.post('/auth/register', [
    check('username').isLength({ min: 5 }).withMessage('backend.failure.usernameMinLength'),
    check('password').isLength({ min: 5 }).withMessage('backend.failure.passwordMinLength'),
], async (req, res) => {
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

    const access_token = createToken({ username: user.username, id: user.id });
    const refresh_token = createRefreshToken({ username: user.username, id: user.id });

    await RefreshToken.create({ token: refresh_token, userId: user.id });

    res.status(201).json({
        message: 'backend.success.userCreated',
        access_token,
        refresh_token,
        userId: user.id,
    });
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid credentials
 */
app.post('/auth/login', [
    check('username').isLength({ min: 5 }).withMessage('backend.failure.usernameMinLength'),
    check('password').isLength({ min: 5 }).withMessage('backend.failure.passwordMinLength'),
], async (req, res) => {
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
    const refresh_token = createRefreshToken({ username: user.username, id: user.id });

    await RefreshToken.create({ token: refresh_token, userId: user.id });

    res.status(200).json({
        message: 'backend.success.userLogin',
        access_token,
        refresh_token,
        userId: user.id,
    });
});

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
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

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /users/{id}/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user id
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       404:
 *         description: User not found
 */
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
        dogs: user.Dogs,
    });
});

/**
 * @swagger
 * /users/{id}/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               city:
 *                 type: string
 *               birthdate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *       404:
 *         description: User not found
 */
app.put('/users/:id/profile', async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'backend.failure.userNotFound' });
        return;
    }
    await user.update(req.body);
    res.status(200).json({ message: 'backend.success.profileUpdated' });
});

/**
 * @swagger
 * tags:
 *   name: Dogs
 *   description: Dog management endpoints
 */

/**
 * @swagger
 * /users/{id}/dogs:
 *   post:
 *     summary: Add a new dog for the user
 *     tags: [Dogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - weight
 *             properties:
 *               name:
 *                 type: string
 *               weight:
 *                 type: number
 *     responses:
 *       201:
 *         description: Dog created successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User not found
 */
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

/**
 * @swagger
 * /breeds:
 *   get:
 *     summary: Get all dog breeds
 *     tags: [Dogs]
 *     responses:
 *       200:
 *         description: Breeds retrieved successfully
 *       500:
 *         description: Error retrieving breeds
 */

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

/**
 * @swagger
 * /users/{id}/dogs:
 *   get:
 *     summary: Get all dogs for the user
 *     tags: [Dogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user id
 *     responses:
 *       200:
 *         description: User dogs retrieved successfully
 *       404:
 *         description: User not found
 */
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

/**
 * @swagger
 * /users/{userId}/dogs/{dogId}:
 *   put:
 *     summary: Update dog details
 *     tags: [Dogs]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user id
 *       - in: path
 *         name: dogId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The dog id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               weight:
 *                 type: number
 *     responses:
 *       200:
 *         description: Dog updated successfully
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User or dog not found
 *       403:
 *         description: Access denied
 */
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

/**
 * @swagger
 * /users/{userId}/dogs/{dogId}:
 *   delete:
 *     summary: Delete a dog
 *     tags: [Dogs]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user id
 *       - in: path
 *         name: dogId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The dog id
 *     responses:
 *       200:
 *         description: Dog deleted successfully
 *       404:
 *         description: User or dog not found
 *       403:
 *         description: Access denied
 */
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

db.sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
});