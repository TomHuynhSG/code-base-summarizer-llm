const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai'); // Import OpenAI client

// Placeholder tag in the prompt template
const SUMMARY_PLACEHOLDER = '{{SUMMARY}}';

async function processWithLLM(summary, options) {
    const { promptTemplatePath, model, temperature, apiKey } = options;

    if (!apiKey) {
        throw new Error("OpenAI API key is not provided. Please set OPENAI_API_KEY in your .env file.");
    }

    // 1. Read Prompt Template
    let promptTemplate;
    try {
        promptTemplate = await fs.readFile(promptTemplatePath, 'utf8');
    } catch (error) {
        throw new Error(`Error reading prompt template file "${promptTemplatePath}": ${error.message}`);
    }

    // 2. Inject Summary
    if (!promptTemplate.includes(SUMMARY_PLACEHOLDER)) {
        console.warn(`Warning: Prompt template "${promptTemplatePath}" does not contain the placeholder "${SUMMARY_PLACEHOLDER}". Summary will be appended.`);
        promptTemplate = promptTemplate + `\n\nProject Summary:\n---\n${SUMMARY_PLACEHOLDER}\n---`;
    }
    const finalPrompt = promptTemplate.replace(SUMMARY_PLACEHOLDER, summary);

    // 3. Call OpenAI API
    const openai = new OpenAI({
        apiKey: apiKey,
    });

    console.log(`\nSending prompt to OpenAI (Model: ${model}, Temperature: ${temperature})...`);

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: finalPrompt }],
            model: model,
            temperature: temperature,
            // Add other model parameters from options if needed
            // max_tokens: 1000,
        });

        const llmResponse = completion.choices[0]?.message?.content;

        if (!llmResponse) {
            console.warn("OpenAI returned an empty response.");
            return "Received an empty response from the AI.";
        }

        console.log("Received response from OpenAI.");
        return llmResponse;

    } catch (error) {
        console.error("Error calling OpenAI API:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
        throw new Error("Failed to get response from OpenAI API.");
    }
}

module.exports = {
    processWithLLM
};