import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AGENT_WORK_ROOT } from '../../../../../global/agent.config';

export interface RepositoryTarget {
  readonly owner: string;
  readonly name: string;
  readonly baseBranch: string;
}

export interface PreparedRepository {
  readonly directory: string;
  readonly url: string;
  readonly created: boolean;
}

export interface PublishResult {
  readonly pushed: boolean;
  readonly commitSha: string | null;
}

const COMMAND_TIMEOUT_MS = 5 * 60 * 1_000;

/**
 * Crea/clona repos de GitHub con la sesión de `gh` de la máquina
 * y publica los cambios del agente. El agente nunca ejecuta git ni gh:
 * solo edita archivos dentro del clon.
 */
@Injectable()
export class GhCliRepositoryWorkspace {
  private readonly logger = new Logger(GhCliRepositoryWorkspace.name);
  private readonly gh = process.env.GH_BIN?.trim() || 'gh';

  async prepare(
    repo: RepositoryTarget,
    options: { description: string; visibility: 'private' | 'public' },
  ): Promise<PreparedRepository> {
    assertSafeSegment('owner', repo.owner);
    assertSafeSegment('name', repo.name);

    const fullName = `${repo.owner}/${repo.name}`;
    const directory = join(AGENT_WORK_ROOT, 'repos', repo.owner, repo.name);

    let url = await this.findRepository(fullName);
    let created = false;

    if (url === null) {
      this.logger.log(`Creando repo ${fullName} (${options.visibility})`);
      const output = await this.run(this.gh, [
        'repo',
        'create',
        fullName,
        `--${options.visibility}`,
        '--description',
        options.description.slice(0, 350),
      ]);
      url = output.trim().split(/\r?\n/).pop() ?? `https://github.com/${fullName}`;
      created = true;
    } else {
      this.logger.log(`Repo ${fullName} ya existe: ${url}`);
    }

    await this.syncClone(fullName, directory, repo.baseBranch);

    return { directory, url, created };
  }

  async publish(
    directory: string,
    baseBranch: string,
    message: string,
  ): Promise<PublishResult> {
    await this.git(directory, ['add', '-A']);

    const status = await this.git(directory, ['status', '--porcelain']);
    if (status.trim().length === 0) {
      this.logger.warn(`Sin cambios para publicar en ${directory}`);
      return { pushed: false, commitSha: null };
    }

    await this.git(directory, ['commit', '-m', message]);
    await this.git(directory, ['push', '-u', 'origin', baseBranch]);
    const commitSha = (await this.git(directory, ['rev-parse', 'HEAD'])).trim();

    this.logger.log(`Push a ${baseBranch} commit=${commitSha}`);
    return { pushed: true, commitSha };
  }

  private async findRepository(fullName: string): Promise<string | null> {
    try {
      const output = await this.run(this.gh, [
        'repo',
        'view',
        fullName,
        '--json',
        'url',
        '-q',
        '.url',
      ]);
      return output.trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/could not resolve|not found/i.test(message)) {
        return null;
      }
      throw error;
    }
  }

  private async syncClone(
    fullName: string,
    directory: string,
    baseBranch: string,
  ): Promise<void> {
    if (!existsSync(join(directory, '.git'))) {
      await mkdir(dirname(directory), { recursive: true });
      this.logger.log(`Clonando ${fullName} en ${directory}`);
      await this.git(dirname(directory), [
        'clone',
        `https://github.com/${fullName}.git`,
        directory,
      ]);
    } else {
      await this.git(directory, ['fetch', 'origin']);
    }

    const remoteHead = await this.git(directory, [
      'ls-remote',
      '--heads',
      'origin',
      baseBranch,
    ]);

    if (remoteHead.trim().length > 0) {
      // El clon es de la fábrica: se descarta cualquier resto local
      // de una ejecución anterior y se parte de origin/<baseBranch>.
      await this.git(directory, [
        'checkout',
        '-f',
        '-B',
        baseBranch,
        `origin/${baseBranch}`,
      ]);
    } else {
      // Repo vacío (recién creado): rama sin commits todavía.
      await this.git(directory, ['checkout', '-f', '-B', baseBranch]);
    }
  }

  private git(cwd: string, args: string[]): Promise<string> {
    // Credenciales vía `gh` solo para estos comandos; no toca la config global.
    return this.run(
      'git',
      [
        '-c',
        'credential.helper=',
        '-c',
        `credential.helper=!"${this.gh.replace(/\\/g, '/')}" auth git-credential`,
        ...args,
      ],
      cwd,
    );
  }

  private run(command: string, args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd,
          windowsHide: true,
          timeout: COMMAND_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `${command} ${args.filter((a) => !a.startsWith('credential.')).join(' ')} falló: ${stderr.trim() || error.message}`,
              ),
            );
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}

function assertSafeSegment(field: string, value: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || /^\.+$/.test(value)) {
    throw new Error(`repository.${field} inválido: "${value}"`);
  }
}
