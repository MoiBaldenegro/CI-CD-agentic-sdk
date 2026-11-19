/** Ejecutable de GitHub CLI (override con GH_BIN). */
export function ghExecutable(): string {
  return process.env.GH_BIN?.trim() || 'gh';
}

/**
 * Variables de entorno que hacen que `git` use la sesión de `gh` como
 * credencial y que ni git ni gh pidan datos interactivos (se colgarían).
 * Usa GIT_CONFIG_COUNT (git >= 2.31): no modifica la config global.
 */
export function ghGitEnv(): NodeJS.ProcessEnv {
  const gh = ghExecutable().replace(/\\/g, '/');

  return {
    GIT_CONFIG_COUNT: '2',
    // Valor vacío: limpia los helpers previos (p. ej. Git Credential Manager).
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'credential.helper',
    GIT_CONFIG_VALUE_1: `!"${gh}" auth git-credential`,
    GIT_TERMINAL_PROMPT: '0',
    GH_PROMPT_DISABLED: '1',
  };
}
