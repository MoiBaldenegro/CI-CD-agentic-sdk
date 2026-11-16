import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { Agent } from "../../core/domain/Agent.entity.js";
import { TaskDescription } from "../../core/domain/value-objects/task/TaskDescription.vo.js";
import { RepositoryRef } from "../../core/domain/value-objects/task/RepositoryRef.vo.js";
import { TaskSource } from "../../core/domain/value-objects/task/TaskSource.vo.js";
import { TaskTitle } from "../../core/domain/value-objects/task/TaskTitle.vo.js";
import {
  createOpenCodeApplicationContainer,
  createOpenRouterApplicationContainer,
  type ApplicationContainer,
} from "../container/ApplicationContainer.js";

export async function main(): Promise<void> {
  const readline = createInterface({ input, output });

  try {
    const mode = await readline.question(
      "Modo: [1] Ejecutar tarea  [2] Chat\nSelecciona un modo: ",
    );

    if (!["1", "2"].includes(mode.trim())) {
      console.log("Modo no válido. Usa 1 para tarea o 2 para chat.");
      return;
    }

    const provider = await readline.question(
      "Proveedor: [1] OpenRouter  [2] OpenCode\nSelecciona un proveedor: ",
    );
    if (!["1", "2"].includes(provider.trim())) {
      console.log("Proveedor no válido. Usa 1 para OpenRouter o 2 para OpenCode.");
      return;
    }
    const useOpenRouter = provider.trim() === "1";
    const model = useOpenRouter
      ? undefined
      : await readline.question(
          "Modelo OpenCode [1] automático [2] big-pickle [3] escribir ID: ",
        );
    const openCodeModel = useOpenRouter
      ? undefined
      : await selectOpenCodeModel(readline, model);
    const directoryInput = await readline.question(`Directorio [${process.cwd()}]: `);
    const directory = resolve(directoryInput.trim() || process.cwd());
    assertDirectoryExists(directory);

    const container = createContainer(useOpenRouter, directory);
    const agent = Agent.create({
      provider: useOpenRouter ? "openrouter" : "opencode",
      agentId: useOpenRouter
        ? (process.env.OPENROUTER_MODEL ?? "openrouter")
        : "opencode",
      model: useOpenRouter ? process.env.OPENROUTER_MODEL : null,
    });

    if (mode.trim() === "1") {
      await runTaskMode(readline, container, agent);
    } else if (mode.trim() === "2") {
      await runChatMode(readline, container, agent);
    }

    function createContainer(useOpenRouter: boolean, directory: string): ApplicationContainer {
      if (!useOpenRouter) {
        return createOpenCodeApplicationContainer(directory, openCodeModel);
      }

      const apiKey = process.env.OPENROUTER_API_KEY;
      const model = process.env.OPENROUTER_MODEL;
      if (apiKey === undefined || model === undefined) {
        throw new Error(
          "Configura OPENROUTER_API_KEY y OPENROUTER_MODEL en el archivo .env",
        );
      }

      return createOpenRouterApplicationContainer({
        apiKey,
        model,
        siteUrl: process.env.OPENROUTER_SITE_URL,
        appName: process.env.OPENROUTER_APP_NAME,
      });
    }
  } finally {
    readline.close();
  }
}

async function selectOpenCodeModel(
  readline: ReturnType<typeof createInterface>,
  selection: string | undefined,
): Promise<string | undefined> {
  if (selection?.trim() === "1" || selection?.trim().length === 0) {
    return undefined;
  }

  if (selection?.trim() === "2") {
    return "opencode/big-pickle";
  }

  if (selection?.trim() === "3") {
    const model = await readline.question("ID del modelo (provider/model): ");
    if (model.trim().length === 0) {
      throw new Error("El ID del modelo no puede estar vacío.");
    }
    return model.trim();
  }

  throw new Error("Selección de modelo no válida. Usa 1, 2 o 3.");
}

function assertDirectoryExists(directory: string): void {
  try {
    if (!statSync(directory).isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(`El directorio no existe o no es válido: ${directory}`);
  }
}

async function runTaskMode(
  readline: ReturnType<typeof createInterface>,
  container: ReturnType<typeof createOpenCodeApplicationContainer>,
  agent: ReturnType<typeof Agent.create>,
): Promise<void> {
  const title = await readline.question("Título de la tarea: ");
  const description = await readline.question("Descripción de la tarea: ");
  const instructions = await readline.question("Instrucciones para el agente: ");

  const task = container.tasks.createTask({
    title: TaskTitle.from(title),
    description: TaskDescription.from(description),
    source: TaskSource.manual(),
    repository: RepositoryRef.from("local", "project"),
  });

  console.log(`\nTarea creada: ${task.id}`);
  console.log("Ejecutando tarea...\n");

  const response = await container.agents.sendPrompt(agent, {
    text: [
      `Título: ${task.title}`,
      `Descripción: ${task.description}`,
      `Instrucciones: ${instructions}`,
    ].join("\n\n"),
  });

  console.log(`OpenCode:\n${response.text}`);
  console.log(`\nSesión: ${response.sessionId ?? "no disponible"}`);
}

async function runChatMode(
  readline: ReturnType<typeof createInterface>,
  container: ReturnType<typeof createOpenCodeApplicationContainer>,
  agent: ReturnType<typeof Agent.create>,
): Promise<void> {
  console.log("\nChat iniciado. Escribe 'salir' o 'exit' para terminar.\n");

  while (true) {
    const prompt = await readline.question("Tú: ");

    if (["salir", "exit"].includes(prompt.trim().toLowerCase())) {
      break;
    }

    const response = await container.agents.sendPrompt(agent, { text: prompt });
    console.log(`\nOpenCode: ${response.text}\n`);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
