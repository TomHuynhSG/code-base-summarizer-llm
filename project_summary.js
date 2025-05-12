#!/usr/bin/env node // Keep shebang for potential direct execution if needed, but index.js is the main entry

const fsPromises = require('fs').promises; // Keep promises version for general use
const fs = require('fs'); // Re-added standard fs for readdir
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse'); // Added pdf-parse
const { YoutubeTranscript } = require('youtube-transcript'); // Added for YouTube transcripts
// Removed libreoffice-convert require
// Removed textract import as it's not used for .doc anymore
// Removed yargs and hideBin - moved to index.js
// Removed clipboardy import - moved to index.js
// Removed main execution logic - moved to index.js

// Promisify exec for async/await usage
const execPromise = util.promisify(exec);


// --- Configuration ---
const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.vscode', '.idea',
    'venv', '.venv', 'env', // Python virtual environments
    '__pycache__', // Python bytecode
    '.pytest_cache', // Python
    '.cache', '.config', 'logs', 'tmp', 'temp', 'coverage', // General caches, temp, logs, coverage
    '.husky', // Git hooks
    '.next', '.nuxt', '.vite', '.svelte-kit', 'out', // Web frameworks build/cache
    'vendor', // Backend dependencies (PHP, Ruby, etc.)
    '.nyc_output', // Node.js coverage
    '.build', 'Pods', '.swiftpm', 'xcuserdata', '.xcworkspace', // Swift/SwiftUI
    '.terraform', '.vagrant', // DevOps tools
    '.circleci', // CI config cache/logs,
    '__MACOSX', // macOS specific
]);
const IGNORED_FILES = new Set([
    'package-lock.json', // Node.js
    '.env', '.env.local', '.env.development', '.env.production', // More specific environment variable files
    'poetry.lock', 'Pipfile.lock', // Python
    'yarn.lock', 'pnpm-lock.yaml', // Node.js
    'composer.lock', // PHP
    'Package.resolved', // SwiftPM
    'terraform.tfstate', 'terraform.tfstate.backup', // Terraform
    'LICENSE', 'LICENSE.txt', // Common license files,
    'CHANGELOG.md', 'CHANGELOG.txt', // Common changelog files
    'CONTRIBUTING.md', 'CONTRIBUTING.txt', // Common contributing files
    'CODE_OF_CONDUCT.md', 'CODE_OF_CONDUCT.txt', // Common code of conduct files
    'SECURITY.md', 'SECURITY.txt', // Common security files
    '.DS_Store', // macOS specific
    //'README.md', 'README.txt', // Common documentation files (This is a bit controversial, but README files are often too long and to be input to LLMs)
]);
const NON_TEXT_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp', // Images
    '.exe', '.dll', '.so', '.o', '.class', '.pyc', '.wasm', '.jar', '.bundle', // Compiled/Binary executables/libraries
    '.zip', '.tar', '.gz', '.rar', '.7z', '.tgz', '.bz2', // Archives
    '.mp3', '.wav', '.mp4', '.avi', '.mov', '.flac', '.ogg', '.mkv', // Media (removed .pdf)
    '.ttf', '.otf', '.woff', '.woff2', '.eot', // Fonts
    '.DS_Store', // macOS specific
    '.map', // Source maps (js, css, etc.)
    '.sqlite3', '.db', // Common database files,
    '.lock', // Common lock files (e.g., for package managers)
    '.iml', // IntelliJ IDEA module files
    '.sublime-project', '.sublime-workspace', // Sublime Text project files
    '.idea', // IntelliJ IDEA project files
    '.classpath', '.project', // Eclipse project files
    '.xcodeproj', '.xcworkspace', // Xcode project files
    '.apk', // Android package files
    '.ipa', // iOS package files
    '.doc' // Removed .doc from the list
]);

// --- Helper Functions ---

