use ratatui::{
    layout::{Alignment, Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Cell, Clear, List, ListItem, ListState, Paragraph, Row, Table,
        TableState, Wrap,
    },
    Frame,
};

use crate::app::{App, Connection, FieldKind, Focus, Form, MessageKind, Modal};
use crate::bridge::{AgentDescriptor, Task};

const BG: Color = Color::Rgb(8, 11, 18);
const SURFACE: Color = Color::Rgb(17, 24, 39);
const SURFACE_ALT: Color = Color::Rgb(30, 41, 59);
const ROW_ALT: Color = Color::Rgb(22, 30, 46);
const BORDER: Color = Color::Rgb(55, 65, 81);
const TEXT: Color = Color::Rgb(226, 232, 240);
const MUTED: Color = Color::Rgb(148, 163, 184);
const ACCENT: Color = Color::Rgb(34, 211, 238);
const SUCCESS: Color = Color::Rgb(52, 211, 153);
const WARNING: Color = Color::Rgb(251, 191, 36);
const DANGER: Color = Color::Rgb(248, 113, 113);
const BLUE: Color = Color::Rgb(96, 165, 250);
const VIOLET: Color = Color::Rgb(167, 139, 250);

pub fn draw(frame: &mut Frame, app: &App) {
    let area = frame.area();
    frame.render_widget(Block::default().style(Style::default().bg(BG)), area);

    let chunks = Layout::vertical([
        Constraint::Length(4),
        Constraint::Min(8),
        Constraint::Length(5),
    ])
    .split(area);

    draw_header(frame, app, chunks[0]);

    if let Connection::Disconnected(error) = &app.connection {
        draw_disconnected(frame, app, chunks[1], error);
    } else {
        let body = Layout::horizontal([Constraint::Percentage(31), Constraint::Percentage(69)])
            .spacing(1)
            .split(chunks[1]);
        draw_agents(frame, app, body[0]);

        let right = Layout::vertical([Constraint::Percentage(42), Constraint::Percentage(58)])
            .spacing(1)
            .split(body[1]);
        draw_tasks(frame, app, right[0]);
        draw_details(frame, app, right[1]);
    }

    draw_footer(frame, app, chunks[2]);

    if app.modal.is_open() {
        draw_modal(frame, app);
    }
}

fn draw_header(frame: &mut Frame, app: &App, area: Rect) {
    let block = surface_block(BORDER);
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let inner = inset(inner, 1, 0);
    let columns =
        Layout::horizontal([Constraint::Percentage(58), Constraint::Percentage(42)]).split(inner);

    let left = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(
                "AGENTIC",
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                " LOOP",
                Style::default().fg(TEXT).add_modifier(Modifier::BOLD),
            ),
            Span::raw("   "),
            Span::styled(
                format!(" {} ", app.connection.label()),
                connection_style(&app.connection),
            ),
        ]),
        Line::from(Span::styled(
            "Orquestador local de agentes y tareas",
            Style::default().fg(MUTED),
        )),
    ])
    .style(Style::default().fg(TEXT).bg(SURFACE));

    frame.render_widget(left, columns[0]);

    let total_tasks = app
        .status
        .as_ref()
        .map(|status| status.tasks.total)
        .unwrap_or(app.tasks.len());
    let in_progress = app
        .status
        .as_ref()
        .and_then(|status| status.tasks.by_status.get("IN_PROGRESS"))
        .copied()
        .unwrap_or(0);

    let metrics = Line::from(vec![
        metric(app.agents.len(), "agente", "agentes", ACCENT),
        Span::raw("   "),
        metric(total_tasks, "tarea", "tareas", TEXT),
        Span::raw("   "),
        metric(in_progress, "en curso", "en curso", WARNING),
    ]);
    let session = Line::from(vec![
        Span::styled("● ", Style::default().fg(dot_color(&app.connection))),
        Span::styled("bridge local  ·  TUI Rust", Style::default().fg(MUTED)),
    ]);
    let right = Paragraph::new(vec![metrics, session])
        .alignment(Alignment::Right)
        .style(Style::default().fg(TEXT).bg(SURFACE));

    frame.render_widget(right, columns[1]);
}

fn draw_agents(frame: &mut Frame, app: &App, area: Rect) {
    let block = panel_block(
        "AGENTES",
        Some(app.agents.len()),
        app.focus == Focus::Agents,
    );
    let inner = inset(block.inner(area), 1, 0);
    frame.render_widget(block, area);

    if app.agents.is_empty() {
        draw_agents_empty(frame, inner);
        return;
    }

    let items = app
        .agents
        .iter()
        .map(|agent| agent_item(agent, inner.width))
        .collect::<Vec<ListItem<'static>>>();
    let list = List::new(items)
        .style(Style::default().fg(TEXT).bg(SURFACE))
        .highlight_style(Style::default().bg(SURFACE_ALT));
    let mut state = ListState::default();
    state.select(Some(app.agent_index));

    frame.render_stateful_widget(list, inner, &mut state);
}

