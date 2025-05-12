// --- File: web_renderer.js ---
const http = require('http');
const { marked } = require('marked');
const openModule = require('open');
const openBrowser = openModule.default || openModule;

// *** NEW: Simple HTML Escaping Function ***
function escapeHtml(unsafe) {
    if (!unsafe) return ''; // Handle null or undefined input
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// --- Custom Marked Renderer ---
const renderer = new marked.Renderer();
const originalCodeRenderer = renderer.code;

renderer.code = (code, language, isEscaped) => {
  if (language === 'mermaid') {
    // *** UPDATED: Escape the code before putting it in <pre> ***
    // Mermaid reads the text content, but escaping prevents broken HTML
    return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
  } else {
    // Use the default Marked renderer for all other code blocks
    return originalCodeRenderer.call(renderer, code, language, isEscaped);
  }
};

// --- HTML Template ---
// *** UPDATED: Use a specific Mermaid version ***
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
        pre:not(.mermaid) { background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace; }
        pre:not(.mermaid) code { display: block; }
        .mermaid { background: #fff; text-align: center; margin-bottom: 15px; border-radius: 4px; }
        /* Add other styles: table, blockquote, img */
        table { border-collapse: collapse; margin: 10px 0; width: 100%; } /* Ensure table width */
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; margin: 10px 0; }
        img { max-width: 100%; height: auto; display: block; margin: 10px auto; } /* Center images */
    </style>
</head>
<body>
    <div class="container">
        ${bodyHtml}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>

    <script>
        try {
          mermaid.initialize({ startOnLoad: true });
        } catch (e) {
          console.error("Failed to initialize Mermaid:", e);
          // Optionally display an error message to the user on the page
        }
    </script>
</body>
</html>
`;

// --- renderAndServe Function ---
async function renderAndServe(markdownContent, projectName = 'Project Summary') {
    // Use the custom renderer with escaping
    const bodyHtml = marked(markdownContent, { renderer: renderer });
    const fullHtml = HTML_TEMPLATE(projectName + ' LLM Analysis', bodyHtml);
    const server = http.createServer((req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(fullHtml);
    });

    try {
        const port = await getAvailablePort(3000);
        server.listen(port, '127.0.0.1', () => {
            const address = `http://127.0.0.1:${port}`;
            console.log(`\nLLM response rendered. Serving on ${address}`);
            console.log("Opening in your default browser...");
            openBrowser(address);
        });
        server.on('error', (e) => {
            // This typically handles errors *after* the server has started,
            // like a problem with a specific request.
            // For startup errors, the .listen callback or the try/catch around getAvailablePort is key.
            console.error('Server runtime error:', e.message); 
        });
    } catch (error) {
         // This catch block handles errors from getAvailablePort or server.listen itself.
         console.error('Failed to start web server:', error.message);
         throw new Error(`Failed to start web server: ${error.message}`); // Re-throw to be caught by index.js
    }
}

// --- getAvailablePort Function (remains the same) ---
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
                // console.log(`Port ${startPort} in use, trying ${startPort + 1}...`);
                // Reduce noise, only log if it fails many times potentially
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
// --- End of File: web_renderer.js ---