// Extract text from PDF files using pdf-parse (or PDF buffer)
// Extract text from PDF files using pdf-parse
async function extractPdfText(pdfPath) { // Changed back to pdfPath as buffer source is removed
    console.log(`Attempting to extract text from PDF ${pdfPath} using pdf-parse...`);
    try {
        const dataBuffer = await fsPromises.readFile(pdfPath); // Read directly from path
        const data = await pdfParse(dataBuffer);
        // data.text contains the extracted text
        // data.numpages contains the number of pages
        // data.info contains metadata (Author, Title, etc.)
        if (!data.text || data.text.trim() === '') {
             console.warn(`pdf-parse extracted no text from ${path.basename(pdfPath)}. The PDF might be image-based or empty.`);
             return `--- No text extracted from PDF ${path.basename(pdfPath)} by pdf-parse. The PDF may be empty or contain only images. ---`;
        }
        // Add page separators for better readability, similar to the old script
        // pdf-parse doesn't provide per-page text easily, so we return the whole block.
        // We can add a note about the number of pages.
        return `[Extracted from ${data.numpages} page(s)]\n\n${data.text}`;
    } catch (error) {
        console.error(`Error extracting text from PDF ${path.basename(pdfPath)} using pdf-parse: ${error.message}`);
        // Check for specific error types if needed, e.g., password protection
        if (error.message.includes('Password') || error.message.includes('encrypted')) {
             return `--- Error: PDF ${path.basename(pdfPath)} is likely password-protected or encrypted. ---`;
        }
        return `--- Error extracting text from PDF ${path.basename(pdfPath)} using pdf-parse. ---`;
    }
}


function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    // Removed .doc from the check, only process .pdf and .docx
    if (ext === '.pdf' || ext === '.docx') {
        return true;
    }
    return ext === '' || !NON_TEXT_EXTENSIONS.has(ext);
}

// Removed the textract-based extractDocText function
// Removed antiword-based extractDocTextDirectly function


async function extractDocxText(filePath) {
    try {
        console.log(`Attempting to extract text from DOCX ${filePath} using mammoth...`);
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || `--- No text extracted from DOCX ${path.basename(filePath)}. ---`;
    } catch (error) {
        console.error(`Error extracting text from DOCX ${filePath}: ${error.message}`);
        return `--- Error extracting text from DOCX ${path.basename(filePath)}. ---`;
    }
}

async function traverseDirectory(dirPath, rootPath, textFiles, structurePrefix = '') {
    let structureOutput = '';
    try {
        // Correctly use fsPromises.readdir here
        const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
        // Filter out ignored directories at the entry level
        const filteredEntries = entries.filter(entry => !IGNORED_DIRS.has(entry.name));

        for (let i = 0; i < filteredEntries.length; i++) {
            const entry = filteredEntries[i];
            const fullPath = path.join(dirPath, entry.name);
            const isLast = i === filteredEntries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const linePrefix = structurePrefix + connector;
            const nextStructurePrefix = structurePrefix + (isLast ? '    ' : '│   '); // Use consistent spacing

            // Always show the entry in the structure unless it's an ignored dir
             structureOutput += `${linePrefix}${entry.name}\n`;

            if (entry.isDirectory()) {
                // Recursively traverse if it's a directory (already filtered)
                structureOutput += await traverseDirectory(fullPath, rootPath, textFiles, nextStructurePrefix);
            } else if (entry.isFile()) {
                // Check if the file should be included in the contents section
                if (!IGNORED_FILES.has(entry.name)) {
                    if (isTextFile(fullPath)) {
                        textFiles.push(fullPath);
                    }
                }
            }
        }
    } catch (error) {
        // Log error but don't stop traversal
        const relativeDir = path.relative(rootPath, dirPath);
        const dirNameToDisplay = relativeDir || path.basename(rootPath) || 'root directory';
        console.error(`Error reading directory '${dirNameToDisplay}': ${error.message}`);
    }
    return structureOutput;
}


