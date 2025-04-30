# Codebase Summarizer CLI

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14.0.0-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CLI](https://img.shields.io/badge/-CLI-blueviolet?logo=cli&logoColor=white)](https://en.wikipedia.org/wiki/Command-line_interface)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

<p align="center">
  <img width="350" src="https://i.imgur.com/zHDMqyW.png">
</p>

A command-line interface (CLI) tool designed to quickly scan a project directory, generate a clean, structured report of its contents (folder tree + text file content), and automatically copy the entire report to your system clipboard.



## ✨ Features

* **Project Structure:** Generates a visual tree representation of the project directory.
* **Text File Contents:** Includes the full content of identifiable text files within the project.
* **Intelligent Filtering:** Automatically ignores common directories (`node_modules`, `.git`, `dist`, `build`, virtual environments, caches, etc.) and specific noisy files (`package-lock.json`, `.env`, lock files, etc.).
* **Binary/Non-Text Exclusion:** Skips binary files, images, archives, media, and other non-text formats to keep the report focused on source code and configuration.
* **Clipboard Integration:** Copies the generated report directly to your clipboard for easy pasting.
* **CLI Tool:** Simple and easy to use from your terminal.

## 🚀 Why Use It? (Especially for LLMs)

When working with large language models (LLMs) for tasks like code explanation, refactoring, debugging, or generating documentation, providing the necessary context about your codebase is crucial. Copying individual files and explaining the structure manually is tedious and often incomplete.

This tool simplifies that process by:

1.  **Providing Full Context:** The generated report gives the LLM (or a human reviewer) both the "map" (folder structure) and the "details" (file contents) in one place.
2.  **Reducing Noise:** By intelligently ignoring irrelevant files and directories, the report focuses only on the relevant parts of your project, reducing the amount of token usage for LLMs and improving the clarity of the context provided.
3.  **Structured Format:** The output is formatted with clear separators (`--- Section: ... ---`, `--- File: ... ---`) making it easier for models (and humans) to parse and understand the different parts of the report.
4.  **Ease of Use:** Just run the command on your project directory, and the comprehensive report is ready to be pasted into your favorite LLM interface or shared elsewhere.

It's also useful for:

* Onboarding new team members by quickly sharing a project overview.
* Generating documentation outlines.
* Getting a bird's-eye view of an unfamiliar codebase.
* Preparing code for sharing or review.

## 📦 Installation

This tool is a Node.js CLI application. You will need Node.js installed on your system to run it.

1.  **Install Node.js:**
    If you don't have Node.js installed, download and install the recommended version (or v14.0.0 or later) from the official website: [nodejs.org](https://nodejs.org/).

    You can verify your installation by opening a terminal and running:
    ```bash
    node -v
    npm -v
    ```
    Make sure the Node.js version is 14.0.0 or higher.

2.  **Install the CLI Tool:**
    Once Node.js and npm (Node Package Manager) are installed, you can install the `summarize-code-base` package globally using npm. This makes the `summarize` command available in your terminal from any directory.

    ```bash
    npm install -g summarize-code-base
    ```

## 💡 Usage

Navigate to the directory you want to summarize, or run the command specifying the target directory path.

The command is simply `summarize` followed by the path to the project directory.

```bash
# Summarize the current directory
summarize .

# Summarize a different directory
summarize /path/to/your/project
```

The report will be printed to your console and automatically copied to your clipboard.

```text
Project Code Summarizer for 'my-project' starts...

--- Section 1: Folder Structure ---
my-project
├── package-lock.json  # Ignored file name, but shown in structure
├── package.json
├── project_summary.js
└── src
    ├── components
    │   └── Button.js
    └── utils
        └── helpers.js

--- Section 2: File Contents (3 files) ---

--- File: package.json ---
{
  "name": "my-project",
  "version": "1.0.0",
  "description": "An example project",
  ...
}
--- End of File: package.json ---

--- File: project_summary.js ---
#!/usr/bin/env node

const fs = require('fs').promises;
...
--- End of File: project_summary.js ---

--- File: src/components/Button.js ---
import React from 'react';

const Button = ({ children }) => {
  return <button>{children}</button>;
};

export default Button;
--- End of File: src/components/Button.js ---

Project Code Summarizer for 'my-project' ends.
✅ Summary copied to clipboard!
```

## 🛠 How It Works

1.  **Argument Parsing:** Uses `yargs` to accept the target directory path as a command-line argument.
2.  **Directory Traversal:** Recursively walks through the specified directory using Node.js's `fs.promises`.
3.  **Structure Generation:** As it traverses, it builds a string representation of the directory tree, similar to the output of the `tree` command.
4.  **Filtering:** It checks each entry (file or directory) against predefined lists of common directories, specific filenames, and file extensions to ignore irrelevant items. Ignored directories are skipped entirely during traversal, while ignored files and non-text files are shown in the structure but *not* included in the file content section.
5.  **Content Collection:** For files that are identified as text files and are not on the ignored list, their content is read asynchronously.
6.  **Report Assembly:** The generated structure and the collected file contents are combined into a single large string buffer with clear section and file delimiters.
7.  **Output:** The final report string is printed to the standard output (your console) and, if the `clipboardy` module is successfully loaded, also copied to your system clipboard.

## 🚫 Ignoring Files and Directories

The tool comes with built-in lists of common directories and files to ignore. These are defined within the `project_summary.js` file:

  * `IGNORED_DIRS`: Contains directories like `node_modules`, `.git`, `dist`, build/cache folders for various languages/frameworks, virtual environments, etc.
  * `IGNORED_FILES`: Contains specific file names like `package-lock.json`, `.env`, various lock files (`poetry.lock`, `yarn.lock`, etc.), etc.
  * `NON_TEXT_EXTENSIONS`: Contains file extensions for binary files, images, archives, media, databases, etc.

These lists are quite comprehensive and cover many typical project setups, ensuring the generated report focuses on the source code and essential configuration files.

*Note: Currently, the tool does not support custom ignore patterns via command-line arguments or configuration files. The built-in lists are used.*

## 🙌 Contributing

Contributions are welcome\! If you have suggestions for improvements, bug fixes, or want to add more file/directory patterns to the ignore lists, feel free to open an issue or submit a pull request.

1.  Fork the repository.
2.  Clone your fork: `git clone https://github.com/TomHuynhSG/summarize-code-base.git`
3.  Install dependencies: `npm install`
4.  Link the package for local testing: `npm link` (You can now use `summarize` in your terminal from any directory, pointing to your local code)
5.  Make your changes.
6.  Test thoroughly.
7.  Commit your changes and push to your fork.
8.  Create a pull request to the original repository.


## 🗺️ Future Enhancements / Roadmap

Here are some planned features and potential future directions for the `summarize-code-base` tool:

* **Custom Ignore Patterns:** Allow users to specify additional files, directories, or patterns to ignore via command-line arguments or a configuration file (e.g., `.summarizerc`).
* **Multiple Output Formats:** Add options to output the summary in different formats (e.g., Markdown, JSON) in addition to the current plain text format.
* **Output to File:** Implement an option to save the generated report directly to a specified file instead of just printing to the console and clipboard.
* **Integrate with Local LLM (Concept):** Explore connecting with local Large Language Models (LLMs) or APIs to potentially provide a higher-level summary or insights based on the generated project report.
* **Integrate with Vision LLM for Images (Concept):** Investigate using local Vision-Language Models (VLMs) to analyze image files (currently ignored) and generate text descriptions of their content, which could then be included in the report.
* **Progress Indicator:** For large projects, add a visual indicator to show the scanning progress.


## 🏆 Author
- Huynh Nguyen Minh Thong (Tom Huynh) - tomhuynhsg@gmail.com