fn draw_agents_empty(frame: &mut Frame, area: Rect) {
    let lines = vec![
        Line::from(Span::styled(
            "PRIMEROS PASOS",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        step_line(1, "a", "Agrega un agente"),
        step_line(2, "s", "Crea una tarea"),
        step_line(3, "e", "Ejecuta la tarea"),
        Line::from(""),
        Line::from(vec![
            keycap("?"),
            Span::styled("  ver todos los atajos", Style::default().fg(MUTED)),
        ]),
    ];

    render_centered(frame, area, lines, 8);
}

fn draw_tasks(frame: &mut Frame, app: &App, area: Rect) {
    let block = panel_block("TAREAS", Some(app.tasks.len()), app.focus == Focus::Tasks);
    let inner = inset(block.inner(area), 1, 0);
    frame.render_widget(block, area);

    if app.tasks.is_empty() {
        draw_tasks_empty(frame, inner);
        return;
    }

    let compact = inner.width < 60;
    let labels = if compact {
        vec!["TAREA", "ESTADO", "AGENTE"]
    } else {
        vec!["ID", "TAREA", "ESTADO", "PRIO", "AGENTE"]
    };
    let widths = if compact {
        vec![
            Constraint::Min(18),
            Constraint::Length(13),
            Constraint::Length(10),
        ]
    } else {
        vec![
            Constraint::Length(8),
            Constraint::Min(16),
            Constraint::Length(13),
            Constraint::Length(6),
            Constraint::Length(10),
        ]
    };
    let header = Row::new(labels).style(Style::default().fg(MUTED).add_modifier(Modifier::BOLD));
    let rows = app
        .tasks
        .iter()
        .enumerate()
        .map(|(index, task)| task_row(index, task, compact))
        .collect::<Vec<_>>();
    let table = Table::new(rows, widths)
        .header(header)
        .column_spacing(1)
        .style(Style::default().fg(TEXT).bg(SURFACE))
        .row_highlight_style(Style::default().bg(SURFACE_ALT))
        .highlight_symbol("▍ ");
    let mut state = TableState::default();
    state.select(Some(app.task_index));

    frame.render_stateful_widget(table, inner, &mut state);
}

fn draw_tasks_empty(frame: &mut Frame, area: Rect) {
    let lines = vec![
        Line::from(Span::styled(
            "COLA VACÍA",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(vec![
            keycap("s"),
            Span::styled("  crear una tarea", Style::default().fg(MUTED)),
        ]),
        Line::from(vec![
            keycap("e"),
            Span::styled("  ejecutar la seleccionada", Style::default().fg(MUTED)),
        ]),
    ];

    render_centered(frame, area, lines, 5);
}

fn draw_details(frame: &mut Frame, app: &App, area: Rect) {
    let block = panel_block("DETALLE", None, false);
    let inner = inset(block.inner(area), 1, 0);
    frame.render_widget(block, area);

    match app.tasks.get(app.task_index) {
        Some(task) => {
            frame.render_widget(
                Paragraph::new(task_detail(task, inner.width))
                    .style(Style::default().fg(TEXT).bg(SURFACE))
                    .wrap(Wrap { trim: true }),
                inner,
            );
        }
        None => {
            let lines = vec![
                Line::from(Span::styled(
                    "Sin tarea seleccionada",
                    Style::default().fg(TEXT).add_modifier(Modifier::BOLD),
                )),
                Line::from(""),
                Line::from(vec![
                    keycap("s"),
                    Span::styled("  crear una tarea", Style::default().fg(MUTED)),
                ]),
            ];
            render_centered(frame, inner, lines, 3);
        }
    }
}

fn draw_footer(frame: &mut Frame, app: &App, area: Rect) {
    let store = app
        .status
        .as_ref()
        .map(|status| status.store_path.as_str())
        .unwrap_or("(store desconocido)");
    let title = Line::from(vec![
        Span::styled(
            " SESIÓN ",
            Style::default().fg(MUTED).add_modifier(Modifier::BOLD),
        ),
        Span::styled(format!("{store} "), Style::default().fg(ACCENT)),
    ]);
    let block = surface_block(BORDER).title(title);
    let inner = inset(block.inner(area), 1, 0);
    frame.render_widget(block, area);

    let rows = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Min(0),
    ])
    .split(inner);

    frame.render_widget(
        Paragraph::new(context_hints(app)).style(Style::default().bg(SURFACE)),
        rows[0],
    );
    frame.render_widget(
        Paragraph::new(global_hints()).style(Style::default().bg(SURFACE)),
        rows[1],
    );
    frame.render_widget(
        Paragraph::new(message_line(app)).style(Style::default().bg(SURFACE)),
        rows[2],
    );
}

fn context_hints(app: &App) -> Line<'static> {
    if matches!(app.connection, Connection::Disconnected(_)) {
        return Line::from(vec![
            Span::styled(
                "SIN CONEXIÓN ",
                Style::default().fg(DANGER).add_modifier(Modifier::BOLD),
            ),
            keycap("r"),
            Span::styled(" reintentar   ", Style::default().fg(MUTED)),
            keycap("q"),
            Span::styled(" salir", Style::default().fg(MUTED)),
        ]);
    }

    let heading = match app.focus {
        Focus::Agents => "AGENTES ",
        Focus::Tasks => "TAREAS ",
    };

    match app.focus {
        Focus::Agents => Line::from(vec![
            Span::styled(
                heading,
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
            ),
            keycap("a"),
            Span::styled(" agregar   ", Style::default().fg(MUTED)),
            keycap("d"),
            Span::styled(" quitar   ", Style::default().fg(MUTED)),
            keycap("Tab"),
            Span::styled(" ir a tareas", Style::default().fg(MUTED)),
        ]),
        Focus::Tasks => Line::from(vec![
            Span::styled(
                heading,
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
            ),
            keycap("s"),
            Span::styled(" crear   ", Style::default().fg(MUTED)),
            keycap("e"),
            Span::styled(" ejecutar   ", Style::default().fg(MUTED)),
            keycap("c"),
            Span::styled(" cancelar   ", Style::default().fg(MUTED)),
            keycap("R"),
            Span::styled(" cola   ", Style::default().fg(MUTED)),
            keycap("Tab"),
            Span::styled(" agentes", Style::default().fg(MUTED)),
        ]),
    }
}

fn global_hints() -> Line<'static> {
    Line::from(vec![
        Span::styled(
            "GLOBAL ",
            Style::default().fg(MUTED).add_modifier(Modifier::BOLD),
        ),
        keycap("?"),
        Span::styled(" ayuda   ", Style::default().fg(MUTED)),
        keycap("r"),
        Span::styled(" refrescar   ", Style::default().fg(MUTED)),
        keycap("↑↓"),
        Span::styled(" mover   ", Style::default().fg(MUTED)),
        keycap("Ctrl+C"),
        Span::styled(" salir", Style::default().fg(MUTED)),
    ])
}

