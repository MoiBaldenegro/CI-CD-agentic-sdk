import { OpenCode } from "@opencode/sdk"

await using opencode = await OpenCode.create()
const session = await opencode.sessions.create({
  location: { directory: "/workspace" },
})

await opencode.sessions.prompt({
  sessionID: session.id,
  text: "Review the current changes",
})