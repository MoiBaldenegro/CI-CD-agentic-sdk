import { OpenCode } from "@opencode/sdk"

await using opencode = await OpenCode.create()
const session = await opencode.sessions.create({
  location: { directory: process.cwd() },
})

await opencode.sessions.prompt({
  sessionID: session.id,
  text: "Review the current changes",
})

await opencode.sessions.wait({ sessionID: session.id })

const messages = await opencode.message.list({
  sessionID: session.id,
})

console.dir(messages, { depth: null })