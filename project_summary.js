#!/usr/bin/env node
/**
 * Core logic for generating the project summary report.
 * This module handles directory traversal, file filtering,
 * text extraction from various file types (text, PDF, DOCX, DOC),
 * and formatting the final summary string.
 */

// --- Core Node.js Modules ---
const fs = require('fs').promises; // Asynchronous file system operations
const path = require('path'); // Utilities for working with file and directory paths
const { exec } = require('child_process'); // Used for potential external commands (though currently only via libraries)
const util = require('util'); // Provides utility functions, used here for promisify

// --- External Dependencies ---
const mammoth = require('mammoth'); // Library for extracting text from .docx files
const pdfParse = require('pdf-parse'); // Library for extracting text from .pdf files
const DocParser = require('doc-parser'); // Library for extracting text from legacy .doc files

// --- Promisify exec (if needed in future, currently unused directly) ---
// const execPromise = util.promisify(exec); // Keep if direct command execution might be reintroduced

// --- Configuration Constants ---

/**
 * Set of directory names to ignore during traversal.
 * Prevents scanning into irrelevant or large directories like node_modules.
 * @type {Set<string>}
 */
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
    '__MACOSX', // macOS specific metadata directory
]);

/**
 * Set of specific file names to ignore.
 * Useful for excluding lock files, environment files, etc., that don't represent source code.
 * @type {Set<string>}
 */
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
    // 'README.md', // README is often useful context, so it's commented out by default
]);

/**
 * Set of file extensions generally considered non-text or binary.
 * Files with these extensions are skipped unless explicitly handled by a specific parser (like .pdf, .docx, .doc).
 * @type {Set<string>}
 */
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
]);

// --- Helper Functions ---

/**
 * Extracts text content from a PDF file using the pdf-parse library.
 * @param {string} pdfPath - The absolute path to the PDF file.
 * @returns {Promise<string>} The extracted text content, or an error message string if extraction fails.
 */
async function extractPdfText(pdfPath) {
    console.log(`Attempting to extract text from PDF ${path.basename(pdfPath)} using pdf-parse...`);
    try {
        // Read the PDF file into a buffer
        const dataBuffer = await fs.readFile(pdfPath);
        // Parse the buffer using pdf-parse
        const data = await pdfParse(dataBuffer);

        // Check if text was extracted
        if (!data.text || data.text.trim() === '') {
             console.warn(`pdf-parse extracted no text from ${path.basename(pdfPath)}. The PDF might be image-based or empty.`);
             return `--- No text extracted from PDF ${path.basename(pdfPath)} by pdf-parse. The PDF may be empty or contain only images. ---`;
        }

        // Return extracted text, prepended with page count for context
        return `[Extracted from ${data.numpages} page(s)]\n\n${data.text}`;
    } catch (error) {
        console.error(`Error extracting text from PDF ${path.basename(pdfPath)} using pdf-parse: ${error.message}`);
        // Handle specific errors like password protection
        if (error.message.includes('Password') || error.message.includes('encrypted')) {
             return `--- Error: PDF ${path.basename(pdfPath)} is likely password-protected or encrypted. ---`;
        }
        // Return a generic error message for other issues
        return `--- Error extracting text from PDF ${path.basename(pdfPath)} using pdf-parse. ---`;
    }
}

/**
 * Determines if a file should be treated as a text file based on its extension.
 * Considers common text files and specifically includes document types handled by parsers.
 * @param {string} filePath - The path to the file.
 * @returns {boolean} True if the file is considered a text file, false otherwise.
 */
function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    // Explicitly include document types we can parse
    if (ext === '.pdf' || ext === '.docx' || ext === '.doc') {
        return true;
    }
    // Consider files with no extension as text, and exclude known non-text extensions
    return ext === '' || !NON_TEXT_EXTENSIONS.has(ext);
}


/**
 * Extracts text content from a legacy .doc file using the doc-parser library.
 * Note: doc-parser's reliability might vary for complex .doc files.
 * @param {string} filePath - The absolute path to the .doc file.
 * @returns {Promise<string>} The extracted text content, or an error message string if extraction fails.
 */
async function extractDocTextDirectly(filePath) {
    console.log(`Attempting to extract text from DOC ${path.basename(filePath)} using doc-parser...`);
    try {
        const parser = new DocParser();
        // Promisify the parse method assuming it might use callbacks.
        // Needs testing as doc-parser documentation is sparse.
        // It might require reading the file to a buffer first if path doesn't work.
        const parsePromise = util.promisify(parser.parse.bind(parser));
        const content = await parsePromise(filePath); // Try parsing directly from path

        // Check if content was extracted
        if (!content || content.trim() === '') {
             console.warn(`doc-parser extracted no text from ${path.basename(filePath)}. The file might be empty or the parser failed.`);
             return `--- No text extracted from DOC ${path.basename(filePath)} by doc-parser. ---`;
        }
        return content;

    } catch (error) {
        console.error(`Error extracting text from DOC ${path.basename(filePath)} using doc-parser: ${error.message}`);
        // Provide a generic error message as specific errors from this lib are unknown
        return `--- Error extracting text from DOC ${path.basename(filePath)} using doc-parser. The library might not support this specific file or format. ---`;
    }
}

/**
 * Extracts text content from a .docx file using the mammoth library.
 * @param {string} filePath - The absolute path to the .docx file.
 * @returns {Promise<string>} The extracted text content, or an error message string if extraction fails.
 */
async function extractDocxText(filePath) {
    console.log(`Attempting to extract text from DOCX ${path.basename(filePath)} using mammoth...`);
    try {
        // Use mammoth to extract raw text content
        const result = await mammoth.extractRawText({ path: filePath });
        // Return the extracted text or a message if empty
        return result.value || `--- No text extracted from DOCX ${path.basename(filePath)}. ---`;
    } catch (error) {
        console.error(`Error extracting text from DOCX ${path.basename(filePath)}: ${error.message}`);
        return `--- Error extracting text from DOCX ${path.basename(filePath)}. ---`;
    }
}

