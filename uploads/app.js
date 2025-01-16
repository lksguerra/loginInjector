const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
    },
});

app.use(cors());
app.use(express.json());

const userHomeDirectory = process.env.HOME || process.env.USERPROFILE;
const logFilePath = path.join(userHomeDirectory, 'successful_logins.txt');

const getElementSelector = async (page, key) => {

    const selectors = [
        `#${key}`,
        `input[type="${key}"]`,
        `button[type="${key}"]`, 
        `button[color="${key}"]`,
        `input[placeholder="${key}"]`,
        `input[name="${key}"]`,
        `.${key}`,
        key, 
    ];

    for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) return selector;
    }

    throw new Error(`Elemento não encontrado para o seletor: ${key}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testLogin({ url, login, password, selectors }) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {

        await page.goto(`https://${url}`);

        const loginSelector = await getElementSelector(page, selectors.html_login);
        const passwordSelector = await getElementSelector(page, selectors.html_password);
        const submitSelector = await getElementSelector(page, selectors.html_form);

        await page.type(loginSelector, login);
        await page.type(passwordSelector, password);

        await page.click(submitSelector);
        await page.waitForNavigation();

        const logData = `[SUCCESS] Login bem-sucedido: ${login} em ${url}`;
        console.log(logData);
        fs.appendFileSync(logFilePath, `${logData}\n`);

        io.emit('log', { status: 'success', message: logData });
        await sleep(3000);

        return { status: 'success', login, url };
    } catch (error) {        
        const logData = `[ERROR] Falha no login: ${login} em ${url}`;
        console.error(logData);
        io.emit('log', { status: 'error', message: logData });

        return { status: 'error', login, url, error: error.message };
    } finally {
        await browser.close();
    }
}

app.post('/upload', async (req, res) => {
    const parsedData = req.body;
    try {
        const results = await Promise.all(parsedData.map(data => testLogin(data)));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao processar os logins', details: err.message });
    }
});

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Cliente conectado via WebSocket');
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