fn message_line(app: &App) -> Line<'static> {
    let (label, color) = match app.message.kind {
        MessageKind::Info => ("INFO ", MUTED),
        MessageKind::Success => ("OK   ", SUCCESS),
        MessageKind::Error => ("ERROR", DANGER),
    };

    Line::from(vec![
        Span::styled("● ", Style::default().fg(color)),
        Span::styled(
            label,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        ),
        Span::styled(app.message.text.clone(), Style::default().fg(TEXT)),
    ])
}

fn draw_disconnected(frame: &mut Frame, app: &App, area: Rect, error: &str) {
    let title = Line::from(Span::styled(
        " DIAGNÓSTICO ",
        Style::default().fg(DANGER).add_modifier(Modifier::BOLD),
    ));
    let block = surface_block(DANGER).title(title);
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let store = app
        .status
        .as_ref()
        .map(|status| status.store_path.as_str())
        .unwrap_or("(sin estado)");
    let lines = vec![
        Line::from(Span::styled(
            "SIN CONEXIÓN",
            Style::default().fg(DANGER).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            "No se pudo iniciar el puente con el motor.",
            Style::default().fg(TEXT),
        )),
        Line::from(""),
        Line::from(Span::styled(
            error.to_string(),
            Style::default().fg(WARNING),
        )),
        Line::from(""),
        Line::from(Span::styled(
            format!("Store: {store}"),
            Style::default().fg(MUTED),
        )),
        Line::from(Span::styled(
            "Revisa dist/infrastructure/cli/bridge.js y que Node esté instalado.",
            Style::default().fg(MUTED),
        )),
        Line::from(""),
        Line::from(vec![
            keycap("r"),
            Span::styled(" reintentar   ", Style::default().fg(MUTED)),
            keycap("q"),
            Span::styled(" salir", Style::default().fg(MUTED)),
        ]),
    ];

    render_centered(frame, inner, lines, 9);
}

fn draw_modal(frame: &mut Frame, app: &App) {
    match &app.modal {
        Modal::None => {}
        Modal::Welcome => draw_welcome(frame, frame.area()),
        Modal::Help => draw_help(frame, frame.area()),
        Modal::AddAgent(form) => draw_form(frame, form),
        Modal::SubmitTask(form) => draw_form(frame, form),
        Modal::Confirm(confirm) => draw_confirm(frame, confirm),
    }
}

