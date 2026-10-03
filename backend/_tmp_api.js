require('dotenv').config();
const app = require('./server');
const server = app.listen(5099, async () => {
  const B = 'http://localhost:5099';
  const out = [];
  const j = async (m, p, body, tok) => {
    const r = await fetch(B + p, {
      method: m,
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  out.push(['no token -> 401', await j('GET', '/api/vehicles')]);
  out.push(['bad token -> 401', await j('GET', '/api/vehicles', null, 'garbage')]);
  out.push(['unknown route -> 404', await j('GET', '/api/nope')]);
  out.push(['login validation -> 400', await j('POST', '/api/auth/login', { email: 'notanemail' })]);
  out.push(['register validation -> 400', await j('POST', '/api/auth/register', { name: 'A', email: 'x@y.com', password: '123' })]);
  out.push(['register as Admin -> 403', await j('POST', '/api/auth/register', { name: 'Evil Admin', email: 'e@f.com', password: 'secret123', role: 'Admin' })]);

  for (const [name, res] of out) {
    console.log(`${String(res.status).padEnd(4)} ${name.padEnd(30)} -> ${JSON.stringify(res.body).slice(0, 130)}`);
  }
  server.close();
});
