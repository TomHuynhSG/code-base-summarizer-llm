const http = require('http');
const path = require('path');
// const open = require('open'); // <-- Remove or modify this line
const { marked } = require('marked'); // For Markdown to HTML conversion

// Import the open module and access its default export
// Use a variable name other than 'open' initially to avoid confusion
const openModule = require('open');
const openBrowser = openModule.default || openModule; // Access .default or fallback if it's a direct export

// Simple HTML template
const HTML_TEMPLATE = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; margin: 20px; background-color: #f8f8f8; color: #333; }
        .container { max-width: 900px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #0056b3; margin-top: 20px; }
        pre { background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace; }
        pre code { display: block; }
        table { border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; margin: 10px 0; }
        img { max-width: 100%; height: auto; } /* Make images responsive */
    </style>
</head>
<body>
    <div class="container">
        ${bodyHtml}
    </div>
</body>
</html>
`;

async function renderAndServe(markdownContent, projectName = 'Project Summary') {
    // 1. Convert Markdown to HTML
    const bodyHtml = marked(markdownContent);

    // 2. Create full HTML page
    const fullHtml = HTML_TEMPLATE(projectName + ' LLM Analysis', bodyHtml);

    // 3. Start a simple HTTP server
    const server = http.createServer((req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(fullHtml);
    });

    const port = await getAvailablePort(3000); // Find an available port starting from 3000

    server.listen(port, '127.0.0.1', () => {
        const address = `http://127.0.0.1:${port}`;
        console.log(`\nLLM response rendered. Serving on ${address}`);
        console.log("Opening in your default browser...");
        // Use the correctly accessed function
        openBrowser(address); // <-- Corrected function call

        // Optional: Close server after a delay or on process exit if needed
        // For this use case (displaying static output), keeping it open is fine until the script exits.
    });

    server.on('error', (e) => {
        console.error('Server error:', e.message);
    });
}

// Helper to find an available port
function getAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(startPort, '127.0.0.1');
        server.on('listening', () => {
            const port = server.address().port;
            server.close(() => {
                resolve(port);
            });
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                getAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}


module.exports = {
    renderAndServe
};