fn draw_confirm(frame: &mut Frame, confirm: &crate::app::Confirm) {
    let rect = centered_rect_height(58, 10, frame.area());
    frame.render_widget(Clear, rect);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .title(Line::from(Span::styled(
            " CONFIRMAR ",
            Style::default().fg(WARNING).add_modifier(Modifier::BOLD),
        )))
        .border_style(Style::default().fg(WARNING))
        .style(Style::default().bg(SURFACE));
    let inner = block.inner(rect);
    frame.render_widget(block, rect);

    let lines = vec![
        Line::from(Span::styled(
            format!("[!] {}", confirm.title),
            Style::default().fg(WARNING).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            confirm.message.clone(),
            Style::default().fg(TEXT),
        )),
        Line::from(""),
        Line::from(vec![
            keycap("Enter"),
            Span::styled(" confirmar   ", Style::default().fg(MUTED)),
            keycap("Esc"),
            Span::styled(" cancelar", Style::default().fg(MUTED)),
        ]),
    ];

    frame.render_widget(
        Paragraph::new(lines)
            .style(Style::default().bg(SURFACE))
            .wrap(Wrap { trim: true })
            .alignment(Alignment::Center),
        inner,
    );
}

fn draw_form(frame: &mut Frame, form: &Form) {
    let area = frame.area();
    let height = (form.fields.len() as u16 + 10)
        .min(area.height.saturating_sub(2))
        .max(10);
    let rect = centered_rect_height(72, height, area);
    frame.render_widget(Clear, rect);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .title(Line::from(Span::styled(
            format!(" {} ", form.title.to_uppercase()),
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )))
        .border_style(Style::default().fg(ACCENT))
        .style(Style::default().bg(SURFACE));
    let inner = inset(block.inner(rect), 1, 0);
    frame.render_widget(block, rect);

    let label_width = 15usize;
    let box_width = usize::from(inner.width)
        .saturating_sub(label_width + 2)
        .max(10);
    let mut lines = Vec::new();

    for (index, field) in form.fields.iter().enumerate() {
        let active = index == form.active;
        let marker = if active {
            Span::styled("▍ ", Style::default().fg(ACCENT))
        } else {
            Span::raw("  ")
        };
        let label_style = if active {
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(MUTED)
        };
        let value_style = if active {
            Style::default()
                .fg(BG)
                .bg(ACCENT)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(TEXT).bg(SURFACE_ALT)
        };
        let text = match field.kind {
            FieldKind::Choice(_) => format!("‹ {} ›", field.value),
            FieldKind::Text => field.value.clone(),
        };
        let value = fit(&text, box_width.saturating_sub(2));

        lines.push(Line::from(vec![
            marker,
            Span::styled(format!("{:<label_width$}", field.label), label_style),
            Span::styled(format!(" {value} "), value_style),
        ]));
    }

    if let Some(error) = &form.error {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            format!("[!] {error}"),
            Style::default().fg(DANGER).add_modifier(Modifier::BOLD),
        )));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(vec![
        keycap_fixed("Tab", 4),
        Span::styled(" siguiente   ", Style::default().fg(MUTED)),
        keycap("↑/↓"),
        Span::styled(" mover   ", Style::default().fg(MUTED)),
        keycap("←/→"),
        Span::styled(" opciones", Style::default().fg(MUTED)),
    ]));
    lines.push(Line::from(vec![
        keycap("Enter"),
        Span::styled(" guardar   ", Style::default().fg(MUTED)),
        keycap("Esc"),
        Span::styled(" cancelar", Style::default().fg(MUTED)),
    ]));

    frame.render_widget(
        Paragraph::new(lines)
            .style(Style::default().bg(SURFACE))
            .wrap(Wrap { trim: false }),
        inner,
    );
}

fn draw_welcome(frame: &mut Frame, area: Rect) {
    let height = if area.width < 90 { 17 } else { 16 };
    let rect = centered_rect_height(68, height, area);
    frame.render_widget(Clear, rect);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .title(Line::from(Span::styled(
            " BIENVENIDO ",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )))
        .border_style(Style::default().fg(ACCENT))
        .style(Style::default().bg(SURFACE));
    let inner = inset(block.inner(rect), 1, 0);
    frame.render_widget(block, rect);

    let lines = vec![
        Line::from(Span::styled(
            "AGENTIC LOOP",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            "Orquesta agentes de IA para resolver tareas de código.",
            Style::default().fg(MUTED),
        )),
        divider(inner.width),
        Line::from(Span::styled(
            "EMPIEZA EN 3 PASOS",
            Style::default().fg(TEXT).add_modifier(Modifier::BOLD),
        )),
        step_line(1, "a", "Agrega un agente"),
        step_line(2, "s", "Crea una tarea"),
        step_line(3, "e", "Ejecútala y revisa el resultado"),
        Line::from(""),
        divider(inner.width),
        Line::from(vec![
            Span::styled(
                "CONSEJO  ",
                Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                "todo se guarda en .agentic-loop · usa ? para la ayuda",
                Style::default().fg(MUTED),
            ),
        ]),
        Line::from(""),
        Line::from(vec![
            keycap("Enter"),
            Span::styled(" empezar   ", Style::default().fg(MUTED)),
            keycap("a"),
            Span::styled(" agente   ", Style::default().fg(MUTED)),
            keycap("s"),
            Span::styled(" tarea   ", Style::default().fg(MUTED)),
            keycap("?"),
            Span::styled(" ayuda", Style::default().fg(MUTED)),
        ]),
    ];

    frame.render_widget(
        Paragraph::new(lines)
            .style(Style::default().bg(SURFACE))
            .wrap(Wrap { trim: true }),
        inner,
    );
}

