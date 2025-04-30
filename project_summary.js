#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
let clipboardy; // Will be dynamically imported

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
// Added a set for specific file names to ignore
const IGNORED_FILES = new Set([
    'package-lock.json', // Node.js
    '.env', // Environment variables
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

async function traverseDirectory(dirPath, rootPath, textFiles, indent = '', structurePrefix = '') {
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
            const nextStructurePrefix = structurePrefix + (isLast ? '    ' : '│   ');

            // Always show the entry in the structure unless it's an ignored dir
            structureOutput += `${linePrefix}${entry.name}\n`;

            if (entry.isDirectory()) {
                // Recursively traverse if it's a directory (already filtered)
                structureOutput += await traverseDirectory(fullPath, rootPath, textFiles, indent + '  ', nextStructurePrefix);
            } else if (entry.isFile()) {
                // Check if the file should be included in the contents section
                // First check against ignored specific filenames
                if (!IGNORED_FILES.has(entry.name)) {
                    // Then check if it's a text file based on extension
                    if (isTextFile(fullPath)) {
                        textFiles.push(fullPath);
                    }
                }
                // Files in IGNORED_FILES or non-text files are shown in structure but not added to textFilesFound
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}: ${error.message}`);
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

// --- Main Execution Logic ---
async function main() {
    // Dynamically import clipboardy
    try {
        clipboardy = (await import('clipboardy')).default;
    } catch (err) {
        console.error("Warning: Failed to load clipboardy. Clipboard functionality will be disabled.", err.message);
        clipboardy = null;
    }

    const argv = await yargs(hideBin(process.argv))
        .usage('Usage: $0 <directory_path>')
        .command('$0 <directory>', 'Summarize the codebase in the specified directory and copy to clipboard', (yargs) => {
            yargs.positional('directory', { describe: 'Path to the project root directory', type: 'string', normalize: true });
        })
        .demandCommand(1, 'You must provide the directory path.')
        .help('h').alias('h', 'help')
        .epilog('Generated by summarize-code-base')
        .argv;

    const targetDir = path.resolve(argv.directory);
    const projectName = path.basename(targetDir);

    // --- Print Start Message (Directly to Console) ---
    console.log(`Project Code Summarizer for '${projectName}' starts...`); // Prints immediately

    let outputBuffer = ''; // Initialize buffer for report content

    // 1. Validate directory
    try {
        const stats = await fs.stat(targetDir);
        if (!stats.isDirectory()) {
            console.error(`\nError: Provided path is not a directory: ${targetDir}`);
            process.exit(1);
        }
    } catch (error) {
        if (error.code === 'ENOENT') console.error(`\nError: Directory not found: ${targetDir}`);
        else console.error(`\nError accessing directory: ${error.message}`);
        process.exit(1);
    }

    const textFilesFound = [];

    // --- Generate Report Content into Buffer ---

    // 2. Folder Structure
    outputBuffer += `--- Section 1: Folder Structure ---\n`;
    outputBuffer += `${projectName}\n`;
    // Pass textFilesFound to traverseDirectory to collect files
    const structure = await traverseDirectory(targetDir, targetDir, textFilesFound);
    outputBuffer += structure;

    // 3. File Contents
    // Use the populated textFilesFound array to get the count
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

    // --- Output Phase ---

    // 4. Print the buffered report to console
    console.log('\n' + outputBuffer); // Add a newline before buffer content for spacing

    // 5. Print final "ends" message (Directly to Console)
    console.log(`\nProject Code Summarizer for '${projectName}' ends.`); // Prints before clipboard message

    // 6. Copy to Clipboard (if available) - *After* the "ends" message
    if (clipboardy) {
        try {
            await clipboardy.write(outputBuffer);
            // Print confirmation message *after* "ends" message
            console.log('✅ Summary copied to clipboard!');
        } catch (error) {
            console.error('❌ Failed to copy summary to clipboard:', error.message);
            // Note: This error message also appears after the "ends" message
        }
    } else {
         console.log('⚠️ Clipboard functionality not available.') // Also appears after "ends"
    }
}

// Run main
main().catch(error => {
    console.error('\nAn unexpected error occurred:', error);
    process.exit(1);
});