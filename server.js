const http = require('http');
const url = require('url');

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
  });

  const html = `
    <html>
      <head><title>HTTPS Server on Railway</title></head>
      <body>
        <h1>✅ Успешно запущено на Railway!</h1>
        <p><strong>Запрошенный путь:</strong> ${encodeURIComponent(pathname)}</p>
        <p><strong>Параметры запроса:</strong> ${JSON.stringify(query)}</p>
        <p>🚀 Сервер работает через Railway — HTTPS <em>автоматически</em> включён!</p>
        <p>Твой адрес: <a href="https://${process.env.VELOCITY_PROJECT_URL}" target="_blank">https://${process.env.VELOCITY_PROJECT_URL}</a></p>
        <hr>
        <p>Попробуй: <a href="/?name=John&age=30">/name=John&age=30</a></p>
      </body>
    </html>
  `;

  res.end(html);
}

// Используем HTTP, а не HTTPS — Railway сам добавит SSL
const server = http.createServer(handleRequest);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HTTP сервер запущен на порту ${PORT}`);
  console.log('Railway автоматически включит HTTPS для твоего проекта.');
});