fn draw_help(frame: &mut Frame, area: Rect) {
    let rect = centered_rect_height(76, 15, area);
    frame.render_widget(Clear, rect);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .title(Line::from(Span::styled(
            " AYUDA ",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )))
        .border_style(Style::default().fg(ACCENT))
        .style(Style::default().bg(SURFACE));
    let inner = inset(block.inner(rect), 1, 0);
    frame.render_widget(block, rect);

    let rows = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Min(0),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(1),
    ])
    .split(inner);

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            "ATAJOS DE TECLADO",
            Style::default().fg(TEXT).add_modifier(Modifier::BOLD),
        )))
        .style(Style::default().bg(SURFACE)),
        rows[0],
    );
    frame.render_widget(
        Paragraph::new(divider(inner.width)).style(Style::default().bg(SURFACE)),
        rows[1],
    );

    let columns = Layout::horizontal([Constraint::Percentage(50), Constraint::Percentage(50)])
        .spacing(2)
        .split(rows[2]);
    let navigation = vec![
        shortcut_line("q", "Salir"),
        shortcut_line("Ctrl+C", "Salir siempre"),
        shortcut_line("r", "Refrescar todo"),
        shortcut_line("Tab", "Cambiar foco"),
        shortcut_line("↑/↓", "Mover selección"),
        shortcut_line("?", "Cerrar ayuda"),
    ];
    let actions = vec![
        shortcut_line("a", "Agregar agente"),
        shortcut_line("d", "Quitar agente"),
        shortcut_line("s", "Crear tarea"),
        shortcut_line("e", "Ejecutar tarea"),
        shortcut_line("c", "Cancelar tarea"),
        shortcut_line("R", "Procesar cola"),
    ];

    frame.render_widget(
        Paragraph::new(navigation)
            .style(Style::default().fg(TEXT).bg(SURFACE))
            .wrap(Wrap { trim: true }),
        columns[0],
    );
    frame.render_widget(
        Paragraph::new(actions)
            .style(Style::default().fg(TEXT).bg(SURFACE))
            .wrap(Wrap { trim: true }),
        columns[1],
    );

    frame.render_widget(
        Paragraph::new(divider(inner.width)).style(Style::default().bg(SURFACE)),
        rows[3],
    );
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(
                "ESTADOS  ",
                Style::default().fg(MUTED).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                " CONECTADO ",
                Style::default()
                    .fg(BG)
                    .bg(SUCCESS)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw(" "),
            Span::styled(
                " SIN AGENTES ",
                Style::default()
                    .fg(BG)
                    .bg(WARNING)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw(" "),
            Span::styled(
                " SIN CONEXIÓN ",
                Style::default()
                    .fg(BG)
                    .bg(DANGER)
                    .add_modifier(Modifier::BOLD),
            ),
        ]))
        .alignment(Alignment::Center)
        .style(Style::default().bg(SURFACE)),
        rows[4],
    );
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            keycap("Esc"),
            Span::styled(" cerrar ayuda", Style::default().fg(MUTED)),
        ]))
        .alignment(Alignment::Center)
        .style(Style::default().bg(SURFACE)),
        rows[5],
    );
}

fn agent_item(agent: &AgentDescriptor, width: u16) -> ListItem<'static> {
    let width = usize::from(width);
    let model = agent
        .model
        .clone()
        .unwrap_or_else(|| "modelo no definido".to_string());
    let capabilities = if agent.capabilities.is_empty() {
        "sin capabilities".to_string()
    } else {
        agent.capabilities.join(", ")
    };

    ListItem::new(vec![
        Line::from(Span::styled(
            fit(&agent.label, width),
            Style::default().fg(TEXT).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            fit(&format!("{}:{}", agent.provider, agent.agent_id), width),
            Style::default().fg(MUTED),
        )),
        Line::from(Span::styled(fit(&model, width), Style::default().fg(MUTED))),
        Line::from(Span::styled(
            fit(&capabilities, width),
            Style::default().fg(MUTED),
        )),
        Line::from(""),
    ])
}

