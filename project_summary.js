#!/usr/bin/env node // Keep shebang for potential direct execution if needed, but index.js is the main entry

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
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
        console.log(`Attempting to extract text from PDF ${pdfPath} using Docling...`);
        const command = `docling "${pdfPath}"`;
        console.log(`Executing command: ${command}`);
        const { stdout } = await execPromise(command);
        console.log(`Docling output: ${stdout}`);
        if (!stdout || stdout.trim() === '') {
            console.log('Docling returned empty output, falling back to PyPDF2...');
            return await extractPdfTextFallback(pdfPath);
        }
        return stdout;
    } catch (error) {
        console.error(`Error extracting text from PDF ${pdfPath}: ${error.message}`);
        console.log('Falling back to PyPDF2...');
        return await extractPdfTextFallback(pdfPath);
    }
}

// Fallback PDF text extraction using a simple Python script
async function extractPdfTextFallback(pdfPath) {
    console.log(`Attempting to extract text from PDF ${pdfPath} using Python fallback...`);
    
    // Create a temporary Python script file
    const tempScriptPath = path.join(path.dirname(pdfPath), '_temp_pdf_extract.py');
    const pythonScript = `
import sys
try:
    import PyPDF2
    with open('${pdfPath.replace(/\\/g, '\\\\')}', 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\\n\\n"
        print(text)
except ImportError:
    print("--- Error: PyPDF2 is not installed. Run 'pip install PyPDF2' to enable PDF scanning. ---")
except Exception as e:
    print("--- Error processing PDF: " + str(e) + " ---")
`;
    
    try {
        // Write the script to a temporary file
        await fs.writeFile(tempScriptPath, pythonScript);
        console.log(`Executing Python script from file: ${tempScriptPath}`);
        
        // Execute the script
        const { stdout } = await execPromise(`python "${tempScriptPath}"`);
        console.log(`Python script output: ${stdout}`);
        
        // Clean up the temporary file
        try {
            await fs.unlink(tempScriptPath);
        } catch (cleanupError) {
            console.warn(`Warning: Could not delete temporary script file: ${cleanupError.message}`);
        }
        
        return stdout || `--- No text extracted from PDF ${path.basename(pdfPath)}. The PDF may be empty or contain only images. ---`;
    } catch (error) {
        console.error(`Error executing Python script: ${error.message}`);
        
        // Clean up the temporary file even if there was an error
        try {
            await fs.unlink(tempScriptPath);
        } catch (cleanupError) {
            console.warn(`Warning: Could not delete temporary script file: ${cleanupError.message}`);
        }
        
        return `--- Error extracting text from PDF ${path.basename(pdfPath)}. Python or required libraries may not be installed. ---`;
    }
}

function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        return true; // Consider PDFs as text files now
    }
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
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            // Try Docling first, then fallback to Python script
            try {
                return await extractPdfText(filePath);
            } catch (error) {
                return await extractPdfTextFallback(filePath);
            }
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
