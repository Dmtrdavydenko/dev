// 🚫 Никаких require('express'), 'dotenv', 'axios' — только встроенные модули

const https = require('https');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');

// Загружаем переменные окружения из .env (ручная загрузка)
function loadEnv() {
    const env = {};
    try {
        const data = fs.readFileSync('.env', 'utf8');
        data.split('\n').forEach(line => {
            const [key, value] = line.trim().split('=');
            if (key) env[key] = value;
        });
    } catch (err) {
        console.warn('⚠️ .env не найден — переменные окружения не загружены');
    }
    return env;
}

//const ENV = loadEnv();

// Хранилище токенов (в памяти — для демо)
let accessToken = null;
let refreshToken = null;

// Порт от Railway
const PORT = process.env.PORT || 3000;

// Функция: отправить HTML-ответ
function sendHtml(res, html) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

// Функция: отправить JSON-ответ
function sendJson(res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
}

// Функция: сделать HTTP-запрос к HH API (POST или GET)
function httpPost(options, data, callback) {
    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(body);
                callback(null, result);
            } catch (err) {
                callback(new Error('Invalid JSON: ' + body), null);
            }
        });
    });

    req.on('error', callback);
    req.write(data);
    req.end();
}

function httpGet(options, callback) {
    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(body);
                callback(null, result);
            } catch (err) {
                callback(new Error('Invalid JSON: ' + body), null);
            }
        });
    });

    req.on('error', callback);
    req.end();
}

// Главный HTTP-сервер
const server = https.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    console.log({ parsedUrl, path })
    // Главная страница
    if (path === '/') {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.write("404 Not Found");
        res.end();
        
    //    sendHtml(res, `
    //  <h1>🌐 HH.ru OAuth (без библиотек)</h1>
    //  <p><a href="/auth">🔗 Авторизоваться через HH.ru</a></p>
    //  <p><a href="/vacancies">📊 Проверить вакансии</a></p>
    //  <p><small>Токен хранится в памяти — после перезапуска нужно войти заново.</small></p>
    //`);

        // Шаг 1: Перенаправление на HH для авторизации
    } else if (path === '/auth') {
        const authUrl = new URL('https://hh.ru/oauth/authorize');
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('client_id', ENV.HH_CLIENT_ID || process.env.HH_CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', ENV.HH_REDIRECT_URI || process.env.HH_REDIRECT_URI);

        res.writeHead(302, { Location: authUrl.toString() });
        res.end();

        // Шаг 2: Callback от HH — обмен кода на токен
    } else if (path === '/auth/callback') {
        const { code } = parsedUrl.query;

        if (!code) {
            sendHtml(res, '<h1>❌ Код авторизации не получен</h1><p><a href="/">Назад</a></p>');
            return;
        }

        const postData = querystring.stringify({
            grant_type: 'authorization_code',
            client_id: ENV.HH_CLIENT_ID || process.env.HH_CLIENT_ID,
            client_secret: ENV.HH_CLIENT_SECRET || process.env.HH_CLIENT_SECRET,
            code: code,
            redirect_uri: ENV.HH_REDIRECT_URI || process.env.HH_REDIRECT_URI
        });

        const options = {
            hostname: 'hh.ru',
            port: 443,
            path: '/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        };

        httpPost(options, postData, (err, data) => {
            if (err) {
                console.error('❌ Ошибка обмена кода на токен:', err.message);
                sendHtml(res, `<h1>❌ Ошибка: ${err.message}</h1><p><a href="/">Назад</a></p>`);
                return;
            }

            accessToken = data.access_token;
            refreshToken = data.refresh_token;

            console.log('✅ Токены получены:');
            console.log('Access Token:', accessToken);
            console.log('Refresh Token:', refreshToken);

            sendHtml(res, `
        <h1>✅ Успешно!</h1>
        <p>Токен получен. Теперь вы можете использовать <a href="/vacancies">/vacancies</a></p>
      `);
        });

        // Шаг 3: Получить вакансии
    } else if (path === '/vacancies') {
        if (!accessToken) {
            sendHtml(res, `
        <h1>🔒 Не авторизованы</h1>
        <p><a href="/auth">Войти через HH.ru</a></p>
      `);
            return;
        }

        const options = {
            hostname: 'api.hh.ru',
            port: 443,
            path: '/vacancies?per_page=5&text=JavaScript&area=1',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'MyApp/1.0 (your-email@example.com)'
            }
        };

        httpGet(options, (err, data) => {
            if (err) {
                if (err.message.includes('401')) {
                    accessToken = null; // Токен устарел
                    sendHtml(res, `
            <h1>🔒 Токен устарел</h1>
            <p><a href="/auth">Войти заново</a></p>
          `);
                } else {
                    sendHtml(res, `<h1>❌ Ошибка: ${err.message}</h1><p><a href="/">Назад</a></p>`);
                }
                return;
            }

            sendJson(res, data);
        });

        // Неизвестный путь
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p><a href="/">На главную</a></p>');
    }
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Доступно по: https://${process.env.VELOCITY_PROJECT_ID}.up.railway.app`);
});