fn task_row(index: usize, task: &Task, compact: bool) -> Row<'static> {
    let agent = task
        .assignee
        .as_ref()
        .map(|assignee| assignee.agent_id.clone())
        .unwrap_or_else(|| "—".to_string());
    let background = if index.is_multiple_of(2) {
        SURFACE
    } else {
        ROW_ALT
    };
    let mut cells = Vec::new();

    if !compact {
        cells.push(Cell::from(Span::styled(
            short(&task.id),
            Style::default().fg(MUTED),
        )));
    }

    cells.push(Cell::from(Span::styled(
        task.title.clone(),
        Style::default().fg(TEXT),
    )));
    cells.push(Cell::from(Line::from(Span::styled(
        format!(" {} ", task.status),
        task_status_style(&task.status),
    ))));

    if !compact {
        cells.push(Cell::from(Span::styled(
            task.priority.clone(),
            priority_style(&task.priority),
        )));
    }

    cells.push(Cell::from(Span::styled(agent, Style::default().fg(MUTED))));

    Row::new(cells).style(Style::default().bg(background))
}

fn task_detail(task: &Task, width: u16) -> Vec<Line<'static>> {
    let agent = task
        .assignee
        .as_ref()
        .map(|assignee| {
            let model = if width >= 60 {
                assignee
                    .model
                    .as_ref()
                    .map(|model| format!(" ({model})"))
                    .unwrap_or_default()
            } else {
                String::new()
            };
            format!("{}:{}{model}", assignee.provider, assignee.agent_id)
        })
        .unwrap_or_else(|| "sin asignar".to_string());

    let mut lines = vec![
        Line::from(vec![
            Span::styled("▍ ", Style::default().fg(ACCENT)),
            Span::styled(
                task.title.clone(),
                Style::default().fg(TEXT).add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(vec![
            Span::styled(short(&task.id), Style::default().fg(MUTED)),
            Span::styled("  ·  ", Style::default().fg(BORDER)),
            Span::styled(
                format!(
                    "{}/{}@{}",
                    task.repository.owner, task.repository.name, task.repository.base_branch
                ),
                Style::default().fg(MUTED),
            ),
        ]),
        Line::from(vec![
            Span::styled(
                format!(" {} ", task.status),
                task_status_style(&task.status),
            ),
            Span::raw("  "),
            Span::styled(task.priority.clone(), priority_style(&task.priority)),
            Span::styled(format!("   v{}", task.version), Style::default().fg(MUTED)),
        ]),
        field_line("AGENTE", agent),
        field_line("FUENTE", task.source.clone()),
    ];

    if let Some(source_ref) = &task.source_ref {
        let url = source_ref
            .url
            .as_ref()
            .map(|url| format!("  ·  {url}"))
            .unwrap_or_default();
        lines.push(field_line(
            "REFERENCIA",
            format!("{}{url}", source_ref.external_id),
        ));
    }

    lines.push(Line::from(vec![
        Span::styled(
            "DESCRIPCIÓN  ",
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        ),
        Span::styled(task.description.clone(), Style::default().fg(TEXT)),
    ]));

    if !task.acceptance_criteria.is_empty() {
        lines.push(Line::from(""));
        lines.push(section_line("CRITERIOS"));
        for criterion in task.acceptance_criteria.iter().take(4) {
            lines.push(Line::from(vec![
                Span::styled("• ", Style::default().fg(ACCENT)),
                Span::styled(criterion.clone(), Style::default().fg(TEXT)),
            ]));
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        format!(
            "Creada {} · actualizada {}",
            task.created_at, task.updated_at
        ),
        Style::default().fg(MUTED),
    )));

    lines
}

fn field_line(label: &'static str, value: String) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!("{label:<12}"),
            Style::default().fg(MUTED).add_modifier(Modifier::BOLD),
        ),
        Span::styled(value, Style::default().fg(TEXT)),
    ])
}

fn section_line(label: &'static str) -> Line<'static> {
    Line::from(Span::styled(
        label,
        Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
    ))
}

fn panel_block(title: &str, count: Option<usize>, focused: bool) -> Block<'static> {
    let mut spans = Vec::new();

    if focused {
        spans.push(Span::styled(" ● ", Style::default().fg(ACCENT)));
    } else {
        spans.push(Span::raw(" "));
    }

    spans.push(Span::styled(
        format!("{title} "),
        Style::default()
            .fg(if focused { TEXT } else { MUTED })
            .add_modifier(Modifier::BOLD),
    ));

    if let Some(count) = count {
        spans.push(Span::styled(
            format!(" {count} "),
            Style::default()
                .fg(if focused { BG } else { MUTED })
                .bg(if focused { ACCENT } else { SURFACE_ALT })
                .add_modifier(Modifier::BOLD),
        ));
    }

    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .title(Line::from(spans))
        .border_style(Style::default().fg(if focused { ACCENT } else { BORDER }))
        .style(Style::default().bg(SURFACE))
}

