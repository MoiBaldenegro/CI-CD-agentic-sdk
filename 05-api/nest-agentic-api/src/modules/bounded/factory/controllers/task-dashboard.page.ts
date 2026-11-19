export function renderTaskDashboard(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic Factory - Tablero de tareas</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b14;
      --panel: rgba(15, 23, 42, 0.78);
      --panel-strong: rgba(15, 23, 42, 0.96);
      --border: rgba(148, 163, 184, 0.16);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --subtle: #64748b;
      --shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.12), transparent 34%),
        radial-gradient(circle at 85% 8%, rgba(167, 139, 250, 0.13), transparent 30%),
        radial-gradient(circle at 50% 100%, rgba(34, 197, 94, 0.08), transparent 36%),
        var(--bg);
    }

    .shell {
      width: min(1900px, 100%);
      margin: 0 auto;
      padding: 30px 24px 48px;
    }

    .top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 22px;
    }

    .eyebrow {
      margin: 0 0 6px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #7dd3fc;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.7rem, 3vw, 2.45rem);
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .subtitle {
      margin: 10px 0 0;
      font-size: 0.9rem;
      color: var(--muted);
    }

    .subtitle strong {
      color: var(--text);
      font-weight: 600;
    }

    .live {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 9px 14px;
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.09);
      color: #86efac;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .live.offline {
      border-color: rgba(248, 113, 113, 0.4);
      background: rgba(248, 113, 113, 0.09);
      color: #fca5a5;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 0 0 currentColor;
      animation: pulse 1.9s infinite;
    }

    .live.offline .live-dot { animation: none; }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0.48); }
      70% { box-shadow: 0 0 0 9px rgba(134, 239, 172, 0); }
      100% { box-shadow: 0 0 0 0 rgba(134, 239, 172, 0); }
    }

    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-bottom: 18px;
    }

    .stat {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.6);
      color: var(--muted);
      font-size: 0.76rem;
    }

    .stat::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 14px var(--accent);
    }

    .stat-value {
      color: var(--text);
      font-size: 0.95rem;
      font-weight: 700;
    }

    .stat-label { white-space: nowrap; }

    .queue {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 18px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.55);
    }

    .queue-title {
      margin-right: 4px;
      color: #7dd3fc;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .queue-chip {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      padding: 5px 9px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      font-size: 0.69rem;
    }

    .queue-chip strong {
      color: var(--text);
      font-size: 0.8rem;
    }

    .queue-chip[data-key="waiting"] { border-color: rgba(56, 189, 248, 0.3); }
    .queue-chip[data-key="active"] { border-color: rgba(245, 158, 11, 0.34); }
    .queue-chip[data-key="completed"] { border-color: rgba(34, 197, 94, 0.32); }
    .queue-chip[data-key="failed"] { border-color: rgba(248, 113, 113, 0.34); }

    .queue.disabled {
      border-style: dashed;
      color: var(--subtle);
    }

    .queue.disabled .queue-title { color: var(--subtle); }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      padding-top: 9px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }

    .action-btn {
      padding: 5px 9px;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: rgba(148, 163, 184, 0.08);
      color: #cbd5e1;
      font: inherit;
      font-size: 0.66rem;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
    }

    .action-btn:hover:not(:disabled) {
      border-color: rgba(148, 163, 184, 0.4);
      background: rgba(148, 163, 184, 0.16);
    }

    .action-btn:disabled {
      opacity: 0.55;
      cursor: wait;
    }

    .action-btn.approve {
      border-color: rgba(34, 197, 94, 0.34);
      color: #86efac;
    }

    .action-btn.requeue {
      border-color: rgba(56, 189, 248, 0.34);
      color: #7dd3fc;
    }

    .action-btn.cancel {
      border-color: rgba(248, 113, 113, 0.3);
      color: #fca5a5;
    }

    .action-btn.approve:hover:not(:disabled) { background: rgba(34, 197, 94, 0.12); }
    .action-btn.requeue:hover:not(:disabled) { background: rgba(56, 189, 248, 0.12); }
    .action-btn.cancel:hover:not(:disabled) { background: rgba(248, 113, 113, 0.12); }

    .error {
      margin-bottom: 16px;
      padding: 12px 14px;
      border: 1px solid rgba(248, 113, 113, 0.4);
      border-radius: 12px;
      background: rgba(127, 29, 29, 0.24);
      color: #fecaca;
      font-size: 0.84rem;
    }

    .board {
      display: flex;
      gap: 14px;
      overflow-x: auto;
      padding: 2px 0 16px;
      scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
    }

    .column {
      display: flex;
      flex: 1 0 248px;
      flex-direction: column;
      min-width: 248px;
      max-width: 360px;
      min-height: 260px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(8, 13, 24, 0.78));
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .column-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 14px 14px 8px;
    }

    .column-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-size: 0.86rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .stage-dot {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 16px var(--accent);
    }

    .column-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      height: 24px;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.5);
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 700;
    }

    .column-hint {
      margin: 0;
      padding: 0 14px 12px;
      color: var(--subtle);
      font-size: 0.72rem;
    }

    .column-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      max-height: 62vh;
      padding: 0 10px 12px;
      overflow-y: auto;
      scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
    }

    .task {
      position: relative;
      padding: 12px;
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 12px;
      background: var(--panel-strong);
      transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }

    .task:hover {
      border-color: rgba(148, 163, 184, 0.32);
      transform: translateY(-1px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
    }

    .task-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 7px;
    }

    .task h3 {
      margin: 0;
      font-size: 0.86rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .priority {
      flex: 0 0 auto;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .priority-low { background: rgba(148, 163, 184, 0.14); color: #cbd5e1; }
    .priority-medium { background: rgba(56, 189, 248, 0.14); color: #7dd3fc; }
    .priority-high { background: rgba(245, 158, 11, 0.16); color: #fcd34d; }
    .priority-critical { background: rgba(244, 63, 94, 0.16); color: #fda4af; }

    .task-desc {
      display: -webkit-box;
      margin: 0 0 10px;
      overflow: hidden;
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .task-meta {
      display: grid;
      gap: 4px;
      padding-top: 9px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.68rem;
      line-height: 1.4;
    }

    .meta-key {
      flex: 0 0 auto;
      color: var(--subtle);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .meta-value {
      overflow: hidden;
      color: #cbd5e1;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .criteria {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 9px;
      padding-top: 9px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }

    .criteria-label {
      width: 100%;
      color: var(--subtle);
      font-size: 0.64rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .criterion {
      max-width: 100%;
      padding: 3px 7px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 6px;
      background: rgba(148, 163, 184, 0.07);
      color: var(--muted);
      font-size: 0.64rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .criterion.more {
      color: #7dd3fc;
      border-color: rgba(56, 189, 248, 0.25);
      background: rgba(56, 189, 248, 0.08);
    }

    .reason {
      margin-top: 9px;
      padding: 8px 9px;
      border-radius: 8px;
      background: rgba(127, 29, 29, 0.2);
      border: 1px solid rgba(248, 113, 113, 0.2);
    }

    .reason-label {
      display: block;
      margin-bottom: 3px;
      color: #fca5a5;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .reason-text {
      margin: 0;
      color: #fecaca;
      font-size: 0.7rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .empty {
      margin: 4px 0;
      padding: 18px 10px;
      border: 1px dashed rgba(148, 163, 184, 0.18);
      border-radius: 10px;
      color: var(--subtle);
      font-size: 0.72rem;
      text-align: center;
    }

    .column[data-status="PENDING"] { --accent: #94a3b8; }
    .column[data-status="QUEUED"] { --accent: #38bdf8; }
    .column[data-status="IN_PROGRESS"] { --accent: #f59e0b; }
    .column[data-status="BLOCKED"] { --accent: #ef4444; }
    .column[data-status="IN_REVIEW"] { --accent: #a78bfa; }
    .column[data-status="COMPLETED"] { --accent: #22c55e; }
    .column[data-status="FAILED"] { --accent: #fb7185; }
    .column[data-status="CANCELLED"] { --accent: #64748b; }

    .stat[data-status="PENDING"] { --accent: #94a3b8; }
    .stat[data-status="QUEUED"] { --accent: #38bdf8; }
    .stat[data-status="IN_PROGRESS"] { --accent: #f59e0b; }
    .stat[data-status="BLOCKED"] { --accent: #ef4444; }
    .stat[data-status="IN_REVIEW"] { --accent: #a78bfa; }
    .stat[data-status="COMPLETED"] { --accent: #22c55e; }
    .stat[data-status="FAILED"] { --accent: #fb7185; }
    .stat[data-status="CANCELLED"] { --accent: #64748b; }

    @media (max-width: 700px) {
      .shell { padding: 22px 14px 36px; }
      .top { flex-direction: column; }
      .live { align-self: flex-start; }
      .column { flex-basis: 82vw; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="top">
      <div>
        <p class="eyebrow">Agentic Factory</p>
        <h1>Tablero de tareas</h1>
        <p class="subtitle"><strong id="total-count">0</strong> tareas - actualización automática cada 2.5 s - <span id="last-update">esperando...</span></p>
      </div>
      <div class="live" id="live">
        <span class="live-dot"></span>
        <span id="live-label">En vivo</span>
      </div>
    </header>

    <section class="stats" id="stats" aria-label="Resumen por etapa"></section>
    <section class="queue" id="queue" aria-label="Estado de la cola"></section>
    <div class="error" id="error" role="alert" aria-live="polite" hidden></div>
    <main class="board" id="board" aria-label="Tareas por etapa"></main>
  </div>

  <script>
    (function () {
      'use strict';

      // API key: se toma de ?key=... (y se recuerda) o de localStorage.
      var apiKey = (function () {
        var fromUrl = new URLSearchParams(location.search).get('key');
        try {
          if (fromUrl) {
            localStorage.setItem('factory-api-key', fromUrl);
            history.replaceState(null, '', location.pathname);
            return fromUrl;
          }
          return localStorage.getItem('factory-api-key') || '';
        } catch (e) {
          return fromUrl || '';
        }
      })();

      function withAuth(headers) {
        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }
        return headers;
      }

      var STAGES = [
        { key: 'PENDING', label: 'Pendientes', hint: 'Esperando asignación' },
        { key: 'QUEUED', label: 'En cola', hint: 'Listas para ejecutarse' },
        { key: 'IN_PROGRESS', label: 'En progreso', hint: 'Ejecutándose ahora' },
        { key: 'BLOCKED', label: 'Bloqueadas', hint: 'Requieren intervención' },
        { key: 'IN_REVIEW', label: 'En revisión', hint: 'Validando resultado' },
        { key: 'COMPLETED', label: 'Completadas', hint: 'Finalizadas con éxito' },
        { key: 'FAILED', label: 'Fallidas', hint: 'Requieren atención' },
        { key: 'CANCELLED', label: 'Canceladas', hint: 'Fuera del flujo' }
      ];

      var REFRESH_MS = 2500;
      var board = document.getElementById('board');
      var stats = document.getElementById('stats');
      var queueBox = document.getElementById('queue');
      var errorBox = document.getElementById('error');
      var totalCount = document.getElementById('total-count');
      var lastUpdate = document.getElementById('last-update');
      var live = document.getElementById('live');
      var liveLabel = document.getElementById('live-label');
      var columns = {};

      function buildBoard() {
        board.innerHTML = '';

        STAGES.forEach(function (stage) {
          var column = document.createElement('section');
          column.className = 'column';
          column.dataset.status = stage.key;

          var head = document.createElement('div');
          head.className = 'column-head';

          var title = document.createElement('div');
          title.className = 'column-title';

          var dot = document.createElement('span');
          dot.className = 'stage-dot';

          var name = document.createElement('span');
          name.textContent = stage.label;

          title.appendChild(dot);
          title.appendChild(name);

          var count = document.createElement('span');
          count.className = 'column-count';
          count.textContent = '0';

          head.appendChild(title);
          head.appendChild(count);

          var hint = document.createElement('p');
          hint.className = 'column-hint';
          hint.textContent = stage.hint;

          var body = document.createElement('div');
          body.className = 'column-body';

          column.appendChild(head);
          column.appendChild(hint);
          column.appendChild(body);
          board.appendChild(column);

          columns[stage.key] = { body: body, count: count };
        });
      }

      function shortId(value) {
        return String(value || '').slice(0, 8);
      }

      function formatDate(value) {
        if (!value) return '-';
        var date = new Date(value);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      }

      function addMeta(container, label, value) {
        var row = document.createElement('div');
        row.className = 'meta-row';

        var key = document.createElement('span');
        key.className = 'meta-key';
        key.textContent = label;

        var content = document.createElement('span');
        content.className = 'meta-value';
        content.textContent = value;
        content.title = value;

        row.appendChild(key);
        row.appendChild(content);
        container.appendChild(row);
      }

      function addReason(card, label, value) {
        if (!value) return;

        var box = document.createElement('div');
        box.className = 'reason';

        var title = document.createElement('span');
        title.className = 'reason-label';
        title.textContent = label;

        var text = document.createElement('p');
        text.className = 'reason-text';
        text.textContent = value;

        box.appendChild(title);
        box.appendChild(text);
        card.appendChild(box);
      }

      function buildTask(task) {
        var card = document.createElement('article');
        card.className = 'task';

        var top = document.createElement('div');
        top.className = 'task-top';

        var title = document.createElement('h3');
        title.textContent = task.title || 'Sin título';

        var priority = document.createElement('span');
        priority.className = 'priority priority-' + String(task.priority || 'MEDIUM').toLowerCase();
        priority.textContent = task.priority || 'MEDIUM';

        top.appendChild(title);
        top.appendChild(priority);
        card.appendChild(top);

        var description = document.createElement('p');
        description.className = 'task-desc';
        description.textContent = task.description || 'Sin descripción';
        card.appendChild(description);

        var meta = document.createElement('div');
        meta.className = 'task-meta';
        addMeta(meta, 'ID', shortId(task.id));
        addMeta(meta, 'Repo', task.repository ? task.repository.owner + '/' + task.repository.name : '-');
        addMeta(meta, 'Fuente', task.source || '-');
        if (task.assignee) {
          addMeta(meta, 'Agente', task.assignee.provider + ':' + task.assignee.agentId);
        }
        addMeta(meta, 'Creada', formatDate(task.createdAt));
        addMeta(meta, 'Actualizada', formatDate(task.updatedAt));
        card.appendChild(meta);

        if (Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length > 0) {
          var criteria = document.createElement('div');
          criteria.className = 'criteria';

          var criteriaLabel = document.createElement('span');
          criteriaLabel.className = 'criteria-label';
          criteriaLabel.textContent = 'Criterios (' + task.acceptanceCriteria.length + ')';
          criteria.appendChild(criteriaLabel);

          task.acceptanceCriteria.slice(0, 3).forEach(function (item) {
            var pill = document.createElement('span');
            pill.className = 'criterion';
            pill.textContent = item;
            criteria.appendChild(pill);
          });

          if (task.acceptanceCriteria.length > 3) {
            var more = document.createElement('span');
            more.className = 'criterion more';
            more.textContent = '+' + (task.acceptanceCriteria.length - 3);
            criteria.appendChild(more);
          }

          card.appendChild(criteria);
        }

        if (task.status === 'BLOCKED') addReason(card, 'Bloqueo', task.blockReason);
        if (task.status === 'FAILED') addReason(card, 'Fallo', task.failureReason);
        if (task.status === 'CANCELLED') addReason(card, 'Cancelación', task.cancellationReason);
        if (task.status === 'COMPLETED') addReason(card, 'Resumen', task.completionSummary);

        addActions(card, task);

        return card;
      }

      function renderStats(tasks) {
        stats.innerHTML = '';

        STAGES.forEach(function (stage) {
          var count = tasks.filter(function (task) { return task.status === stage.key; }).length;

          var stat = document.createElement('div');
          stat.className = 'stat';
          stat.dataset.status = stage.key;

          var value = document.createElement('span');
          value.className = 'stat-value';
          value.textContent = String(count);

          var label = document.createElement('span');
          label.className = 'stat-label';
          label.textContent = stage.label;

          stat.appendChild(value);
          stat.appendChild(label);
          stats.appendChild(stat);
        });
      }

      function queueChip(key, label, value) {
        var chip = document.createElement('span');
        chip.className = 'queue-chip';
        chip.dataset.key = key;

        var strong = document.createElement('strong');
        strong.textContent = String(value);

        var name = document.createElement('span');
        name.textContent = label;

        chip.appendChild(strong);
        chip.appendChild(name);
        return chip;
      }

      function renderQueue(queueStats) {
        queueBox.innerHTML = '';
        queueBox.classList.toggle('disabled', !queueStats || queueStats.enabled === false);

        var title = document.createElement('span');
        title.className = 'queue-title';
        title.textContent = 'Cola Redis';
        queueBox.appendChild(title);

        if (!queueStats || queueStats.enabled === false) {
          var disabled = document.createElement('span');
          disabled.className = 'queue-chip';
          disabled.textContent = 'Deshabilitada';
          queueBox.appendChild(disabled);
          return;
        }

        queueBox.appendChild(queueChip('waiting', 'esperando', queueStats.waiting || 0));
        queueBox.appendChild(queueChip('active', 'activos', queueStats.active || 0));
        queueBox.appendChild(queueChip('completed', 'completados', queueStats.completed || 0));
        queueBox.appendChild(queueChip('failed', 'fallidos', queueStats.failed || 0));
        queueBox.appendChild(queueChip('delayed', 'diferidos', queueStats.delayed || 0));
      }

      async function refreshQueue() {
        try {
          var response = await fetch('/factory/queue/stats', {
            headers: withAuth({ Accept: 'application/json' }),
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }

          renderQueue(await response.json());
        } catch (error) {
          renderQueue({ enabled: false });
        }
      }

      async function postAction(taskId, action, payload) {
        var response = await fetch(
          '/factory/tasks/' + encodeURIComponent(taskId) + '/' + action,
          {
            method: 'POST',
            headers: withAuth({
              Accept: 'application/json',
              'Content-Type': 'application/json'
            }),
            body: payload ? JSON.stringify(payload) : undefined
          }
        );

        if (!response.ok) {
          var message = 'HTTP ' + response.status;

          try {
            var detail = await response.json();
            if (detail && detail.message) message = detail.message;
          } catch (error) {
            // Keep the HTTP status when the body is not JSON.
          }

          throw new Error(message);
        }

        return response.json();
      }

      function addActions(card, task) {
        var specs = [];

        if (task.status === 'IN_REVIEW') {
          specs.push({ label: 'Aprobar', action: 'approve', className: 'approve' });
          specs.push({
            label: 'Cancelar',
            action: 'cancel',
            className: 'cancel',
            payload: { reason: 'Cancelada desde el dashboard' }
          });
        } else if (task.status === 'BLOCKED' || task.status === 'PENDING') {
          specs.push({ label: 'Encolar', action: 'requeue', className: 'requeue' });
          specs.push({
            label: 'Cancelar',
            action: 'cancel',
            className: 'cancel',
            payload: { reason: 'Cancelada desde el dashboard' }
          });
        } else if (task.status === 'QUEUED' || task.status === 'IN_PROGRESS') {
          specs.push({
            label: 'Cancelar',
            action: 'cancel',
            className: 'cancel',
            payload: { reason: 'Cancelada desde el dashboard' }
          });
        }

        if (specs.length === 0) return;

        var actions = document.createElement('div');
        actions.className = 'actions';

        specs.forEach(function (spec) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'action-btn ' + spec.className;
          button.textContent = spec.label;

          button.addEventListener('click', async function () {
            var originalLabel = button.textContent;
            button.disabled = true;
            button.textContent = '...';

            try {
              await postAction(task.id, spec.action, spec.payload);
              await refresh();
            } catch (error) {
              errorBox.hidden = false;
              errorBox.textContent = 'La acción falló: ' + error.message;
              button.disabled = false;
              button.textContent = originalLabel;
            }
          });

          actions.appendChild(button);
        });

        card.appendChild(actions);
      }

      function render(tasks) {
        var grouped = {};
        STAGES.forEach(function (stage) { grouped[stage.key] = []; });

        tasks.forEach(function (task) {
          if (grouped[task.status]) grouped[task.status].push(task);
        });

        STAGES.forEach(function (stage) {
          var target = columns[stage.key];
          var items = grouped[stage.key];

          target.body.innerHTML = '';
          target.count.textContent = String(items.length);

          if (items.length === 0) {
            var empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'Sin tareas';
            target.body.appendChild(empty);
            return;
          }

          items.forEach(function (task) {
            target.body.appendChild(buildTask(task));
          });
        });

        totalCount.textContent = String(tasks.length);
        renderStats(tasks);
      }

      function setLive(isOnline) {
        live.classList.toggle('offline', !isOnline);
        liveLabel.textContent = isOnline ? 'En vivo' : 'Sin conexión';
      }

      async function refresh() {
        try {
          var response = await fetch('/factory/tasks', {
            headers: withAuth({ Accept: 'application/json' }),
            cache: 'no-store'
          });

          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }

          var tasks = await response.json();
          if (!Array.isArray(tasks)) {
            throw new Error('Respuesta inválida');
          }

          render(tasks);
          errorBox.hidden = true;
          lastUpdate.textContent = 'actualizado ' + new Date().toLocaleTimeString('es-MX');
          setLive(true);
        } catch (error) {
          errorBox.hidden = false;
          errorBox.textContent = 'No se pudo actualizar el tablero: ' + error.message;
          lastUpdate.textContent = 'sin conexión';
          setLive(false);
        }

        await refreshQueue();
      }

      buildBoard();
      refresh();
      setInterval(refresh, REFRESH_MS);
    })();
  </script>
</body>
</html>`;
}
