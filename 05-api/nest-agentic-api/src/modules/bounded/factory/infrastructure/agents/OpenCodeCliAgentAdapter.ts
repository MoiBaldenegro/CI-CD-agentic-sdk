import { Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import {
  TASK_AGENT_STATUS_INSTRUCTIONS,
  type AgentGateway,
  type AgentPrimitives,
  type AgentPrompt,
  type AgentResponse,
} from 'lib/factory';
import { resolveWorkspace } from '../../../../../global/agent.config';
import { ghGitEnv } from '../github/gh-git-env';

export interface OpenCodeCliAgentAdapterOptions {
  readonly directory: string;
  readonly model?: string;
  readonly systemPrompt?: string;
  readonly timeoutMs: number;
  readonly gitAccess: boolean;
}

export class OpenCodeCliAgentAdapter implements AgentGateway {
  private readonly logger = new Logger(OpenCodeCliAgentAdapter.name);

  constructor(private readonly options: OpenCodeCliAgentAdapterOptions) {}

  async sendPrompt(
    agent: AgentPrimitives,
    prompt: AgentPrompt,
  ): Promise<AgentResponse> {
    if (agent.provider !== 'opencode') {
      throw new Error(`Unsupported agent provider: ${agent.provider}`);
    }

    const chatOnly = prompt.toolsEnabled === false;

    // Modo conversación: carpeta temporal vacía + todas las herramientas
    // bloqueadas. Modo normal: la carpeta pedida debe estar dentro de
    // ./work-directory.
    const directory = chatOnly
      ? await mkdtemp(join(tmpdir(), 'agentic-sdk-chat-'))
      : prompt.workingDirectory !== undefined
        ? resolveWorkspace(prompt.workingDirectory)
        : this.options.directory;
    const executable = resolveOpenCodeExecutable();
    const args = ['run'];
    const model = agent.model ?? this.options.model;

    if (model !== undefined) {
      args.push('--model', model);
    }

    if (debugEnabled()) {
      args.push('--print-logs', '--log-level', 'DEBUG');
    }

    if (thinkingEnabled()) {
      args.push('--thinking');
    }

    args.push(prompt.text);

    this.logger.log(
      `Enviando prompt a OpenCode CLI (agent=${agent.provider}:${agent.agentId}, model=${model ?? 'default'}, mode=${chatOnly ? 'chat' : 'tools'}, cwd=${directory}, chars=${prompt.text.length})`,
    );
    this.logger.log(`Ejecutando: ${executable} ${args.join(' ')}`);

    try {
      await mkdir(directory, { recursive: true });

      const result = chatOnly
        ? await runOpenCode(executable, args, directory, {
            systemPrompt: CHAT_SYSTEM_PROMPT,
            timeoutMs: CHAT_TIMEOUT_MS,
            extraEnv: {},
            permission: DENY_ALL_TOOLS,
          })
        : await runOpenCode(executable, args, directory, {
            systemPrompt: withStatusProtocol(
              this.options.systemPrompt ??
                createWorkspaceSystemPrompt(directory, this.options.gitAccess),
            ),
            timeoutMs: this.options.timeoutMs,
            extraEnv: this.options.gitAccess ? ghGitEnv() : {},
            // Bloquea lecturas/escrituras fuera del cwd (el workspace).
            // En `opencode run` no hay humano para aprobar, así que "deny".
            permission: { external_directory: 'deny' },
          });
      const text = extractCliResponse(result.stdout);

      if (text.length === 0) {
        throw new Error(
          `OpenCode CLI no devolvió texto. Salida: ${result.stderr.trim() || '(vacía)'}`,
        );
      }

      if (process.env.OPENCODE_DEBUG === '1') {
        console.error('[OpenCode CLI debug] stdout:');
        console.error(result.stdout);
        console.error('[OpenCode CLI debug] stderr:');
        console.error(result.stderr);
      }

      this.logger.log(`OpenCode CLI respondió ${text.length} caracteres`);

      return {
        sessionId: null,
        text,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenCode CLI falló: ${message}`);
      throw new Error(
        `OpenCode CLI no pudo completar la solicitud: ${message}`,
      );
    } finally {
      if (chatOnly) {
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
}

const CHAT_TIMEOUT_MS = 3 * 60 * 1_000;

const CHAT_SYSTEM_PROMPT = [
  'Estás en modo conversación: no tienes herramientas.',
  'No intentes leer, crear ni modificar archivos, ni ejecutar comandos.',
  'Responde únicamente con texto, siguiendo el formato que pida el mensaje.',
].join('\n');

// `read` NO se bloquea: con read=deny OpenCode 1.18 se cuelga (lo necesita
// internamente). Es seguro porque el modo conversación corre en una carpeta
// temporal vacía y external_directory=deny impide leer fuera de ella.
const DENY_ALL_TOOLS = Object.fromEntries(
  [
    'edit',
    'glob',
    'grep',
    'list',
    'bash',
    'task',
    'external_directory',
    'todowrite',
    'question',
    'webfetch',
    'websearch',
    'lsp',
    'skill',
  ].map((tool) => [tool, 'deny']),
);

interface RunOpenCodeOptions {
  readonly systemPrompt: string;
  readonly timeoutMs: number;
  readonly extraEnv: NodeJS.ProcessEnv;
  readonly permission: Record<string, string>;
}

function runOpenCode(
  executable: string,
  args: string[],
  directory: string,
  { systemPrompt, timeoutMs, extraEnv, permission }: RunOpenCodeOptions,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return runWithTemporaryInstructions();

  async function runWithTemporaryInstructions(): Promise<{
    readonly stdout: string;
    readonly stderr: string;
  }> {
    const instructionsDirectory = await mkdtemp(
      join(tmpdir(), 'agentic-sdk-opencode-'),
    );
    const instructionsPath = join(instructionsDirectory, 'AGENTS.md');

    try {
      await writeFile(instructionsPath, systemPrompt, 'utf8');
      return await execute({
        ...process.env,
        ...extraEnv,
        OPENCODE_CONFIG_CONTENT: JSON.stringify({
          instructions: [instructionsPath],
          permission,
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
      const useShell = needsShell(executable);
      const child = spawn(
        executable,
        useShell ? args.map(quoteForShell) : args,
        {
          cwd: directory,
          env,
          windowsHide: true,
          shell: useShell,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        killProcessTree(child.pid);
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (debugEnabled()) {
          process.stderr.write(chunk);
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (debugEnabled()) {
          process.stderr.write(chunk);
        }
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);

        if (timedOut) {
          reject(
            new Error(
              `OpenCode CLI excedió el timeout de ${timeoutMs} ms y fue terminado`,
            ),
          );
          return;
        }

        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new Error(
            stderr.trim() ||
              `Proceso finalizó con código ${code ?? 'desconocido'}`,
          ),
        );
      });
      child.stdin.end();
    });
  }
}

function killProcessTree(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    // Con shell: true el hijo es cmd.exe; hay que matar todo el árbol.
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    }).on('error', () => undefined);
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // El proceso ya terminó.
  }
}

function createWorkspaceSystemPrompt(
  directory: string,
  gitAccess: boolean,
): string {
  return [
    'Trabaja exclusivamente dentro del workspace autorizado.',
    `Workspace autorizado: ${directory}`,
    'Interpreta rutas como /projects o projects como un directorio projects dentro del workspace.',
    'No uses rutas de la raíz del sistema ni accedas a C:\\, /, /c o directorios externos.',
    'Si una instrucción solicita una ruta externa, pide confirmación antes de usarla.',
    gitAccess
      ? 'Puedes usar git y gh (sesión de GitHub ya autenticada) solo sobre el repositorio de este directorio: commits, ramas, push, PRs e issues de ese repo. No crees, borres ni modifiques otros repositorios, no cambies su configuración ni la visibilidad, y no hagas push --force.'
      : 'No ejecutes git ni gh: la fábrica se encarga de commits, push y repositorios.',
  ].join('\n');
}

function withStatusProtocol(systemPrompt: string): string {
  return [systemPrompt.trim(), TASK_AGENT_STATUS_INSTRUCTIONS].join('\n\n');
}

function resolveOpenCodeExecutable(): string {
  const override = process.env.OPENCODE_BIN?.trim();
  if (override !== undefined && override.length > 0) {
    return override;
  }

  if (process.platform !== 'win32') {
    return 'opencode';
  }

  const candidates = [
    join(
      process.env.APPDATA ?? '',
      'npm',
      'node_modules',
      'opencode-ai',
      'bin',
      'opencode.exe',
    ),
    join(homedir(), '.opencode', 'bin', 'opencode.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'opencode', 'bin', 'opencode.exe'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const onPath = findOnPath(['opencode.exe', 'opencode.cmd', 'opencode.bat']);
  return onPath ?? 'opencode.cmd';
}

function findOnPath(fileNames: string[]): string | undefined {
  const directories = (process.env.PATH ?? '').split(delimiter);

  for (const directory of directories) {
    if (directory.length === 0) {
      continue;
    }

    for (const fileName of fileNames) {
      const candidate = join(directory, fileName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function debugEnabled(): boolean {
  return process.env.OPENCODE_DEBUG === '1';
}

function thinkingEnabled(): boolean {
  const value = process.env.OPENCODE_THINKING?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

function needsShell(executable: string): boolean {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
}

function quoteForShell(arg: string): string {
  if (arg.length === 0) {
    return '""';
  }

  if (!/[\s"&|<>^]/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '""')}"`;
}

function extractCliResponse(output: string): string {
  const lines = output.trim().split(/\r?\n/);
  if (lines[0]?.startsWith('> ')) {
    lines.shift();
  }

  return lines.join('\n').trim();
}