fn surface_block(border: Color) -> Block<'static> {
    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(border))
        .style(Style::default().bg(SURFACE))
}

fn connection_style(connection: &Connection) -> Style {
    match connection {
        Connection::Connected => Style::default()
            .fg(BG)
            .bg(SUCCESS)
            .add_modifier(Modifier::BOLD),
        Connection::NoAgents => Style::default()
            .fg(BG)
            .bg(WARNING)
            .add_modifier(Modifier::BOLD),
        Connection::Disconnected(_) => Style::default()
            .fg(BG)
            .bg(DANGER)
            .add_modifier(Modifier::BOLD),
        Connection::Connecting => Style::default()
            .fg(TEXT)
            .bg(SURFACE_ALT)
            .add_modifier(Modifier::BOLD),
    }
}

fn dot_color(connection: &Connection) -> Color {
    match connection {
        Connection::Connected => SUCCESS,
        Connection::NoAgents => WARNING,
        Connection::Disconnected(_) => DANGER,
        Connection::Connecting => MUTED,
    }
}

fn task_status_style(status: &str) -> Style {
    match status {
        "PENDING" => Style::default().fg(MUTED).bg(SURFACE_ALT),
        "QUEUED" => Style::default().fg(BG).bg(ACCENT),
        "IN_PROGRESS" => Style::default().fg(BG).bg(BLUE),
        "BLOCKED" => Style::default().fg(BG).bg(WARNING),
        "IN_REVIEW" => Style::default().fg(BG).bg(VIOLET),
        "COMPLETED" => Style::default().fg(BG).bg(SUCCESS),
        "FAILED" => Style::default().fg(BG).bg(DANGER),
        "CANCELLED" => Style::default().fg(MUTED).bg(SURFACE_ALT),
        _ => Style::default().fg(TEXT).bg(SURFACE_ALT),
    }
    .add_modifier(Modifier::BOLD)
}

fn priority_style(priority: &str) -> Style {
    match priority {
        "CRITICAL" => Style::default().fg(DANGER).add_modifier(Modifier::BOLD),
        "HIGH" => Style::default().fg(WARNING),
        "MEDIUM" => Style::default().fg(ACCENT),
        "LOW" => Style::default().fg(MUTED),
        _ => Style::default().fg(TEXT),
    }
}

fn metric(
    value: usize,
    singular: &'static str,
    plural: &'static str,
    color: Color,
) -> Span<'static> {
    let label = if value == 1 { singular } else { plural };

    Span::styled(
        format!("{value} {label}"),
        Style::default().fg(color).add_modifier(Modifier::BOLD),
    )
}

fn keycap(label: &str) -> Span<'static> {
    Span::styled(
        format!(" {label} "),
        Style::default()
            .fg(TEXT)
            .bg(SURFACE_ALT)
            .add_modifier(Modifier::BOLD),
    )
}

fn keycap_fixed(label: &str, width: usize) -> Span<'static> {
    let padded = format!("{label:<width$}", width = width);
    Span::styled(
        format!(" {padded} "),
        Style::default()
            .fg(TEXT)
            .bg(SURFACE_ALT)
            .add_modifier(Modifier::BOLD),
    )
}

fn step_line(number: u8, key: &str, description: &'static str) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!(" {number} "),
            Style::default()
                .fg(BG)
                .bg(ACCENT)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("  "),
        keycap(key),
        Span::styled(format!("  {description}"), Style::default().fg(TEXT)),
    ])
}

fn shortcut_line(key: &'static str, description: &'static str) -> Line<'static> {
    Line::from(vec![
        keycap_fixed(key, 8),
        Span::styled(format!(" {description}"), Style::default().fg(MUTED)),
    ])
}

fn divider(width: u16) -> Line<'static> {
    Line::from(Span::styled(
        "─".repeat(usize::from(width)),
        Style::default().fg(BORDER),
    ))
}

fn render_centered(frame: &mut Frame, area: Rect, lines: Vec<Line<'static>>, height: u16) {
    let rows = Layout::vertical([
        Constraint::Min(0),
        Constraint::Length(height.min(area.height)),
        Constraint::Min(0),
    ])
    .split(area);

    frame.render_widget(
        Paragraph::new(lines)
            .style(Style::default().bg(SURFACE))
            .wrap(Wrap { trim: true })
            .alignment(Alignment::Center),
        rows[1],
    );
}

fn inset(area: Rect, horizontal: u16, vertical: u16) -> Rect {
    Rect {
        x: area.x.saturating_add(horizontal),
        y: area.y.saturating_add(vertical),
        width: area.width.saturating_sub(horizontal.saturating_mul(2)),
        height: area.height.saturating_sub(vertical.saturating_mul(2)),
    }
}

fn fit(text: &str, width: usize) -> String {
    let length = text.chars().count();

    if length <= width {
        format!("{text:<width$}", width = width)
    } else {
        let mut clipped = text
            .chars()
            .take(width.saturating_sub(1))
            .collect::<String>();
        clipped.push('…');
        clipped
    }
}

