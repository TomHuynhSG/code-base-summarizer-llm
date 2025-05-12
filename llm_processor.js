/**
 * Module responsible for interacting with the OpenAI API.
 * It takes the generated project summary, injects it into a prompt template,
 * sends it to the specified OpenAI model, and returns the response.
 */

// --- Core Node.js Modules ---
const fs = require('fs').promises; // For reading the prompt template file
const path = require('path'); // For path manipulation (though less used here)

// --- External Dependencies ---
const OpenAI = require('openai'); // Official OpenAI client library

// --- Constants ---
/**
 * The placeholder string expected within the prompt template file.
 * This string will be replaced with the actual project summary.
 * @type {string}
 */
const SUMMARY_PLACEHOLDER = '{{SUMMARY}}';

/**
 * Processes the generated project summary using an OpenAI LLM.
 *
 * @param {string} summary - The generated project summary string.
 * @param {object} options - Configuration options for LLM processing.
 * @param {string} options.promptTemplatePath - Path to the prompt template file.
 * @param {string} options.model - The OpenAI model name to use (e.g., 'gpt-4o', 'gpt-3.5-turbo').
 * @param {number} options.temperature - The temperature setting for the LLM (0.0 to 2.0).
 * @param {string} options.apiKey - The OpenAI API key.
 * @returns {Promise<string>} The text response from the LLM.
 * @throws {Error} If the API key is missing, the prompt file cannot be read, or the API call fails.
 */
async function processWithLLM(summary, options) {
    const { promptTemplatePath, model, temperature, apiKey } = options;

    // --- Validate API Key ---
    if (!apiKey) {
        // Throw an error immediately if the API key is missing
        throw new Error("OpenAI API key is not provided. Please set OPENAI_API_KEY in your .env file or environment variables.");
    }

    // --- 1. Read Prompt Template ---
    let promptTemplate;
    try {
        // Read the content of the specified prompt template file
        promptTemplate = await fs.readFile(promptTemplatePath, 'utf8');
        console.log(`Read prompt template from: ${promptTemplatePath}`);
    } catch (error) {
        // Throw an error if the file cannot be read
        throw new Error(`Error reading prompt template file "${promptTemplatePath}": ${error.message}`);
    }

    // --- 2. Inject Summary into Prompt ---
    let finalPrompt;
    if (promptTemplate.includes(SUMMARY_PLACEHOLDER)) {
        // Replace the placeholder with the actual summary
        finalPrompt = promptTemplate.replace(SUMMARY_PLACEHOLDER, summary);
    } else {
        // If placeholder is missing, warn the user and append the summary
        console.warn(`⚠️ Warning: Prompt template "${promptTemplatePath}" does not contain the placeholder "${SUMMARY_PLACEHOLDER}". The summary will be appended to the end of the template.`);
        // Append the summary with clear separators
        finalPrompt = promptTemplate + `\n\n--- Project Summary Start ---\n${summary}\n--- Project Summary End ---`;
    }

    // --- 3. Initialize OpenAI Client and Call API ---
    const openai = new OpenAI({
        apiKey: apiKey, // Pass the validated API key
    });

    console.log(`\n🤖 Sending request to OpenAI API... (Model: ${model}, Temperature: ${temperature})`);

    try {
        // Make the API call to the chat completions endpoint
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: finalPrompt }], // Use the final prompt as user input
            model: model, // Specify the desired model
            temperature: temperature, // Set the creativity/randomness
            // Consider adding other parameters like max_tokens if needed
            // max_tokens: 4096, // Example: Limit response length
        });

        // Extract the response content
        // Uses optional chaining (?.) in case the structure is unexpected
        const llmResponse = completion.choices[0]?.message?.content;

        // Check if a valid response was received
        if (!llmResponse || llmResponse.trim() === '') {
            console.warn("⚠️ OpenAI API returned an empty or invalid response.");
            // Return a placeholder message instead of null/undefined
            return "Received an empty response from the AI.";
        }

        console.log("✅ Received response from OpenAI.");
        return llmResponse; // Return the successful response

    } catch (error) {
        // Handle errors during the API call
        console.error("❌ Error calling OpenAI API:");
        // Provide more detailed error info if available (e.g., from Axios-like errors)
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error('   Data:', error.response.data);
        } else {
            // Log the general error message
            console.error('   Message:', error.message);
        }
        // Re-throw a more specific error for the calling function (index.js) to handle
        throw new Error("Failed to get response from OpenAI API. Check console logs for details.");
    }
}

// --- Module Exports ---
module.exports = {
    processWithLLM // Export the main processing function
};
