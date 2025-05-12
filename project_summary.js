#!/usr/bin/env node // Keep shebang for potential direct execution if needed, but index.js is the main entry

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const mammoth = require('mammoth');
const textract = require('textract');
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
]);

// --- Helper Functions ---
// Check if PDF processing tools are available
async function checkPdfToolsAvailability() {
    let doclingAvailable = false;
    let pyPdf2Available = false;
    
    // Check for Docling
    try {
        await execPromise('docling --version');
        doclingAvailable = true;
        console.log('Docling found. PDF scanning is enabled.');
    } catch (error) {
        console.warn('Docling not found. Will try PyPDF2 as fallback.');
    }
    
    // Check for PyPDF2
    try {
        await execPromise('python -c "import PyPDF2; print(\'PyPDF2 available\')"');
        pyPdf2Available = true;
        if (!doclingAvailable) {
            console.log('PyPDF2 found. Basic PDF scanning is enabled.');
        } else {
            console.log('PyPDF2 found as fallback.');
        }
    } catch (error) {
        if (!doclingAvailable) {
            console.warn('Neither Docling nor PyPDF2 is available. PDF scanning will be limited.');
            console.warn('To enable PDF scanning, install Docling: pip install docling');
            console.warn('Or install PyPDF2 as fallback: pip install PyPDF2');
        }
    }
    
    return {
        doclingAvailable,
        pyPdf2Available,
        pdfScanningEnabled: doclingAvailable || pyPdf2Available
    };
}

// Extract text from PDF files using Docling
async function extractPdfText(pdfPath) {
    try {
        // console.log(`Attempting to extract text from PDF ${pdfPath} using Docling...`); // Reduced verbosity
        const command = `docling "${pdfPath}"`;
        // console.log(`Executing command: ${command}`); // Reduced verbosity
        const { stdout } = await execPromise(command);
        // console.log(`Docling output: ${stdout}`); // Reduced verbosity
        if (!stdout || stdout.trim() === '') {
            console.warn(`Docling returned empty output for ${path.basename(pdfPath)}, falling back to PyPDF2...`);
            return await extractPdfTextFallback(pdfPath);
        }
        return stdout;
    } catch (error) {
        console.warn(`Docling failed for ${path.basename(pdfPath)}: ${error.message.split('\n')[0]}. Falling back to PyPDF2...`);
        return await extractPdfTextFallback(pdfPath);
    }
}

// Fallback PDF text extraction using a static Python script
async function extractPdfTextFallback(pdfPath) {
    // console.log(`Attempting to extract text from PDF ${pdfPath} using Python fallback...`); // Reduced verbosity
    const scriptPath = path.join(__dirname, 'utils', 'extract_pdf_text.py'); // Assumes utils is in the same dir as this script

    try {
        // Check if the script exists
        await fs.access(scriptPath); 
    } catch (e) {
        console.error(`Error: Python PDF extraction script not found at ${scriptPath}.`);
        return `--- Error: Python PDF extraction script not found. Please ensure 'utils/extract_pdf_text.py' exists. ---`;
    }
    
    const command = `python "${scriptPath}" "${pdfPath}"`;
    try {
        // console.log(`Executing Python script: ${command}`); // Reduced verbosity
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            // PyPDF2 script prints errors to stderr
            console.warn(`PyPDF2 fallback for ${path.basename(pdfPath)} reported: ${stderr.trim()}`);
            // Return stderr as it often contains the "--- Error..." message from the script
            return stderr.trim(); 
        }
        // console.log(`Python script output: ${stdout}`); // Reduced verbosity
        return stdout || `--- No text extracted from PDF ${path.basename(pdfPath)} by PyPDF2. The PDF may be empty or contain only images. ---`;
    } catch (error) {
        // This catch is for errors executing the python command itself (e.g. python not found)
        console.error(`Error executing Python script for ${path.basename(pdfPath)}: ${error.message}`);
        return `--- Error extracting text from PDF ${path.basename(pdfPath)} using Python. Python or PyPDF2 may not be installed correctly. ---`;
    }
}

function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf' || ext === '.docx' || ext === '.doc') {
        return true; // Consider PDFs, DOCX, and DOC as text files now
    }
    return ext === '' || !NON_TEXT_EXTENSIONS.has(ext);
}

async function extractDocText(filePath) {
    return new Promise((resolve, reject) => {
        console.log(`Attempting to extract text from DOC ${filePath} using textract...`);
        textract.fromFileWithPath(filePath, { preserveLineBreaks: true }, (error, text) => {
            if (error) {
                console.error(`Error extracting text from DOC ${filePath} using textract: ${error.message}`);
                resolve(`--- Error extracting text from DOC ${path.basename(filePath)}. Ensure antiword or catdoc is installed. ---`);
            } else {
                resolve(text || `--- No text extracted from DOC ${path.basename(filePath)}. ---`);
            }
        });
    });
}

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
        const dirNameToDisplay = relativeDir || path.basename(rootPath) || 'root directory';
        console.error(`Error reading directory '${dirNameToDisplay}': ${error.message}`);
    }
    return structureOutput;
}


async function readFileContent(filePath, targetDir) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            // extractPdfText already handles its own fallback to extractPdfTextFallback
            return await extractPdfText(filePath);
        } else if (ext === '.docx') {
            return await extractDocxText(filePath);
        } else if (ext === '.doc') {
            return await extractDocText(filePath);
        }
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
    // Check if PDF processing tools are available
    const pdfTools = await checkPdfToolsAvailability();
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
