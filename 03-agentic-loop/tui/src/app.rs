use std::path::PathBuf;

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use serde_json::{json, Value};

use crate::bridge::{
    AgentDescriptor, AgentWrap, AgentsData, Bridge, BridgeConfig, BridgeError, ExecuteSummary,
    RemovedResult, RunResult, StatusData, SubmitResult, Task, TasksData,
};

pub const SOURCES: &[&str] = &[
    "MANUAL",
    "CLI",
    "API",
    "WEBHOOK",
    "GITHUB_ISSUE",
    "GITLAB_ISSUE",
    "JIRA_ISSUE",
    "SLACK",
];

pub const PRIORITIES: &[&str] = &["LOW", "MEDIUM", "HIGH", "CRITICAL"];

#[derive(Debug, Clone)]
pub struct Config {
    pub node: String,
    pub bridge_script: PathBuf,
    pub store: Option<String>,
    pub check: bool,
}

impl Config {
    pub fn from_args() -> Result<Self, String> {
        let mut node = std::env::var("AGENTIC_LOOP_NODE").unwrap_or_else(|_| "node".to_string());
        let mut bridge_script = std::env::var("AGENTIC_LOOP_BRIDGE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("dist/infrastructure/cli/bridge.js"));
        let mut store = std::env::var("AGENTIC_LOOP_STORE").ok();
        let mut check = false;
        let mut arguments = std::env::args().skip(1);

        while let Some(argument) = arguments.next() {
            match argument.as_str() {
                "--bridge" => {
                    bridge_script = PathBuf::from(
                        arguments
                            .next()
                            .ok_or_else(|| "Falta el valor de --bridge".to_string())?,
                    );
                }
                "--node" => {
                    node = arguments
                        .next()
                        .ok_or_else(|| "Falta el valor de --node".to_string())?;
                }
                "--store" => {
                    store = Some(
                        arguments
                            .next()
                            .ok_or_else(|| "Falta el valor de --store".to_string())?,
                    );
                }
                "--check" => check = true,
                other => return Err(format!("Argumento desconocido: {other}")),
            }
        }

        Ok(Self {
            node,
            bridge_script,
            store,
            check,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    Agents,
    Tasks,
}

impl Focus {
    fn next(self) -> Self {
        match self {
            Self::Agents => Self::Tasks,
            Self::Tasks => Self::Agents,
        }
    }

    fn prev(self) -> Self {
        self.next()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Connection {
    Connecting,
    Connected,
    NoAgents,
    Disconnected(String),
}

impl Connection {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Connecting => "CONECTANDO",
            Self::Connected => "CONECTADO",
            Self::NoAgents => "SIN AGENTES",
            Self::Disconnected(_) => "SIN CONEXIÓN",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageKind {
    Info,
    Success,
    Error,
}

#[derive(Debug, Clone)]
pub struct Message {
    pub kind: MessageKind,
    pub text: String,
}

impl Message {
    fn info(text: impl Into<String>) -> Self {
        Self {
            kind: MessageKind::Info,
            text: text.into(),
        }
    }

    fn success(text: impl Into<String>) -> Self {
        Self {
            kind: MessageKind::Success,
            text: text.into(),
        }
    }

    fn error(text: impl Into<String>) -> Self {
        Self {
            kind: MessageKind::Error,
            text: text.into(),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum FieldKind {
    Text,
    Choice(&'static [&'static str]),
}

#[derive(Debug, Clone)]
pub struct FormField {
    pub label: &'static str,
    pub value: String,
    pub kind: FieldKind,
}

impl FormField {
    fn text(label: &'static str, value: &str) -> Self {
        Self {
            label,
            value: value.to_string(),
            kind: FieldKind::Text,
        }
    }

    fn choice(label: &'static str, value: &str, options: &'static [&'static str]) -> Self {
        Self {
            label,
            value: value.to_string(),
            kind: FieldKind::Choice(options),
        }
    }

    fn cycle(&mut self, delta: isize) {
        let FieldKind::Choice(options) = self.kind else {
            return;
        };

        if options.is_empty() {
            return;
        }

        let current = options
            .iter()
            .position(|option| *option == self.value)
            .unwrap_or(0);
        let next = (current as isize + delta).rem_euclid(options.len() as isize) as usize;
        self.value = options[next].to_string();
    }
}

#[derive(Debug, Clone)]
pub struct Form {
    pub title: &'static str,
    pub fields: Vec<FormField>,
    pub active: usize,
    pub error: Option<String>,
}

pub enum FormOutcome {
    Continue,
    Cancel,
    Submit,
}

impl Form {
    fn new(title: &'static str, fields: Vec<FormField>) -> Self {
        Self {
            title,
            fields,
            active: 0,
            error: None,
        }
    }

    pub fn value(&self, label: &str) -> &str {
        self.fields
            .iter()
            .find(|field| field.label == label)
            .map(|field| field.value.as_str())
            .unwrap_or("")
    }

    pub fn handle_key(&mut self, key: KeyEvent) -> FormOutcome {
        match key.code {
            KeyCode::Esc => return FormOutcome::Cancel,
            KeyCode::Enter => return FormOutcome::Submit,
            KeyCode::Tab | KeyCode::Down => {
                self.active = (self.active + 1) % self.fields.len();
            }
            KeyCode::BackTab | KeyCode::Up => {
                self.active = (self.active + self.fields.len() - 1) % self.fields.len();
            }
            KeyCode::Left => {
                if let Some(field) = self.fields.get_mut(self.active) {
                    field.cycle(-1);
                }
            }
            KeyCode::Right => {
                if let Some(field) = self.fields.get_mut(self.active) {
                    field.cycle(1);
                }
            }
            KeyCode::Backspace => {
                if let Some(field) = self.fields.get_mut(self.active) {
                    if matches!(field.kind, FieldKind::Text) {
                        field.value.pop();
                    }
                }
            }
            KeyCode::Char(character) => {
                if key.modifiers.contains(KeyModifiers::CONTROL) {
                    return FormOutcome::Continue;
                }

                if let Some(field) = self.fields.get_mut(self.active) {
                    if matches!(field.kind, FieldKind::Text) {
                        field.value.push(character);
                    }
                }
            }
            _ => {}
        }

        FormOutcome::Continue
    }
}

#[derive(Debug, Clone)]
pub enum ConfirmAction {
    RemoveAgent { provider: String, agent_id: String },
    CancelTask { task_id: String },
}

#[derive(Debug, Clone)]
pub struct Confirm {
    pub title: String,
    pub message: String,
    pub action: ConfirmAction,
}

#[derive(Debug, Clone)]
pub enum Modal {
    None,
    Welcome,
    Help,
    AddAgent(Form),
    SubmitTask(Form),
    Confirm(Confirm),
}

impl Modal {
    pub fn is_open(&self) -> bool {
        !matches!(self, Self::None)
    }
}

pub struct App {
    pub bridge: Bridge,
    pub status: Option<StatusData>,
    pub agents: Vec<AgentDescriptor>,
    pub tasks: Vec<Task>,
    pub connection: Connection,
    pub focus: Focus,
    pub agent_index: usize,
    pub task_index: usize,
    pub modal: Modal,
    pub message: Message,
    pub should_quit: bool,
    welcome_shown: bool,
}

impl App {
    pub fn new(config: Config) -> Self {
        let bridge = Bridge::new(BridgeConfig {
            node: config.node,
            script: config.bridge_script,
            store: config.store,
        });

        Self {
            bridge,
            status: None,
            agents: Vec::new(),
            tasks: Vec::new(),
            connection: Connection::Connecting,
            focus: Focus::Tasks,
            agent_index: 0,
            task_index: 0,
            modal: Modal::None,
            message: Message::info("Cargando…"),
            should_quit: false,
            welcome_shown: false,
        }
    }

    pub fn refresh(&mut self) {
        self.connection = Connection::Connecting;

        match self.load_dashboard() {
            Ok(()) => {
                self.connection = if self.agents.is_empty() {
                    Connection::NoAgents
                } else {
                    Connection::Connected
                };
            }
            Err(error) => {
                self.connection = Connection::Disconnected(error.to_string());
                self.message = Message::error(error.to_string());
            }
        }

        self.clamp_selection();
        self.maybe_show_welcome();
    }

    fn maybe_show_welcome(&mut self) {
        if self.welcome_shown {
            return;
        }

        if !matches!(
            self.connection,
            Connection::Connected | Connection::NoAgents
        ) {
            return;
        }

        self.welcome_shown = true;

        if self.agents.is_empty() && self.tasks.is_empty() && !self.modal.is_open() {
            self.modal = Modal::Welcome;
        }
    }

    fn load_dashboard(&mut self) -> Result<(), BridgeError> {
        let status = self.bridge.call::<StatusData>("status", json!({}))?.data;
        let agents = self
            .bridge
            .call::<AgentsData>("agents.list", json!({}))?
            .data
            .agents;
        let tasks = self
            .bridge
            .call::<TasksData>("tasks.list", json!({ "limit": 1000 }))?
            .data
            .tasks;

        self.status = Some(status);
        self.agents = agents;
        self.tasks = tasks;
        self.message = Message::info(format!(
            "{} agentes · {} tareas",
            self.agents.len(),
            self.tasks.len()
        ));

        Ok(())
    }

    fn clamp_selection(&mut self) {
        if self.agents.is_empty() {
            self.agent_index = 0;
        } else if self.agent_index >= self.agents.len() {
            self.agent_index = self.agents.len() - 1;
        }

        if self.tasks.is_empty() {
            self.task_index = 0;
        } else if self.task_index >= self.tasks.len() {
            self.task_index = self.tasks.len() - 1;
        }
    }

    pub fn handle_key(&mut self, key: KeyEvent) {
        let is_ctrl_c = (key.modifiers.contains(KeyModifiers::CONTROL)
            && matches!(key.code, KeyCode::Char('c') | KeyCode::Char('C')))
            || matches!(key.code, KeyCode::Char('\u{3}'));

        if is_ctrl_c {
            self.should_quit = true;
            return;
        }

        if self.modal.is_open() {
            self.handle_modal_key(key);
            return;
        }

        match key.code {
            KeyCode::Char('q') => self.should_quit = true,
            KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::SHIFT) => self.run_queue(),
            KeyCode::Char('r') => self.refresh(),
            KeyCode::Char('?') => self.modal = Modal::Help,
            KeyCode::Char('a') => self.modal = Modal::AddAgent(add_agent_form()),
            KeyCode::Char('s') => self.modal = Modal::SubmitTask(submit_task_form()),
            KeyCode::Char('d') if self.focus == Focus::Agents => self.confirm_remove_agent(),
            KeyCode::Char('e') if self.focus == Focus::Tasks => self.execute_selected_task(),
            KeyCode::Char('c') if self.focus == Focus::Tasks => self.confirm_cancel_task(),
            KeyCode::Char('R') => self.run_queue(),
            KeyCode::Tab => self.focus = self.focus.next(),
            KeyCode::BackTab => self.focus = self.focus.prev(),
            KeyCode::Up | KeyCode::Char('k') => self.move_selection(-1),
            KeyCode::Down | KeyCode::Char('j') => self.move_selection(1),
            _ => {}
        }
    }

    fn move_selection(&mut self, delta: isize) {
        match self.focus {
            Focus::Agents if !self.agents.is_empty() => {
                self.agent_index = step(self.agent_index, self.agents.len(), delta);
            }
            Focus::Tasks if !self.tasks.is_empty() => {
                self.task_index = step(self.task_index, self.tasks.len(), delta);
            }
            _ => {}
        }
    }

    fn handle_modal_key(&mut self, key: KeyEvent) {
        let modal = std::mem::replace(&mut self.modal, Modal::None);

        match modal {
            Modal::None => {}
            Modal::Welcome => match key.code {
                KeyCode::Enter | KeyCode::Esc | KeyCode::Char(' ') => {}
                KeyCode::Char('a') => self.modal = Modal::AddAgent(add_agent_form()),
                KeyCode::Char('s') => self.modal = Modal::SubmitTask(submit_task_form()),
                KeyCode::Char('?') => self.modal = Modal::Help,
                KeyCode::Char('q') => self.should_quit = true,
                _ => self.modal = Modal::Welcome,
            },
            Modal::Help => {
                if matches!(
                    key.code,
                    KeyCode::Esc | KeyCode::Char('?') | KeyCode::Char('q')
                ) {
                    self.modal = Modal::None;
                } else {
                    self.modal = Modal::Help;
                }
            }
            Modal::AddAgent(mut form) => match form.handle_key(key) {
                FormOutcome::Cancel => {}
                FormOutcome::Continue => self.modal = Modal::AddAgent(form),
                FormOutcome::Submit => match self.add_agent(&form) {
                    Ok(message) => self.finish_action(message),
                    Err(error) => {
                        form.error = Some(error);
                        self.modal = Modal::AddAgent(form);
                    }
                },
            },
            Modal::SubmitTask(mut form) => match form.handle_key(key) {
                FormOutcome::Cancel => {}
                FormOutcome::Continue => self.modal = Modal::SubmitTask(form),
                FormOutcome::Submit => match self.submit_task(&form) {
                    Ok(message) => self.finish_action(message),
                    Err(error) => {
                        form.error = Some(error);
                        self.modal = Modal::SubmitTask(form);
                    }
                },
            },
            Modal::Confirm(confirm) => match key.code {
                KeyCode::Enter | KeyCode::Char('y') | KeyCode::Char('Y') => {
                    self.apply_confirm(confirm.action);
                }
                KeyCode::Esc | KeyCode::Char('n') | KeyCode::Char('N') => {}
                _ => self.modal = Modal::Confirm(confirm),
            },
        }
    }

    fn confirm_remove_agent(&mut self) {
        let Some(agent) = self.agents.get(self.agent_index).cloned() else {
            self.message = Message::error("No hay agentes para eliminar");
            return;
        };

        self.modal = Modal::Confirm(Confirm {
            title: "Quitar agente".to_string(),
            message: format!(
                "¿Quitar {} ({}:{})?",
                agent.label, agent.provider, agent.agent_id
            ),
            action: ConfirmAction::RemoveAgent {
                provider: agent.provider,
                agent_id: agent.agent_id,
            },
        });
    }

    fn confirm_cancel_task(&mut self) {
        let Some(task) = self.tasks.get(self.task_index).cloned() else {
            self.message = Message::error("No hay tareas para cancelar");
            return;
        };

        self.modal = Modal::Confirm(Confirm {
            title: "Cancelar tarea".to_string(),
            message: format!(
                "¿Cancelar {} ({}:{})?",
                task.title,
                short(&task.id),
                task.status
            ),
            action: ConfirmAction::CancelTask { task_id: task.id },
        });
    }

    fn execute_selected_task(&mut self) {
        let Some(task) = self.tasks.get(self.task_index).cloned() else {
            self.message = Message::error("No hay tareas para ejecutar");
            return;
        };

        self.message = Message::info(format!("Ejecutando {}…", short(&task.id)));

        match self
            .bridge
            .call::<ExecuteSummary>("tasks.execute", json!({ "taskId": task.id }))
        {
            Ok(result) => {
                let summary = result.data;
                self.finish_action(format!(
                    "{} · {} · {} · {} eventos",
                    summary.outcome,
                    summary.status,
                    short(&summary.task_id),
                    result.events.len()
                ));
            }
            Err(error) => self.message = Message::error(error.to_string()),
        }
    }

    fn run_queue(&mut self) {
        self.message = Message::info("Ejecutando cola…");

        match self
            .bridge
            .call::<RunResult>("tasks.run", json!({ "maxTasks": 50 }))
        {
            Ok(result) => {
                let processed = result.data.processed.len();
                let failures = result.data.failures.len();
                let first_failure = result
                    .data
                    .failures
                    .first()
                    .map(|failure| {
                        format!(
                            " · {} {}: {}",
                            short(&failure.task_id),
                            failure.code,
                            failure.message
                        )
                    })
                    .unwrap_or_default();
                self.finish_action(format!(
                    "Run completado: {processed} procesadas, {failures} fallos{first_failure}"
                ));
            }
            Err(error) => self.message = Message::error(error.to_string()),
        }
    }

    fn add_agent(&self, form: &Form) -> Result<String, String> {
        let provider = form.value("Provider").trim();
        let agent_id = form.value("Agent ID").trim();

        if provider.is_empty() || agent_id.is_empty() {
            return Err("Provider y Agent ID son obligatorios".to_string());
        }

        let args = json!({
            "provider": provider,
            "agentId": agent_id,
            "model": nullable_text(form.value("Modelo")),
            "label": nullable_text(form.value("Etiqueta")),
            "capabilities": split_csv(form.value("Capabilities")),
        });

        let result = self
            .bridge
            .call::<AgentWrap>("agents.add", args)
            .map_err(|error| error.to_string())?;

        Ok(format!(
            "Agente agregado: {} ({}:{})",
            result.data.agent.label, provider, agent_id
        ))
    }

    fn submit_task(&self, form: &Form) -> Result<String, String> {
        let title = form.value("Título").trim();
        let description = form.value("Descripción").trim();

        if title.is_empty() || description.is_empty() {
            return Err("Título y descripción son obligatorios".to_string());
        }

        let source = form.value("Fuente").trim().to_uppercase();
        let external_id = form.value("External ID").trim();

        if matches!(
            source.as_str(),
            "GITHUB_ISSUE" | "GITLAB_ISSUE" | "JIRA_ISSUE"
        ) && external_id.is_empty()
        {
            return Err("Las fuentes de issue requieren External ID".to_string());
        }

        let (owner, name) = parse_repository(form.value("Repositorio"))?;
        let branch = {
            let value = form.value("Rama base").trim();

            if value.is_empty() {
                "main".to_string()
            } else {
                value.to_string()
            }
        };
        let priority = form.value("Prioridad").trim().to_uppercase();
        let workspace = form.value("Workspace").trim();
        let mut args = json!({
            "title": title,
            "description": description,
            "source": source,
            "priority": priority,
            "repository": {
                "owner": owner,
                "name": name,
                "baseBranch": branch,
            },
            "acceptanceCriteria": split_csv(form.value("Criterios (coma)")),
        });

        if !external_id.is_empty() {
            args["sourceRef"] = json!({
                "externalId": external_id,
                "url": nullable_text(form.value("URL")),
            });
        }

        if !workspace.is_empty() {
            args["metadata"] = json!({ "workspace": workspace });
        }

        let result = self
            .bridge
            .call::<SubmitResult>("tasks.submit", args)
            .map_err(|error| error.to_string())?;

        Ok(format!(
            "Tarea creada: {} (v{})",
            result.data.task_id, result.data.version
        ))
    }

    fn apply_confirm(&mut self, action: ConfirmAction) {
        match action {
            ConfirmAction::RemoveAgent { provider, agent_id } => {
                match self.bridge.call::<RemovedResult>(
                    "agents.remove",
                    json!({ "provider": provider, "agentId": agent_id }),
                ) {
                    Ok(result) if result.data.removed => {
                        self.finish_action(format!("Agente eliminado: {provider}:{agent_id}"));
                    }
                    Ok(_) => self.message = Message::error("El agente no existía"),
                    Err(error) => self.message = Message::error(error.to_string()),
                }
            }
            ConfirmAction::CancelTask { task_id } => {
                match self.bridge.call::<crate::bridge::TaskWrap>(
                    "tasks.cancel",
                    json!({ "taskId": task_id, "reason": "Cancelled from TUI" }),
                ) {
                    Ok(result) => {
                        self.finish_action(format!(
                            "Tarea cancelada: {} · {}",
                            short(&task_id),
                            result.data.task.status
                        ));
                    }
                    Err(error) => self.message = Message::error(error.to_string()),
                }
            }
        }
    }

    fn finish_action(&mut self, success: String) {
        self.refresh();

        if let Connection::Disconnected(error) = &self.connection {
            self.message = Message::error(format!("{success} · refresh falló: {error}"));
        } else {
            self.message = Message::success(success);
        }
    }
}

fn add_agent_form() -> Form {
    Form::new(
        "Nuevo agente",
        vec![
            FormField::text("Provider", "opencode"),
            FormField::text("Agent ID", ""),
            FormField::text("Modelo", "deepseek-v4.1-flash-free"),
            FormField::text("Etiqueta", ""),
            FormField::text("Capabilities", "typescript,backend"),
        ],
    )
}

fn submit_task_form() -> Form {
    Form::new(
        "Nueva tarea",
        vec![
            FormField::text("Título", ""),
            FormField::text("Descripción", ""),
            FormField::choice("Fuente", "MANUAL", SOURCES),
            FormField::text("External ID", ""),
            FormField::text("URL", ""),
            FormField::choice("Prioridad", "MEDIUM", PRIORITIES),
            FormField::text("Repositorio", "acme/app"),
            FormField::text("Rama base", "main"),
            FormField::text("Workspace", ""),
            FormField::text("Criterios (coma)", ""),
        ],
    )
}

fn split_csv(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn nullable_text(value: &str) -> Value {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        Value::Null
    } else {
        Value::String(trimmed.to_string())
    }
}

fn parse_repository(value: &str) -> Result<(String, String), String> {
    let mut parts = value.trim().splitn(2, '/');
    let owner = parts.next().unwrap_or("").trim();
    let name = parts.next().unwrap_or("").trim();

    if owner.is_empty() || name.is_empty() {
        return Err("Repositorio debe tener formato owner/name".to_string());
    }

    Ok((owner.to_string(), name.to_string()))
}

fn step(index: usize, len: usize, delta: isize) -> usize {
    (index as isize + delta).rem_euclid(len as isize) as usize
}

fn short(id: &str) -> String {
    id.chars().take(8).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app() -> App {
        App::new(Config {
            node: "node".to_string(),
            bridge_script: PathBuf::from("bridge.js"),
            store: None,
            check: false,
        })
    }

    #[test]
    fn submit_form_includes_workspace() {
        let form = submit_task_form();

        assert!(form.fields.iter().any(|field| field.label == "Workspace"));
    }

    #[test]
    fn welcome_is_skipped_when_disconnected() {
        let mut app = app();
        app.connection = Connection::Disconnected("sin bridge".to_string());

        app.maybe_show_welcome();

        assert!(matches!(app.modal, Modal::None));
        assert!(!app.welcome_shown);
    }

    #[test]
    fn control_c_quits_even_with_modal_open() {
        let mut app = app();
        app.modal = Modal::Welcome;

        app.handle_key(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL));

        assert!(app.should_quit);
    }

    #[test]
    fn welcome_is_shown_once_for_empty_store() {
        let mut app = app();
        app.connection = Connection::Connected;

        app.maybe_show_welcome();
        assert!(matches!(app.modal, Modal::Welcome));

        app.modal = Modal::None;
        app.maybe_show_welcome();
        assert!(matches!(app.modal, Modal::None));
    }

    #[test]
    fn welcome_is_skipped_when_data_exists() {
        let mut app = app();
        app.connection = Connection::NoAgents;
        app.tasks = vec![Task {
            ..serde_json::from_value(json!({
                "id": "task-1",
                "title": "Tarea",
                "description": "Descripción",
                "source": "MANUAL",
                "status": "PENDING",
                "priority": "MEDIUM",
                "repository": {
                    "owner": "acme",
                    "name": "repo",
                    "baseBranch": "main"
                },
                "acceptanceCriteria": [],
                "version": 1,
                "createdAt": "2026-01-01T00:00:00.000Z",
                "updatedAt": "2026-01-01T00:00:00.000Z"
            }))
            .unwrap()
        }];

        app.maybe_show_welcome();

        assert!(matches!(app.modal, Modal::None));
        assert!(app.welcome_shown);
    }
}
