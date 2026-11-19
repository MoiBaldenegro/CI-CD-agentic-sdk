export function renderManualApp(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic Factory - Nueva tarea</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b14;
      --panel: rgba(15, 23, 42, 0.82);
      --panel-strong: rgba(15, 23, 42, 0.96);
      --border: rgba(148, 163, 184, 0.16);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --subtle: #64748b;
      --accent: #38bdf8;
      --accent-ink: #04111d;
      --ok: #86efac;
      --warn: #fcd34d;
      --danger: #fca5a5;
      --violet: #c4b5fd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.12), transparent 34%),
        radial-gradient(circle at 85% 8%, rgba(167, 139, 250, 0.13), transparent 30%),
        var(--bg);
    }
    .shell { width: min(860px, 100%); margin: 0 auto; padding: 28px 16px 48px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    .eyebrow { margin: 0 0 6px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #7dd3fc; }
    h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.1rem); letter-spacing: -0.03em; }
    .subtitle { margin: 8px 0 0; color: var(--muted); font-size: 0.9rem; }
    .nav { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; font-size: 0.85rem; color: var(--muted); }
    .nav a { color: var(--accent); text-decoration: none; }
    .panel { border: 1px solid var(--border); border-radius: 16px; background: var(--panel); box-shadow: 0 18px 48px rgba(0,0,0,0.3); }
    .chat { display: flex; flex-direction: column; gap: 12px; padding: 18px; min-height: 220px; max-height: 52vh; overflow-y: auto; }
    .empty { margin: auto; text-align: center; color: var(--subtle); font-size: 0.9rem; max-width: 420px; line-height: 1.5; }
    .bubble { max-width: 85%; padding: 11px 14px; border-radius: 14px; line-height: 1.5; font-size: 0.93rem; white-space: pre-wrap; overflow-wrap: anywhere; }
    .bubble.user { align-self: flex-end; background: rgba(56, 189, 248, 0.16); border: 1px solid rgba(56, 189, 248, 0.3); }
    .bubble.assistant { align-self: flex-start; background: var(--panel-strong); border: 1px solid var(--border); }
    .bubble.assistant ol { margin: 6px 0 0; padding-left: 20px; white-space: normal; }
    .bubble.thinking { color: var(--muted); font-style: italic; }
    .bubble.error { border-color: rgba(248, 113, 113, 0.4); color: var(--danger); }
    .composer { display: flex; gap: 10px; padding: 14px; border-top: 1px solid var(--border); }
    textarea, input, select {
      width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;
      background: rgba(2, 6, 23, 0.6); color: var(--text); font: inherit; font-size: 0.93rem;
    }
    textarea { resize: vertical; }
    textarea:focus, input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
    .composer textarea { min-height: 48px; max-height: 200px; }
    button {
      padding: 10px 16px; border: 0; border-radius: 10px; background: var(--accent); color: var(--accent-ink);
      font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    button.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); font-weight: 600; }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .draft, .tracking { margin-top: 18px; padding: 20px; }
    .draft h2, .tracking h2 { margin: 0 0 4px; font-size: 1.1rem; }
    .hint { margin: 0 0 16px; color: var(--muted); font-size: 0.85rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.full { grid-column: 1 / -1; }
    .field label { font-size: 0.8rem; color: var(--muted); }
    .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
    .status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; border: 1px solid currentColor; }
    .status.QUEUED, .status.PENDING { color: var(--muted); }
    .status.IN_PROGRESS { color: var(--accent); }
    .status.IN_REVIEW { color: var(--violet); }
    .status.BLOCKED { color: var(--warn); }
    .status.COMPLETED { color: var(--ok); }
    .status.FAILED, .status.CANCELLED { color: var(--danger); }
    .summary { margin: 14px 0 0; padding: 12px 14px; border-radius: 10px; background: rgba(2, 6, 23, 0.5); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.88rem; line-height: 1.5; }
    .meta { margin: 10px 0 0; font-size: 0.85rem; color: var(--muted); overflow-wrap: anywhere; }
    .meta a { color: var(--accent); }
    [hidden] { display: none !important; }
    @media (max-width: 600px) {
      header { flex-direction: column; }
      .nav { justify-content: flex-start; }
      .grid { grid-template-columns: 1fr; }
      .bubble { max-width: 100%; }
      .composer { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div>
        <p class="eyebrow">Agentic Factory</p>
        <h1>Nueva tarea</h1>
        <p class="subtitle">Describe lo que quieres. Si falta información, el asistente te pregunta.</p>
      </div>
      <div class="nav">
        <span id="who"></span>
        <a href="/factory/dashboard">Tablero</a>
        <button class="secondary" id="logout" hidden>Salir</button>
      </div>
    </header>

    <section class="panel">
      <div class="chat" id="chat" aria-live="polite">
        <p class="empty" id="empty">Ejemplo: <em>"Quiero una landing page para mi cafetería con menú y ubicación"</em>.</p>
      </div>
      <form class="composer" id="composer">
        <textarea id="input" rows="2" placeholder="Escribe tu pedido o responde las preguntas…" required></textarea>
        <button type="submit" id="send">Enviar</button>
      </form>
    </section>

    <section class="panel draft" id="draft" hidden>
      <h2>Ficha de la tarea</h2>
      <p class="hint">Revísala y ajústala antes de enviarla a la fábrica.</p>
      <form id="draftForm">
        <div class="grid">
          <div class="field full"><label for="title">Título</label><input id="title" maxlength="200" required></div>
          <div class="field"><label for="owner">Dueño en GitHub</label><input id="owner" required pattern="[A-Za-z0-9._-]+"></div>
          <div class="field"><label for="repo">Repositorio</label><input id="repo" required pattern="[A-Za-z0-9._-]+"></div>
          <div class="field"><label for="visibility">Visibilidad</label>
            <select id="visibility"><option value="private">Privado</option><option value="public">Público</option></select>
          </div>
          <div class="field full"><label for="description">Descripción para el agente</label><textarea id="description" rows="8" maxlength="20000" required></textarea></div>
          <div class="field full"><label for="criteria">Criterios de aceptación (uno por línea)</label><textarea id="criteria" rows="4"></textarea></div>
        </div>
        <div class="actions">
          <button type="button" class="secondary" id="keepTalking">Seguir ajustando</button>
          <button type="submit" id="create">Crear tarea</button>
        </div>
      </form>
    </section>

    <section class="panel tracking" id="tracking" hidden>
      <h2>Tarea enviada <span class="status" id="trackStatus"></span></h2>
      <p class="meta" id="trackMeta"></p>
      <div class="summary" id="trackSummary" hidden></div>
      <div class="actions"><button type="button" id="newTask">Nueva tarea</button></div>
    </section>
  </div>

  <script>
    (function () {
      'use strict';

      var TERMINAL = ['IN_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED'];
      var messages = [];
      var defaultOwner = '';
      var pollTimer = null;

      var chat = document.getElementById('chat');
      var empty = document.getElementById('empty');
      var composer = document.getElementById('composer');
      var input = document.getElementById('input');
      var send = document.getElementById('send');
      var draft = document.getElementById('draft');
      var draftForm = document.getElementById('draftForm');
      var tracking = document.getElementById('tracking');

      async function api(path, options) {
        var response = await fetch(path, Object.assign({
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin'
        }, options || {}));

        if (response.status === 401) {
          location.href = '/login';
          throw new Error('Sesión expirada');
        }

        var data = response.status === 204 ? null : await response.json().catch(function () { return null; });

        if (!response.ok) {
          var message = data && data.message;
          throw new Error(Array.isArray(message) ? message.join(', ') : (message || ('HTTP ' + response.status)));
        }

        return data;
      }

      function bubble(role, text, extraClass) {
        empty.hidden = true;
        var div = document.createElement('div');
        div.className = 'bubble ' + role + (extraClass ? ' ' + extraClass : '');
        div.textContent = text;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
        return div;
      }

      function questionsBubble(questions) {
        var div = bubble('assistant', 'Necesito un poco más de información:');
        var list = document.createElement('ol');
        questions.forEach(function (q) {
          var li = document.createElement('li');
          li.textContent = q;
          list.appendChild(li);
        });
        div.appendChild(list);
        chat.scrollTop = chat.scrollHeight;
      }

      function setBusy(busy) {
        send.disabled = busy;
        input.disabled = busy;
      }

      composer.addEventListener('submit', async function (event) {
        event.preventDefault();
        var text = input.value.trim();
        if (!text) return;

        messages.push({ role: 'user', content: text });
        bubble('user', text);
        input.value = '';
        draft.hidden = true;
        setBusy(true);
        var thinking = bubble('assistant', 'Pensando… (puede tardar unos segundos)', 'thinking');

        try {
          var result = await api('/factory/intake', {
            method: 'POST',
            body: JSON.stringify({ messages: messages })
          });
          thinking.remove();

          if (result.status === 'questions') {
            messages.push({ role: 'assistant', content: result.questions.map(function (q, i) { return (i + 1) + '. ' + q; }).join('\\n') });
            questionsBubble(result.questions);
          } else {
            messages.push({ role: 'assistant', content: 'Ficha lista: ' + result.task.title });
            bubble('assistant', 'Tengo todo lo necesario. Revisa la ficha abajo.');
            showDraft(result.task);
          }
        } catch (error) {
          thinking.remove();
          messages.pop();
          bubble('assistant', error.message + ' Tu mensaje no se perdió, vuelve a enviarlo.', 'error');
          input.value = text;
        } finally {
          setBusy(false);
          input.focus();
        }
      });

      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          composer.requestSubmit();
        }
      });

      function showDraft(task) {
        document.getElementById('title').value = task.title;
        document.getElementById('owner').value = task.owner || defaultOwner;
        document.getElementById('repo').value = task.repositoryName;
        document.getElementById('visibility').value = task.visibility;
        document.getElementById('description').value = task.description;
        document.getElementById('criteria').value = (task.acceptanceCriteria || []).join('\\n');
        draft.hidden = false;
        draft.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      document.getElementById('keepTalking').addEventListener('click', function () {
        draft.hidden = true;
        input.placeholder = 'Dime qué quieres cambiar de la ficha…';
        input.focus();
      });

      draftForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var create = document.getElementById('create');
        create.disabled = true;

        var owner = document.getElementById('owner').value.trim();
        var repo = document.getElementById('repo').value.trim();

        try {
          var result = await api('/factory/tasks', {
            method: 'POST',
            body: JSON.stringify({
              title: document.getElementById('title').value.trim(),
              description: document.getElementById('description').value.trim(),
              source: 'MANUAL',
              repository: { owner: owner, name: repo, baseBranch: 'main' },
              acceptanceCriteria: document.getElementById('criteria').value
                .split('\\n').map(function (l) { return l.trim(); }).filter(Boolean),
              metadata: { visibility: document.getElementById('visibility').value }
            })
          });

          draft.hidden = true;
          composer.hidden = true;
          startTracking(result.task, owner, repo);
        } catch (error) {
          alert('No se pudo crear la tarea: ' + error.message);
        } finally {
          create.disabled = false;
        }
      });

      function startTracking(task, owner, repo) {
        tracking.hidden = false;
        var meta = document.getElementById('trackMeta');
        meta.textContent = '';
        meta.appendChild(document.createTextNode('ID ' + task.id + ' · Repo: '));
        var link = document.createElement('a');
        link.href = 'https://github.com/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo);
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = owner + '/' + repo;
        meta.appendChild(link);
        renderTask(task);

        clearInterval(pollTimer);
        pollTimer = setInterval(async function () {
          try {
            var current = await api('/factory/tasks/' + encodeURIComponent(task.id));
            renderTask(current);
            if (TERMINAL.indexOf(current.status) !== -1) clearInterval(pollTimer);
          } catch (e) { /* reintenta en el siguiente ciclo */ }
        }, 4000);
      }

      function renderTask(task) {
        var status = document.getElementById('trackStatus');
        status.className = 'status ' + task.status;
        status.textContent = task.status;

        var text = task.completionSummary || task.failureReason || task.blockReason || '';
        if (task.blockReason && task.completionSummary) text = 'Bloqueada: ' + task.blockReason + '\\n\\n' + task.completionSummary;
        var summary = document.getElementById('trackSummary');
        summary.hidden = !text;
        summary.textContent = text;
      }

      document.getElementById('newTask').addEventListener('click', function () {
        clearInterval(pollTimer);
        messages = [];
        chat.querySelectorAll('.bubble').forEach(function (b) { b.remove(); });
        empty.hidden = false;
        tracking.hidden = true;
        composer.hidden = false;
        input.placeholder = 'Escribe tu pedido o responde las preguntas…';
        input.focus();
      });

      document.getElementById('logout').addEventListener('click', async function () {
        await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        location.href = '/login';
      });

      (async function init() {
        try {
          var me = await api('/auth/me');
          if (me.loginEnabled && !me.user) { location.href = '/login'; return; }
          if (me.user) {
            document.getElementById('who').textContent = me.user;
            document.getElementById('logout').hidden = false;
          }
          var defaults = await api('/factory/intake/defaults');
          defaultOwner = defaults.owner || '';
        } catch (e) { /* api() ya redirige si hace falta */ }
        input.focus();
      })();
    })();
  </script>
</body>
</html>`;
}
