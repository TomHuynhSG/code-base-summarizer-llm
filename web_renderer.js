/**
 * Module responsible for rendering the LLM's Markdown response as an HTML page,
 * including support for Mermaid diagrams, and serving it locally.
 */

// --- Core Node.js Modules ---
const http = require('http'); // For creating the local web server

// --- External Dependencies ---
const { marked } = require('marked'); // Library for converting Markdown to HTML
const openModule = require('open'); // Library for opening URLs/files in the default browser

// Handle potential differences in how 'open' is exported (ESM vs CJS)
const openBrowser = openModule.default || openModule;

// --- Utility Functions ---

/**
 * Escapes special HTML characters in a string to prevent XSS or broken HTML.
 * @param {string | null | undefined} unsafe - The potentially unsafe string.
 * @returns {string} The escaped string, safe for embedding in HTML.
 */
function escapeHtml(unsafe) {
    if (!unsafe) return ''; // Return empty string for null/undefined input
    // Replace special characters with their HTML entities
    return unsafe
         .replace(/&/g, "&")   // Use '&' for ampersand
         .replace(/</g, "<")    // Use '<' for less than
         .replace(/>/g, ">")    // Use '>' for greater than
         .replace(/"/g, '"')  // Use '"' for double quote
         .replace(/'/g, "&#039;"); // Use '&#039;' for single quote
 }

// --- Custom Markdown Renderer Configuration ---

// Create a new Marked renderer instance to customize HTML output
const renderer = new marked.Renderer();
// Store the original code rendering function to call it for non-Mermaid blocks
const originalCodeRenderer = renderer.code;

/**
 * Customizes the rendering of code blocks.
 * If the language is 'mermaid', it wraps the code in a <pre class="mermaid"> tag,
 * ensuring the code content is HTML-escaped before embedding.
 * Otherwise, it falls back to the default Marked code block rendering.
 * @param {string} code - The code content within the block.
 * @param {string | undefined} language - The language specified for the code block (e.g., 'javascript', 'mermaid').
 * @param {boolean} isEscaped - Whether the code is already escaped (passed by Marked).
 * @returns {string} The rendered HTML for the code block.
 */
renderer.code = (code, language, isEscaped) => {
  // Check if the language is explicitly 'mermaid'
  if (language === 'mermaid') {
    // Wrap the *escaped* Mermaid definition in a <pre> tag with the 'mermaid' class.
    // Mermaid.js library will find these tags and render the diagrams.
    // Escaping prevents the diagram definition itself from breaking the HTML structure.
    return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
  } else {
    // For any other language, use the original Marked renderer's behavior
    // This ensures syntax highlighting or standard code block formatting applies.
    return originalCodeRenderer.call(renderer, code, language, isEscaped);
  }
};

// --- HTML Page Template ---

/**
 * Generates the full HTML document structure.
 * @param {string} title - The title for the HTML page.
 * @param {string} bodyHtml - The main HTML content (generated from Markdown).
 * @returns {string} The complete HTML page as a string.
 */
const HTML_TEMPLATE = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title> <!-- Escape title just in case -->
    <style>
        /* Basic styling for readability */
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; color: #212529; }
        .container { max-width: 900px; margin: 20px auto; background: #ffffff; padding: 25px 35px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        h1, h2, h3, h4, h5, h6 { color: #0056b3; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.75em; }
        h3 { font-size: 1.5em; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        /* Code blocks (non-Mermaid) */
        pre:not(.mermaid) { background: #f1f3f5; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #dee2e6; }
        code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 0.9em; }
        pre:not(.mermaid) code { display: block; /* Ensure block display for proper formatting */ }
        /* Mermaid diagrams container */
        .mermaid { background: #ffffff; text-align: center; margin-bottom: 20px; padding: 10px; border-radius: 5px; border: 1px solid #dee2e6; }
        /* Tables */
        table { border-collapse: collapse; margin: 15px 0; width: 100%; border: 1px solid #dee2e6; }
        th, td { border: 1px solid #dee2e6; padding: 10px 12px; text-align: left; }
        th { background-color: #e9ecef; font-weight: 600; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        /* Blockquotes */
        blockquote { border-left: 5px solid #adb5bd; padding: 10px 15px; color: #495057; margin: 15px 0; background-color: #f1f3f5; border-radius: 0 5px 5px 0; }
        /* Images */
        img { max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        /* Lists */
        ul, ol { padding-left: 25px; }
        li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapeHtml(title)}</h1> <!-- Add main title heading -->
        ${bodyHtml} <!-- Inject the Markdown-converted HTML -->
    </div>

    <!-- Load Mermaid library from CDN -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>

    <!-- Initialize Mermaid -->
    <script>
        try {
          // Initialize Mermaid to render diagrams in elements with class="mermaid"
          mermaid.initialize({ startOnLoad: true });
        } catch (e) {
          // Log error if Mermaid fails to initialize
          console.error("Failed to initialize Mermaid:", e);
          // Optionally display an error message to the user on the page
          // document.body.insertAdjacentHTML('beforeend', '<p style="color:red;">Error rendering diagrams.</p>');
        }
    </script>
</body>
</html>
`;

// --- Main Rendering and Serving Function ---

/**
 * Renders the provided Markdown content to HTML (using the custom renderer)
 * and starts a local HTTP server to serve the HTML page. Opens the page
 * in the default web browser.
 * @param {string} markdownContent - The Markdown content received from the LLM.
 * @param {string} [projectName='Project Summary'] - The name of the project, used for the page title.
 * @returns {Promise<void>} A promise that resolves when the server is listening and browser is opened, or rejects on error.
 * @throws {Error} If the server fails to start.
 */
async function renderAndServe(markdownContent, projectName = 'Project Summary') {
    // Convert Markdown to HTML using Marked with the custom renderer
    const bodyHtml = marked(markdownContent, { renderer: renderer });
    // Create the full HTML page using the template
    const pageTitle = projectName + ' LLM Analysis';
    const fullHtml = HTML_TEMPLATE(pageTitle, bodyHtml);

    // Create a simple HTTP server
    const server = http.createServer((req, res) => {
        // Set response headers
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            // Prevent caching to ensure the latest version is always shown
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        // Send the generated HTML as the response
        res.end(fullHtml);
    });

    try {
        // Find an available port, starting from 3000
        const port = await getAvailablePort(3000);
        // Start listening on the found port and localhost
        server.listen(port, '127.0.0.1', () => {
            const address = `http://127.0.0.1:${port}`;
            console.log(`\n📊 LLM response rendered. Serving analysis at: ${address}`);
            console.log("   Opening in your default browser...");
            // Open the URL in the default browser
            openBrowser(address);
            // Add a small delay before logging completion? Optional.
            // setTimeout(() => console.log("   Browser launch initiated."), 500);
        });

        // Basic error handling for the server *after* it starts listening
        server.on('error', (e) => {
            console.error('❌ Server runtime error:', e.message);
        });

    } catch (error) {
         // Handle errors during port finding or server startup
         console.error('❌ Failed to start web server:', error.message);
         // Re-throw the error so index.js can catch it and exit gracefully
         throw new Error(`Failed to start web server: ${error.message}`);
    }
}

// --- Port Finding Utility ---

/**
 * Finds an available network port by trying to listen on startingPort
 * and incrementing if it's already in use.
 * @param {number} startPort - The initial port number to try.
 * @returns {Promise<number>} A promise that resolves with an available port number.
 * @rejects {Error} If an error other than 'EADDRINUSE' occurs.
 */
function getAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(); // Create a temporary server
        // Try to listen on the specified port and localhost
        server.listen(startPort, '127.0.0.1');

        // Event listener for successful listening
        server.on('listening', () => {
            const port = server.address().port; // Get the actual port assigned
            // Close the temporary server
            server.close(() => {
                resolve(port); // Resolve the promise with the available port
            });
        });

        // Event listener for errors (e.g., port in use)
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                // If port is in use, close the server and try the next port recursively
                // console.log(`Port ${startPort} in use, trying ${startPort + 1}...`); // Optional: Log port attempts
                server.close();
                // Recursively call getAvailablePort with the next port number
                getAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                // If it's a different error, reject the promise
                reject(err);
            }
        });
    });
}

// --- Module Exports ---
module.exports = {
    renderAndServe // Export the main rendering/serving function
};
