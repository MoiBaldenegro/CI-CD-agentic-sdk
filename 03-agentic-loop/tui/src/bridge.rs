use std::collections::BTreeMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone)]
pub struct BridgeConfig {
    pub node: String,
    pub script: PathBuf,
    pub store: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BridgeError {
    pub code: String,
    pub message: String,
    pub status: Option<u16>,
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)?;

        if let Some(status) = self.status {
            write!(formatter, " (status {status})")?;
        }

        Ok(())
    }
}

impl std::error::Error for BridgeError {}

#[derive(Debug, Clone)]
pub struct BridgeResult<T> {
    pub data: T,
    pub events: Vec<Value>,
}

#[derive(Debug, Deserialize)]
struct Envelope<T> {
    ok: bool,
    data: Option<T>,
    error: Option<BridgeErrorPayload>,
    #[serde(default)]
    events: Vec<Value>,
}

#[derive(Debug, Deserialize)]
struct BridgeErrorPayload {
    code: String,
    message: String,
    #[serde(default)]
    status: Option<u16>,
}

pub struct Bridge {
    config: BridgeConfig,
}

impl Bridge {
    pub fn new(config: BridgeConfig) -> Self {
        Self { config }
    }

    pub fn call<T: DeserializeOwned>(
        &self,
        command: &str,
        args: Value,
    ) -> Result<BridgeResult<T>, BridgeError> {
        let mut payload = json!({ "command": command, "args": args });

        if let Some(store) = &self.config.store {
            payload["store"] = Value::String(store.clone());
        }

        if !self.config.script.exists() {
            return Err(BridgeError {
                code: "BRIDGE_NOT_FOUND".to_string(),
                message: format!("No existe el bridge: {}", self.config.script.display()),
                status: None,
            });
        }

        let mut process = Command::new(&self.config.node);
        process
            .arg(&self.config.script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        process.creation_flags(CREATE_NO_WINDOW);

        let mut child = process.spawn().map_err(|error| BridgeError {
            code: "BRIDGE_SPAWN_FAILED".to_string(),
            message: format!("No se pudo ejecutar Node ({}): {error}", self.config.node),
            status: None,
        })?;

        {
            let stdin = child.stdin.as_mut().ok_or_else(|| BridgeError {
                code: "BRIDGE_STDIN_UNAVAILABLE".to_string(),
                message: "No se pudo abrir stdin del bridge".to_string(),
                status: None,
            })?;

            stdin
                .write_all(payload.to_string().as_bytes())
                .map_err(|error| BridgeError {
                    code: "BRIDGE_WRITE_FAILED".to_string(),
                    message: format!("No se pudo enviar la petición al bridge: {error}"),
                    status: None,
                })?;
        }

        let output = child.wait_with_output().map_err(|error| BridgeError {
            code: "BRIDGE_WAIT_FAILED".to_string(),
            message: format!("El bridge terminó de forma inesperada: {error}"),
            status: None,
        })?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if stdout.is_empty() {
            return Err(BridgeError {
                code: "BRIDGE_EMPTY_RESPONSE".to_string(),
                message: if stderr.is_empty() {
                    format!(
                        "El bridge no respondió. ¿Existe {}?",
                        self.config.script.display()
                    )
                } else {
                    truncate(&stderr, 500)
                },
                status: output
                    .status
                    .code()
                    .and_then(|code| u16::try_from(code).ok()),
            });
        }

        let envelope: Envelope<T> = serde_json::from_str(&stdout).map_err(|error| BridgeError {
            code: "BRIDGE_INVALID_RESPONSE".to_string(),
            message: format!(
                "Respuesta inválida del bridge: {error}. Recibido: {}",
                truncate(&stdout, 400)
            ),
            status: None,
        })?;

        if !envelope.ok {
            return Err(envelope
                .error
                .map(|error| BridgeError {
                    code: error.code,
                    message: error.message,
                    status: error.status,
                })
                .unwrap_or_else(|| BridgeError {
                    code: "BRIDGE_ERROR".to_string(),
                    message: "El bridge devolvió un error sin detalle".to_string(),
                    status: None,
                }));
        }

        let data = envelope.data.ok_or_else(|| BridgeError {
            code: "BRIDGE_EMPTY_DATA".to_string(),
            message: "El bridge no devolvió datos".to_string(),
            status: None,
        })?;

        Ok(BridgeResult {
            data,
            events: envelope.events,
        })
    }
}

fn truncate(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }

    let truncated: String = value.chars().take(limit).collect();
    format!("{truncated}…")
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct TaskCounts {
    pub total: usize,
    #[serde(rename = "byStatus", default)]
    pub by_status: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct StatusData {
    #[serde(rename = "storePath")]
    pub store_path: String,
    #[serde(rename = "agentStorePath")]
    pub agent_store_path: String,
    #[serde(rename = "agentCount")]
    pub agent_count: usize,
    #[serde(rename = "executionAdapters", default)]
    pub execution_adapters: Vec<String>,
    #[serde(default)]
    pub tasks: TaskCounts,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct AgentsData {
    #[serde(default)]
    pub agents: Vec<AgentDescriptor>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct TasksData {
    #[serde(default)]
    pub tasks: Vec<Task>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct AgentDescriptor {
    pub provider: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub model: Option<String>,
    pub label: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct AgentWrap {
    pub agent: AgentDescriptor,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SourceRef {
    #[serde(rename = "externalId")]
    pub external_id: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Repository {
    pub owner: String,
    pub name: String,
    #[serde(rename = "baseBranch", default)]
    pub base_branch: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Assignee {
    pub provider: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub source: String,
    #[serde(rename = "sourceRef", default)]
    pub source_ref: Option<SourceRef>,
    #[serde(default)]
    pub repository: Repository,
    #[serde(default)]
    pub assignee: Option<Assignee>,
    #[serde(rename = "acceptanceCriteria", default)]
    pub acceptance_criteria: Vec<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: String,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: String,
    #[serde(default)]
    pub version: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct TaskWrap {
    pub task: Task,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SubmitResult {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub version: u64,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ExecuteSummary {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub outcome: String,
    pub status: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RunFailure {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RunResult {
    #[serde(default)]
    pub processed: Vec<ExecuteSummary>,
    #[serde(default)]
    pub failures: Vec<RunFailure>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RemovedResult {
    pub removed: bool,
}
