export function renderLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic Factory - Entrar</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b14;
      --panel: rgba(15, 23, 42, 0.86);
      --border: rgba(148, 163, 184, 0.18);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --danger: #fca5a5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.12), transparent 34%),
        radial-gradient(circle at 85% 8%, rgba(167, 139, 250, 0.13), transparent 30%),
        var(--bg);
    }
    form {
      width: min(380px, 100%);
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
    }
    .eyebrow {
      margin: 0 0 6px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #7dd3fc;
    }
    h1 { margin: 0 0 22px; font-size: 1.5rem; letter-spacing: -0.02em; }
    label { display: block; margin: 14px 0 6px; font-size: 0.85rem; color: var(--muted); }
    input {
      width: 100%;
      padding: 11px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(2, 6, 23, 0.6);
      color: var(--text);
      font: inherit;
    }
    input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
    button {
      width: 100%;
      margin-top: 22px;
      padding: 12px;
      border: 0;
      border-radius: 10px;
      background: var(--accent);
      color: #04111d;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled { opacity: 0.6; cursor: wait; }
    .error { min-height: 1.2em; margin: 14px 0 0; color: var(--danger); font-size: 0.85rem; }
  </style>
</head>
<body>
  <form id="login">
    <p class="eyebrow">Agentic Factory</p>
    <h1>Entrar</h1>
    <label for="username">Usuario</label>
    <input id="username" name="username" autocomplete="username" required autofocus>
    <label for="password">Contraseña</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Entrar</button>
    <p class="error" id="error" role="alert"></p>
  </form>
  <script>
    (function () {
      'use strict';
      var form = document.getElementById('login');
      var error = document.getElementById('error');
      var button = form.querySelector('button');

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        error.textContent = '';
        button.disabled = true;

        try {
          var response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: form.username.value,
              password: form.password.value
            })
          });

          if (response.ok) {
            location.href = '/factory/app';
            return;
          }

          var data = await response.json().catch(function () { return {}; });
          error.textContent = data.message || ('Error ' + response.status);
        } catch (e) {
          error.textContent = 'No se pudo conectar con la API';
        } finally {
          button.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}
