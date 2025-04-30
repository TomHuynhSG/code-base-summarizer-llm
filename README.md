# Codebase Summarizer LLM

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CLI](https://img.shields.io/badge/-CLI-blueviolet?logo=cli&logoColor=white)](https://en.wikipedia.org/wiki/Command-line_interface)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

<p align="center">
  <img width="450" src="https://i.imgur.com/Ht6rVQ4.png">
</p>

A powerful command-line interface (CLI) tool designed to quickly scan a project directory, generate a clean, structured report of its contents (folder tree + text file content), and optionally pass this report to an LLM for analysis, rendering the result in a local web page.

## ✨ Features

* **Project Structure:** Generates a visual tree representation of the project directory.
* **Text File Contents:** Includes the full content of identifiable text files within the project.
* **Intelligent Filtering:** Automatically ignores common directories (`node_modules`, `.git`, `dist`, build/cache folders, virtual environments, etc.) and specific noisy files (`package-lock.json`, `.env`, lock files, etc.).
* **Binary/Non-Text Exclusion:** Skips binary files, images, archives, media, and other non-text formats.
* **Optional LLM Integration:** Pass the generated summary directly to an OpenAI-compatible LLM API for automated analysis using the `--llm` flag.
* **Customizable Prompting:** Use a template file (`--prompt`) to control the instructions given to the LLM, injecting the project summary using a special tag (`{{SUMMARY}}`).
* **Configurable LLM Settings:** Easily adjust the LLM `model` and `temperature` via command-line options.
* **Secure API Key Handling:** Loads your OpenAI API key securely from a `.env` file.
* **Rich Web Rendering:** When using LLM integration, the Markdown response from the model is beautifully rendered in a local web page.
* **Automatic Browser Opening:** The generated web page is automatically opened in your default browser.
* **Clipboard Integration:** Copies the generated report to your clipboard (default behavior when not using `--llm`, or explicitly with `--copy`).
* **Modular Design:** New functionalities (LLM processing, web rendering) are kept in separate files for better organization.

## 🚀 Why Use It?

### For LLM Interaction

When working with large language models (LLMs) for tasks like code explanation, refactoring, debugging, or generating documentation, providing the necessary context about your codebase is crucial. Copying individual files and explaining the structure manually is tedious and often incomplete.

This tool simplifies that process significantly:

1.  **Comprehensive Context:** The generated report gives the LLM (or a human reviewer) both the "map" (folder structure) and the "details" (file contents) in one place.
2.  **Reduced Noise:** By intelligently ignoring irrelevant files and directories, the report focuses only on the relevant parts, reducing token usage for LLMs and improving context clarity.
3.  **Structured Format:** The output is formatted with clear separators, making it easier for models (and humans) to parse.
4.  **Direct LLM Integration:** The `--llm` flag automates the process of sending this context to an LLM, bypassing manual copy/paste steps and immediately providing the LLM's analysis in an easy-to-read format.
5.  **Customizable Workflow:** Tailor the LLM's task using a specific prompt template.

### For General Code Exploration

It's also highly useful for:

* Onboarding new team members by quickly sharing a project overview.
* Generating documentation outlines.
* Getting a bird's-eye view of an unfamiliar codebase.
* Preparing code for sharing or review.

## 📦 Installation

This tool is a Node.js CLI application. You will need Node.js installed on your system to run it.

1.  **Install Node.js:**
    If you don't have Node.js installed, download and install the recommended version (or v18.0.0 or later) from the official website: [nodejs.org](https://nodejs.org/). We recommend Node.js v18 or later for compatibility with newer features and libraries.

    You can verify your installation by opening a terminal and running:
    ```bash
    node -v
    npm -v
    ```
    Make sure the Node.js version is 18.0.0 or higher.

2.  **Install the CLI Tool:**
    Once Node.js and npm (Node Package Manager) are installed, you can install the `summarize-code-base` package globally using npm. This makes the `summarize` command available in your terminal from any directory.

    ```bash
    npm install -g summarize-code-base
    ```

3.  **Setup for LLM Integration (Optional):**
    If you plan to use the `--llm` functionality with OpenAI, you need an API key.
    * Get your OpenAI API key from the [OpenAI Platform API Keys page](https://platform.openai.com/api-keys).
    * In the directory where you installed the `summarize-code-base` code (if you cloned it), or in your project's root directory where you might run the command from, create a file named `.env`.
    * Add your API key to this file like this:
        ```
        OPENAI_API_KEY=YOUR_ACTUAL_OPENAI_API_KEY_HERE
        ```
        **Important:** Replace `YOUR_ACTUAL_OPENAI_API_KEY_HERE` with your actual secret key.
    * **Security:** Ensure you do not commit your `.env` file to version control (e.g., add `.env` to your `.gitignore`).

## 💡 Usage

Navigate to the directory you want to summarize, or run the command specifying the target directory path.

The basic command requires the path to the project directory:

```bash
# Summarize the current directory (default behavior: console output + clipboard)
summarize .

# Summarize a different directory (default behavior: console output + clipboard)
summarize /path/to/your/project
```

### Default Output (No `--llm`)

When not using the `--llm` flag (the default), the generated report is printed to your console and automatically copied to your clipboard.

```text
Project Code Summarizer for 'my-project' starts...

--- Section 1: Folder Structure ---
my-project
├── package-lock.json  # Ignored file name, but shown in structure
├── package.json
├── project_summary.js
└── src
    ├── components
    │   └── Button.js
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

### Using LLM Integration (`--llm`)

Use the `--llm` flag to send the summary to the LLM for analysis and render the response in a browser.

```bash
# Summarize current directory and send to LLM (requires .env with OPENAI_API_KEY)
summarize . --llm

# Summarize a different directory and send to LLM
summarize /path/to/your/project --llm
```

When using `--llm`:
* The extensive summary is *not* printed to the console.
* The summary is injected into the prompt template.
* The prompt is sent to the OpenAI API.
* The LLM's response (expected Markdown) is converted to HTML.
* A simple local web server starts temporarily.
* The HTML report is automatically opened in your default browser.
* The raw summary is *not* copied to the clipboard by default (use `--copy` to force it).

### LLM Options

You can customize the LLM processing using the following options with the `--llm` flag:

* `--prompt <path>` (Alias: `-p`): Specify the path to a custom prompt template file. Defaults to `prompt_template.txt` in the current directory. The template should contain the placeholder `{{SUMMARY}}` where the project summary will be injected.
    ```bash
    summarize . --llm --prompt ./my-prompts/analysis-template.txt
    ```
* `--model <model_name>` (Alias: `-m`): Specify the OpenAI model to use. Defaults to `gpt-4o` (or `gpt-3.5-turbo` if `gpt-4o` is not available or preferred).
    ```bash
    summarize . --llm --model gpt-3.5-turbo
    ```
* `--temperature <value>` (Alias: `-t`): Set the temperature for the LLM response (a number between 0.0 and 2.0). Defaults to `0.7`.
    ```bash
    summarize . --llm --temperature 1.0
    ```
* `--copy` (Alias: `-c`): Force copying the *raw generated summary* to the clipboard even when using the `--llm` flag. By default, `--copy` is true when `--llm` is false, and false when `--llm` is true.
    ```bash
    summarize . --llm --copy # Use LLM AND copy the raw summary to clipboard
    summarize . --no-copy   # Don't copy to clipboard (only print to console)
    ```

You can combine these options:

```bash
summarize /path/to/project --llm --model gpt-4o --temperature 0.5 --prompt my_template.txt --copy
```

## 🛠 How It Works

1.  **Entry Point (`index.js`):** This is the main script executed. It uses `yargs` to parse all command-line arguments (`directory`, `--llm`, `--prompt`, etc.). It also loads environment variables from `.env` using `dotenv`.
2.  **Summary Generation (`project_summary.js`):** The `index.js` script calls the `generateProjectSummary` function from `project_summary.js`. This function traverses the specified directory, applies the ignore rules, collects text file content, and formats the output into a single large summary string. This function *returns* the string but does not print or copy it itself anymore.
3.  **Conditional Output:** Based on the presence of the `--llm` flag:
    * **If `--llm` is NOT used:** The `index.js` script prints the generated summary string to the console and, if `clipboardy` is available and `--copy` is enabled, copies it to the clipboard (replicating the original behavior).
    * **If `--llm` IS used:**
        * `index.js` retrieves the `OPENAI_API_KEY` from environment variables.
        * `index.js` calls the `processWithLLM` function from `llm_processor.js`, passing the summary string and the LLM configuration options (prompt path, model, temperature, API key).
        * **LLM Processing (`llm_processor.js`):** This module reads the specified prompt template, replaces the `{{SUMMARY}}` placeholder with the generated summary, initializes the OpenAI client, makes a request to the OpenAI API, and returns the LLM's text response.
        * `index.js` receives the LLM response and calls the `renderAndServe` function from `web_renderer.js`.
        * **Web Rendering (`web_renderer.js`):** This module takes the LLM's Markdown response, converts it into HTML using `marked`, embeds it in a simple HTML template with basic styling, starts a temporary local HTTP server to serve this HTML content on an available port, and uses the `open` package to automatically open the server's URL in the user's default browser.

## 🚫 Ignoring Files and Directories

The tool comes with built-in lists of common directories and files to ignore, defined within `project_summary.js`. These are designed to focus the summary on relevant codebase files.

* `IGNORED_DIRS`: Contains directories like `node_modules`, `.git`, `dist`, build/cache folders for various languages/frameworks, virtual environments (`venv`, `env`), etc.
* `IGNORED_FILES`: Contains specific file names like `package-lock.json`, `.env`, `.env.local`, and various lock files (`poetry.lock`, `yarn.lock`, `composer.lock`, etc.).
* `NON_TEXT_EXTENSIONS`: Contains file extensions for binary files, images, archives, media, databases, fonts, etc.

These lists are quite comprehensive and cover many typical project setups.

*Note: Currently, the tool does not support custom ignore patterns via command-line arguments or configuration files. The built-in lists are used.*

## 🙌 Contributing

Contributions are welcome! If you have suggestions for improvements, bug fixes, or want to add more file/directory patterns to the ignore lists, feel free to open an issue or submit a pull request.

1.  Fork the repository.
2.  Clone your fork: `git clone https://github.com/TomHuynhSG/code-base-summarizer-llm.git`
3.  Install dependencies: `npm install`
4.  Link the package for local testing: `npm link` (You can now use `summarize` in your terminal from any directory, pointing to your local code)
5.  Make your changes.
6.  Test thoroughly.
7.  Commit your changes and push to your fork.
8.  Create a pull request to the original repository.

## 🗺️ Future Enhancements / Roadmap

Here are some planned features and potential future directions for the `summarize-code-base` tool:

* **Custom Ignore Patterns:** Allow users to specify additional files, directories, or patterns to ignore via command-line arguments or a configuration file (e.g., `.summarizerc`).
* **Support for Other LLMs/APIs:** Extend LLM integration to support models from providers other than OpenAI.
* **Multiple Output Formats:** Add options to output the summary or LLM response in different formats (e.g., JSON, pure Markdown file).
* **Output to File:** Implement an option to save the generated report or LLM response directly to a specified file.
* **Integrate with Local LLM (Concept):** Explore integration with local Large Language Models (LLMs).
* **Integrate with Vision LLM for Images (Concept):** Investigate using local Vision-Language Models (VLMs) to analyze image files (currently ignored) and generate text descriptions.
* **Progress Indicator:** For large projects, add a visual indicator to show the scanning progress.

## 🏆 Author
- Huynh Nguyen Minh Thong (Tom Huynh) - tomhuynhsg@gmail.com