async function readFileContent(filePath, targetDir) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            // Use the updated extractPdfText function
            return await extractPdfText(filePath);
        } else if (ext === '.docx') {
            return await extractDocxText(filePath);
        }
        // Removed the .doc handling block entirely

        // Default: Read as plain text, with YouTube transcript processing for .txt files
        let content = await fsPromises.readFile(filePath, 'utf8');

        if (ext === '.txt') {
            const youtubeUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11}))/g;
            let match;
            const promises = [];
            const replacements = {}; // Store replacements to avoid modifying string during iteration

            // Find all matches and initiate transcript fetching
            while ((match = youtubeUrlRegex.exec(content)) !== null) {
                const url = match[0];
                const videoId = match[2];
                if (videoId) {
                    promises.push(
                        (async () => {
                            try {
                                console.log(`Fetching transcript for YouTube video: ${videoId}`);
                                const transcript = await YoutubeTranscript.fetchTranscript(videoId);
                                const transcriptText = transcript.map(item => item.text).join(' ');
                                replacements[url] = `${url}\n--- YouTube Transcript Start ---\n${transcriptText}\n--- YouTube Transcript End ---`;
                                console.log(`Successfully fetched and processed transcript for ${videoId}`);
                            } catch (fetchError) {
                                console.warn(`Could not fetch transcript for ${url}: ${fetchError.message}`);
                                replacements[url] = `${url}\n--- YouTube Transcript Not Available ---`;
                            }
                        })()
                    );
                }
            }

            // Wait for all transcript fetches to complete
            await Promise.all(promises);

            // Apply replacements to the content
            // Iterate over original match positions to ensure correct insertion order
            // Reset regex index for replacement pass
            youtubeUrlRegex.lastIndex = 0;
            let updatedContent = '';
            let lastIndex = 0;
            while ((match = youtubeUrlRegex.exec(content)) !== null) {
                const url = match[0];
                updatedContent += content.substring(lastIndex, match.index); // Add text before the match
                updatedContent += replacements[url] || url; // Add the replacement or original URL if fetch failed silently
                lastIndex = match.index + url.length; // Update last index
            }
            updatedContent += content.substring(lastIndex); // Add any remaining text after the last match
            content = updatedContent; // Assign the modified content back
        }

        return content; // Return original or modified content
    } catch (error) {
        const relativePath = path.relative(targetDir, filePath);
        console.error(`\n--- Error reading file: ${relativePath} ---`);
        console.error(error.message);
        return `--- Error reading file: ${relativePath}. Content omitted. ---`;
    }
}

// --- Core Summary Generation Function ---
async function generateProjectSummary(targetDir) {
    // Removed checkPdfToolsAvailability call
    const projectName = path.basename(targetDir);
    let outputBuffer = ''; // Initialize buffer for report content
    const textFilesFound = [];

    // 1. Folder Structure
    outputBuffer += `--- Section 1: Folder Structure ---\n`;
    outputBuffer += `${projectName}\n`;
    const structure = await traverseDirectory(targetDir, targetDir, textFilesFound);
    outputBuffer += structure;

    // 2. File Contents
    outputBuffer += `\n--- Section 2: File Contents (${textFilesFound.length} files) ---\n`;

    if (textFilesFound.length === 0) {
        outputBuffer += 'No text files found to display.\n';
    } else {
        for (const filePath of textFilesFound) {
            const relativePath = path.relative(targetDir, filePath);
            const content = await readFileContent(filePath, targetDir);
            outputBuffer += `\n--- File: ${relativePath} ---\n`;
            outputBuffer += content;
            if (content && !content.endsWith('\n')) outputBuffer += '\n'; // Ensure newline separation
            outputBuffer += `--- End of File: ${relativePath} ---\n`;
        }
    }

    return outputBuffer; // Return the generated string
}

// Export the function to be used by the new entry point
module.exports = {
    generateProjectSummary
};

// Removed the original main() execution
