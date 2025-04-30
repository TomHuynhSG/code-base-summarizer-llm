#!/usr/bin/env node // Keep shebang for potential direct execution if needed, but index.js is the main entry

const fs = require('fs').promises;
const path = require('path');
// Removed yargs and hideBin - moved to index.js
// Removed clipboardy import - moved to index.js
// Removed main execution logic - moved to index.js

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
    '.circleci' // CI config cache/logs
]);
const IGNORED_FILES = new Set([
    'package-lock.json', // Node.js
    '.env', '.env.local', '.env.development', '.env.production', // More specific environment variable files
    'poetry.lock', 'Pipfile.lock', // Python
    'yarn.lock', 'pnpm-lock.yaml', // Node.js
    'composer.lock', // PHP
    'Package.resolved', // SwiftPM
    'terraform.tfstate', 'terraform.tfstate.backup' // Terraform
]);
const NON_TEXT_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp', // Images
    '.exe', '.dll', '.so', '.o', '.class', '.pyc', '.wasm', '.jar', '.bundle', // Compiled/Binary executables/libraries
    '.zip', '.tar', '.gz', '.rar', '.7z', '.tgz', '.bz2', // Archives
    '.mp3', '.wav', '.mp4', '.avi', '.mov', '.pdf', '.flac', '.ogg', '.mkv', // Media
    '.ttf', '.otf', '.woff', '.woff2', '.eot', // Fonts
    '.DS_Store', // macOS specific
    '.map', // Source maps (js, css, etc.)
    '.sqlite3', '.db' // Common database files
]);

// --- Helper Functions ---
function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '' || !NON_TEXT_EXTENSIONS.has(ext);
}

async function traverseDirectory(dirPath, rootPath, textFiles, structurePrefix = '') {
    let structureOutput = '';
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
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
        console.error(`Error reading directory ${relativeDir || '.'}: ${error.message}`);
    }
    return structureOutput;
}


async function readFileContent(filePath, targetDir) {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        const relativePath = path.relative(targetDir, filePath);
        console.error(`\n--- Error reading file: ${relativePath} ---`);
        console.error(error.message);
        return `--- Error reading file: ${relativePath}. Content omitted. ---`;
    }
}

// --- Core Summary Generation Function ---
async function generateProjectSummary(targetDir) {
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