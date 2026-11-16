import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  AgentGateway,
  AgentPrompt,
  AgentResponse,
} from "../../core/domain/outbound/AgentGateway.port.js";
import type { AgentPrimitives } from "../../core/domain/Agent.entity.js";

export interface OpenCodeCliAgentAdapterOptions {
  readonly directory: string;
  readonly model?: string;
  readonly systemPrompt?: string;
}

export class OpenCodeCliAgentAdapter implements AgentGateway {
  constructor(private readonly options: OpenCodeCliAgentAdapterOptions) {}

  async sendPrompt(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse> {
    if (agent.provider !== "opencode") {
      throw new Error(`Unsupported agent provider: ${agent.provider}`);
    }

    const executable = resolveOpenCodeExecutable();
    const args = ["run"];
    const model = agent.model ?? this.options.model;

    if (model !== undefined) {
      args.push("--model", model);
    }

    args.push(prompt.text);

    try {
      const result = await runOpenCode(
        executable,
        args,
        this.options.directory,
        this.options.systemPrompt ?? createWorkspaceSystemPrompt(this.options.directory),
      );
      const text = extractCliResponse(result.stdout);

      if (text.length === 0) {
        throw new Error(
          `OpenCode CLI no devolvió texto. Salida: ${result.stderr.trim() || "(vacía)"}`,
        );
      }

      if (process.env.OPENCODE_DEBUG === "1") {
        console.error("[OpenCode CLI debug] stdout:");
        console.error(result.stdout);
        console.error("[OpenCode CLI debug] stderr:");
        console.error(result.stderr);
      }

      return {
        sessionId: null,
        text,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenCode CLI no pudo completar la solicitud: ${message}`);
    }
  }
}

function runOpenCode(
  executable: string,
  args: string[],
  directory: string,
  systemPrompt: string,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return runWithTemporaryInstructions();

  async function runWithTemporaryInstructions(): Promise<{
    readonly stdout: string;
    readonly stderr: string;
  }> {
    const instructionsDirectory = await mkdtemp(join(tmpdir(), "agentic-sdk-opencode-"));
    const instructionsPath = join(instructionsDirectory, "AGENTS.md");

    try {
      await writeFile(instructionsPath, systemPrompt, "utf8");
      return await execute({
        ...process.env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({
          instructions: [instructionsPath],
        }),
      });
    } finally {
      await rm(instructionsDirectory, { recursive: true, force: true });
    }
  }

  function execute(
    env: NodeJS.ProcessEnv,
  ): Promise<{ readonly stdout: string; readonly stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: directory,
        env,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new Error(stderr.trim() || `Proceso finalizó con código ${code ?? "desconocido"}`),
        );
      });
      child.stdin.end();
    });
  }
}

function createWorkspaceSystemPrompt(directory: string): string {
  return [
    "Trabaja exclusivamente dentro del workspace autorizado.",
    `Workspace autorizado: ${directory}`,
    "Interpreta rutas como /projects o projects como un directorio projects dentro del workspace.",
    "No uses rutas de la raíz del sistema ni accedas a C:\\, /, /c o directorios externos.",
    "Si una instrucción solicita una ruta externa, pide confirmación antes de usarla.",
  ].join("\n");
}

function resolveOpenCodeExecutable(): string {
  if (process.platform !== "win32") {
    return "opencode";
  }

  const executable = join(
    process.env.APPDATA ?? "",
    "npm",
    "node_modules",
    "opencode-ai",
    "bin",
    "opencode.exe",
  );

  return existsSync(executable) ? executable : "opencode.cmd";
}

function extractCliResponse(output: string): string {
  const lines = output.trim().split(/\r?\n/);
  if (lines[0]?.startsWith("> ")) {
    lines.shift();
  }

  return lines.join("\n").trim();
}
