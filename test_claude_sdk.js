// Test Claude Code SDK
const { query } = require("@anthropic-ai/claude-code");

async function test() {
    try {
        console.log("Testing Claude Code SDK...");
        console.log("API Key:", process.env.ANTHROPIC_API_KEY ? "Set" : "Not set");
        
        let response = "";
        for await (const message of query({
            prompt: "Say 'Hello from Claude SDK'",
            options: { maxTurns: 1 }
        })) {
            if (message.type === 'assistant' && message.content) {
                response += message.content;
            }
        }
        console.log("Response:", response);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();