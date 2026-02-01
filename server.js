const http = require('http');
const url = require('url');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');



function getAccessToken(code, callback) {
  const postData = querystring.stringify({
    grant_type: 'authorization_code',
    code: process.env.HH_CODE,
    client_id: process.env.HH_CLIENT_ID,
    client_secret: process.env.HH_CLIENT_SECRET,
    redirect_uri: process.env.HH_REDIRECT_URI
  });

  const options = {
    hostname: 'hh.ru',
    path: '/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length,
      'User-Agent': `Ассистент/1.0 (${process.env.MY_CONTACT})`
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const tokenData = JSON.parse(data);
        fs.writeFileSync('./hh-token.json', JSON.stringify(tokenData, null, 2), 'utf8');
        console.log('🎉 УСПЕХ! Токен сохранён в hh-token.json');
        callback(null, tokenData);
      } catch (err) {
        console.error('❌ Ошибка при парсинге ответа HH.ru:', err.message);
        console.error('Ответ:', data);
        callback(new Error('Неверный ответ от HH.ru'), null);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Ошибка соединения с HH.ru:', err.message);
    callback(err, null);
  });

  req.write(postData);
  req.end();
}

//function handleRequest(req, res) {
//  const parsedUrl = url.parse(req.url, true);
//  const pathname = parsedUrl.pathname;
//  const query = parsedUrl.query;

//  res.writeHead(200, {
//    'Content-Type': 'text/html; charset=utf-8',
//  });

//  const html = `
//    <html>
//      <head><title>HTTPS Server on Railway</title></head>
//      <body>
//        <h1>✅ Успешно запущено на Railway!</h1>
//        <p><strong>Запрошенный путь:</strong> ${encodeURIComponent(pathname)}</p>
//        <p><strong>Параметры запроса:</strong> ${JSON.stringify(query)}</p>
//        <p>🚀 Сервер работает через Railway — HTTPS <em>автоматически</em> включён!</p>
//        <p>Твой адрес: <a href="https://${process.env.VELOCITY_PROJECT_URL}" target="_blank">https://${process.env.VELOCITY_PROJECT_URL}</a></p>
//        <hr>
//        <p>Попробуй: <a href="/?name=John&age=30">/name=John&age=30</a></p>
//      </body>
//    </html>
//  `;

//  res.end(html);
//}


function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

    // 📍 Главная страница — ссылка для авторизации
    if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        const authUrl = `https://hh.ru/oauth/authorize?response_type=code&client_id=${process.env.HH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.HH_REDIRECT_URI)}&state=123`;
        res.end(`
      <html>
        <head><title>HH.ru OAuth на Node.js</title></head>
        <body>
          <h1>HH.ru OAuth (чистый Node.js)</h1>
          <p><a href="${authUrl}">👉 Нажмите здесь, чтобы авторизоваться в HH.ru</a></p>
          <p><a href="/auth/token">查看当前 token</a></p>
        </body>
      </html>
    `);
    }else if (pathname === '/code') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const authUrl = `https://hh.ru/oauth/authorize?response_type=code&client_id=${process.env.HH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.HH_REDIRECT_URI)}&state=123`;
    res.end(`
      <html>
        <head><title>HH.ru OAuth на Node.js</title></head>
        <body>
          <h1>HH.ru OAuth (чистый Node.js)</h1>
          <p><a href="${authUrl}">👉 Нажмите здесь, чтобы авторизоваться в HH.ru</a></p>
          <p><a href="/auth/token">查看当前 token</a></p>
        </body>
      </html>
    `);
  }

  // 📍 Callback от HH.ru: /auth/callback?code=xxx&state=123
  else if (pathname === '/auth/callback') {
    const { code, state } = parsedUrl.query;

    if (!code || state !== '123') {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('❌ Неверный код или state');
      return;
    }

    console.log('✅ Получен code от HH.ru:', code);

      getAccessToken(code = process.env.HH_CODE, (err, tokenData) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('❌ Ошибка получения токена: ' + err.message);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head><title>Успешно!</title></head>
            <body>
              <h1>✅ Токен успешно получен!</h1>
              <p>Токен сохранён в файл <code>hh-token.json</code></p>
              <p>Действителен: ${tokenData.expires_in} секунд</p>
              <p>Закройте эту вкладку.</p>
            </body>
          </html>
        `);
      }
    });
  }

  // 📍 Просмотр текущего токена: /auth/token
  else if (pathname === '/auth/token') {
    try {
      const tokenData = fs.readFileSync('./hh-token.json', 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(tokenData);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Токен не найден. Запустите авторизацию.' }));
    }
  }

  // ❌ Неизвестный маршрут
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('❌ 404 Not Found');
  }
}





// Используем HTTP, а не HTTPS — Railway сам добавит SSL
const server = http.createServer(handleRequest);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HTTP сервер запущен на порту ${PORT}`);
  console.log('Railway автоматически включит HTTPS для твоего проекта.');
});