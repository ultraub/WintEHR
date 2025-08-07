/**
 * SDK Runner Script
 * This script is used by the Python SDK service to execute Anthropic API calls
 */

const Anthropic = require('@anthropic-ai/sdk');

async function runRequest() {
    try {
        // Get request from command line argument
        const requestData = JSON.parse(process.argv[2]);
        const { action, prompt, options = {} } = requestData;
        
        // Initialize Anthropic client
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        let result;
        
        switch (action) {
            case 'test':
                // Simple test
                const testMessage = await anthropic.messages.create({
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 50,
                    temperature: 0,
                    messages: [{
                        role: "user",
                        content: "Say 'SDK is working'"
                    }]
                });
                result = {
                    success: true,
                    message: testMessage.content[0].text
                };
                break;
                
            case 'complete':
                // Full completion
                const message = await anthropic.messages.create({
                    model: options.model || "claude-3-5-sonnet-20241022",
                    max_tokens: options.max_tokens || 1024,
                    temperature: options.temperature || 0,
                    messages: [{
                        role: "user",
                        content: prompt
                    }]
                });
                // Clean up the response - remove markdown code blocks if present
                let response = message.content[0].text;
                
                // Remove markdown code blocks
                if (response.includes('```')) {
                    // Extract code from markdown blocks
                    const codeBlockRegex = /```(?:jsx?|javascript|typescript|tsx?)?\n?([\s\S]*?)```/g;
                    const matches = [...response.matchAll(codeBlockRegex)];
                    if (matches.length > 0) {
                        response = matches[0][1].trim();
                    }
                }
                
                result = {
                    success: true,
                    response: response,
                    usage: message.usage ? {
                        input_tokens: message.usage.input_tokens,
                        output_tokens: message.usage.output_tokens
                    } : null
                };
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        // Output result as JSON
        process.stdout.write(JSON.stringify(result));
        
    } catch (error) {
        process.stdout.write(JSON.stringify({
            success: false,
            error: error.message
        }));
        process.exit(1);
    }
}

runRequest();