fn short(id: &str) -> String {
    id.chars().take(8).collect()
}

fn centered_rect_height(percent_x: u16, height: u16, area: Rect) -> Rect {
    let height = height.min(area.height);
    let top = area.height.saturating_sub(height) / 2;
    let vertical = Layout::vertical([
        Constraint::Length(top),
        Constraint::Length(height),
        Constraint::Min(0),
    ])
    .split(area);
    let horizontal = Layout::horizontal([
        Constraint::Percentage((100 - percent_x) / 2),
        Constraint::Percentage(percent_x),
        Constraint::Percentage((100 - percent_x) / 2),
    ])
    .split(vertical[1]);

    horizontal[1]
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    use super::*;
    use crate::app::{Config, MessageKind};
    use crate::bridge::{Assignee, Repository, StatusData, TaskCounts};

    fn sample_app() -> App {
        let mut app = App::new(Config {
            node: "node".to_string(),
            bridge_script: PathBuf::from("bridge.js"),
            store: None,
            check: false,
        });

        app.connection = Connection::Connected;
        app.status = Some(StatusData {
            store_path: ".agentic-loop/tasks.json".to_string(),
            agent_store_path: ".agentic-loop/agents.json".to_string(),
            agent_count: 1,
            execution_adapters: vec!["opencode".to_string()],
            tasks: TaskCounts {
                total: 1,
                by_status: BTreeMap::from([("IN_PROGRESS".to_string(), 1)]),
            },
        });
        app.agents = vec![AgentDescriptor {
            provider: "opencode".to_string(),
            agent_id: "builder-01".to_string(),
            model: Some("deepseek-v4.1-flash-free".to_string()),
            label: "OpenCode Builder".to_string(),
            capabilities: vec!["typescript".to_string(), "backend".to_string()],
        }];
        app.tasks = vec![Task {
            id: "9f8c1d2e-task".to_string(),
            title: "Implementar onboarding de la TUI".to_string(),
            description: "Agregar una bienvenida clara y mejorar el contraste.".to_string(),
            status: "IN_PROGRESS".to_string(),
            priority: "HIGH".to_string(),
            source: "MANUAL".to_string(),
            source_ref: None,
            repository: Repository {
                owner: "acme".to_string(),
                name: "agentic-loop".to_string(),
                base_branch: "main".to_string(),
            },
            assignee: Some(Assignee {
                provider: "opencode".to_string(),
                agent_id: "builder-01".to_string(),
                model: Some("deepseek-v4.1-flash-free".to_string()),
            }),
            acceptance_criteria: vec![
                "La bienvenida explica los tres pasos".to_string(),
                "El footer muestra atajos contextuales".to_string(),
            ],
            created_at: "2026-11-15T12:00:00.000Z".to_string(),
            updated_at: "2026-11-15T12:30:00.000Z".to_string(),
            version: 2,
        }];
        app.message.kind = MessageKind::Success;
        app.message.text = "1 agente · 1 tarea".to_string();
        app.focus = Focus::Tasks;

        app
    }

    fn render(app: &App, width: u16, height: u16) -> String {
        let backend = TestBackend::new(width, height);
        let mut terminal = Terminal::new(backend).unwrap();
        terminal.draw(|frame| draw(frame, app)).unwrap();
        let buffer = terminal.backend().buffer();
        let mut output = String::new();

        for y in 0..buffer.area.height {
            for x in 0..buffer.area.width {
                output.push_str(buffer[(x, y)].symbol());
            }
            output.push('\n');
        }

        output
    }

    #[test]
    fn renders_dashboard_without_clipping_controls() {
        let app = sample_app();
        let screen = render(&app, 100, 30);

        assert!(screen.contains("AGENTIC"));
        assert!(screen.contains("AGENTES"));
        assert!(screen.contains("TAREAS"));
        assert!(screen.contains("DETALLE"));
        assert!(screen.contains("Ctrl+C"));
    }

    #[test]
    fn renders_compact_dashboard() {
        let app = sample_app();
        let screen = render(&app, 80, 24);

        assert!(screen.contains("AGENTIC"));
        assert!(screen.contains("TAREAS"));
        assert!(screen.contains("Ctrl+C"));
    }

    #[test]
    fn renders_welcome_and_help_modals() {
        let mut app = sample_app();
        app.modal = Modal::Welcome;
        let welcome = render(&app, 100, 30);
        assert!(welcome.contains("BIENVENIDO"));
        assert!(welcome.contains("EMPIEZA EN 3 PASOS"));

        app.modal = Modal::Help;
        let help = render(&app, 100, 30);
        assert!(help.contains("ATAJOS DE TECLADO"));
        assert!(help.contains("Ctrl+C"));
    }
}