/**
 * Recursively traverses a directory, builds a visual structure string,
 * and collects paths of text files to be processed.
 * @param {string} dirPath - The absolute path of the directory to traverse.
 * @param {string} rootPath - The absolute path of the initial root directory (for relative path calculations).
 * @param {string[]} textFiles - An array (passed by reference) to collect the paths of text files found.
 * @param {string} [structurePrefix=''] - The prefix string for formatting the visual tree structure (used internally for recursion).
 * @returns {Promise<string>} A string representing the visual folder structure of the traversed directory.
 */
async function traverseDirectory(dirPath, rootPath, textFiles, structurePrefix = '') {
    let structureOutput = ''; // Accumulates the structure string
    try {
        // Read directory entries
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        // Filter out ignored directory names
        const filteredEntries = entries.filter(entry => !IGNORED_DIRS.has(entry.name));

        // Iterate through non-ignored entries
        for (let i = 0; i < filteredEntries.length; i++) {
            const entry = filteredEntries[i];
            const fullPath = path.join(dirPath, entry.name);
            const isLast = i === filteredEntries.length - 1; // Check if it's the last entry for tree formatting
            // Determine the appropriate connector for the tree structure
            const connector = isLast ? '└── ' : '├── ';
            const linePrefix = structurePrefix + connector;
            // Calculate the prefix for the next level of recursion
            const nextStructurePrefix = structurePrefix + (isLast ? '    ' : '│   ');

            // Add the current entry to the structure string
            structureOutput += `${linePrefix}${entry.name}\n`;

            if (entry.isDirectory()) {
                // If it's a directory, recurse into it
                structureOutput += await traverseDirectory(fullPath, rootPath, textFiles, nextStructurePrefix);
            } else if (entry.isFile()) {
                // If it's a file, check if it should be included based on name and type
                if (!IGNORED_FILES.has(entry.name)) {
                    if (isTextFile(fullPath)) {
                        // If it's a text file (or parsable doc), add its path to the collection
                        textFiles.push(fullPath);
                    }
                }
            }
        }
    } catch (error) {
        // Handle errors reading a directory (e.g., permissions)
        const relativeDir = path.relative(rootPath, dirPath);
        const dirNameToDisplay = relativeDir || path.basename(rootPath) || 'root directory';
        console.error(`❌ Error reading directory '${dirNameToDisplay}': ${error.message}`);
        // Continue traversal even if one directory fails
    }
    return structureOutput; // Return the accumulated structure string
}

/**
 * Reads the content of a file, dispatching to the appropriate text extraction
 * function based on the file extension. Handles plain text files by default.
 * @param {string} filePath - The absolute path to the file.
 * @param {string} targetDir - The absolute path of the root directory being scanned (used for relative path error messages).
 * @returns {Promise<string>} The file content as a string, or an error message string if reading/parsing fails.
 */
async function readFileContent(filePath, targetDir) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        // Dispatch based on file extension
        if (ext === '.pdf') {
            return await extractPdfText(filePath);
        } else if (ext === '.docx') {
            return await extractDocxText(filePath);
        } else if (ext === '.doc') {
            return await extractDocTextDirectly(filePath);
        } else {
            // Default: Assume plain text file, read with UTF-8 encoding
            return await fs.readFile(filePath, 'utf8');
        }
    } catch (error) {
        // Handle errors during file reading or parsing
        const relativePath = path.relative(targetDir, filePath);
        console.error(`\n❌ Error reading file: ${relativePath}`);
        console.error(error.message);
        // Return a placeholder error message in the summary
        return `--- Error reading file: ${relativePath}. Content omitted. ---`;
    }
}

// --- Core Summary Generation Function ---

/**
 * Generates the complete project summary report string.
 * Orchestrates directory traversal and file content aggregation.
 * @param {string} targetDir - The absolute path to the root directory of the project to summarize.
 * @returns {Promise<string>} A string containing the formatted project summary report.
 */
async function generateProjectSummary(targetDir) {
    const projectName = path.basename(targetDir);
    let outputBuffer = ''; // Initialize buffer for the report content
    const textFilesFound = []; // Array to store paths of text files found during traversal

    // --- 1. Generate Folder Structure ---
    outputBuffer += `--- Section 1: Folder Structure ---\n`;
    outputBuffer += `${projectName}\n`; // Add project root name
    // Traverse the directory, building the structure string and populating textFilesFound
    const structure = await traverseDirectory(targetDir, targetDir, textFilesFound);
    outputBuffer += structure; // Append the generated structure

    // --- 2. Aggregate File Contents ---
    outputBuffer += `\n--- Section 2: File Contents (${textFilesFound.length} files) ---\n`;

    if (textFilesFound.length === 0) {
        outputBuffer += 'No text files found to display.\n';
    } else {
        // Iterate through the collected text file paths
        for (const filePath of textFilesFound) {
            const relativePath = path.relative(targetDir, filePath);
            // Read/extract content for each file
            const content = await readFileContent(filePath, targetDir);
            // Append formatted file content to the buffer
            outputBuffer += `\n--- File: ${relativePath} ---\n`;
            outputBuffer += content;
            // Ensure a newline separates file content blocks
            if (content && !content.endsWith('\n')) outputBuffer += '\n';
            outputBuffer += `--- End of File: ${relativePath} ---\n`;
        }
    }

    return outputBuffer; // Return the complete summary string
}

// --- Module Exports ---
// Export the main function for use by index.js
module.exports = {
    generateProjectSummary
};
