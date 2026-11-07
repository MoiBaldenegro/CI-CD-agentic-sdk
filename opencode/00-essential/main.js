import { OpenCode } from "@opencode/sdk"

await using opencode = await OpenCode.create()
const session = await opencode.sessions.create({
  location: { directory: process.cwd() },
})

const response = await opencode.sessions.prompt({
  sessionID: session.id,
  text: "Review the current changes",
})

console.dir(response, { depth: null })