// Test Anthropic SDK
require('dotenv').config({ path: __dirname + '/.env' });
const Anthropic = require('@anthropic-ai/sdk');

async function test() {
    try {
        console.log("Testing Anthropic SDK...");
        console.log("API Key:", process.env.ANTHROPIC_API_KEY ? "Set" : "Not set");
        
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        const message = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 100,
            temperature: 0,
            messages: [
                {
                    role: "user",
                    content: "Say 'Hello from Anthropic SDK'"
                }
            ]
        });
        
        console.log("Response:", message.content[0].text);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();