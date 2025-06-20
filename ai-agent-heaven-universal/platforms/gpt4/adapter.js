#!/usr/bin/env node

/**
 * GPT-4 Platform Adapter for Universal AI Agent Heaven
 * 
 * Optimizes the universal framework for GPT-4's specific capabilities:
 * - Natural conversation and iterative development
 * - Excellent code generation and completion
 * - Strong pattern recognition
 * - Effective dialogue-driven refinement
 */

const fs = require('fs').promises;
const path = require('path');

class GPT4Adapter {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.gpt4Optimizations = {
            useIterativeDevelopment: true,
            maxTokens: 128000, // GPT-4 context window
            preferDialogueDriven: true,
            enableConversationalFlow: true,
            focusOnCodeGeneration: true
        };
    }

    /**
     * Generate GPT-4 optimized system prompt
     */
    generateSystemPrompt(context = {}) {
        return `You are a GPT-4 powered development agent in the AI Agent Heaven framework.
You excel at natural conversation, code generation, and iterative development.

Your GPT-4 Specific Strengths:
- Natural language understanding for complex requirements
- Excellent code completion and generation capabilities
- Strong pattern recognition and best practice application
- Effective iterative refinement and improvement

Focus on clear communication, elegant code solutions, and step-by-step
implementation with continuous validation and refinement.

Available Context: ${context.context_summary || 'Will be provided'}
Project Type: ${context.project_type || 'Unknown'}
Complexity Level: ${context.complexity_level || 'Medium'}

GPT-4 OPTIMIZATION INSTRUCTIONS:
- Use iterative development approach - start minimal, then enhance
- Ask clarifying questions when requirements are ambiguous
- Explain reasoning and design decisions clearly
- Provide multiple implementation alternatives when appropriate
- Generate clean, idiomatic code following language conventions
- Engage in natural dialogue about design decisions`;
    }

    /**
     * Generate conversational task prompt for GPT-4
     */
    generateTaskPrompt(taskType, taskDetails, context = {}) {
        const prompts = {
            implement_feature: `Let's implement the following feature together: ${taskDetails.feature_description || 'Feature'}

I'd like to approach this iteratively:
1. First, let me understand the requirements completely
2. Then we'll start with a minimal working implementation
3. We'll incrementally add features and refinements
4. We'll validate each step before proceeding

Do you have any questions about the requirements? Are there any design decisions you'd like to discuss before we begin?

Context: ${JSON.stringify(context, null, 2)}`,

            debug_issue: `I need help debugging this issue: ${taskDetails.issue_description || 'Issue'}

Let's work through this step-by-step:
1. First, help me understand what might be causing this
2. Let's examine the relevant code together
3. We'll identify the most likely root cause
4. Then implement a targeted fix
5. Finally, we'll add tests to prevent regression

What's your initial assessment of what might be wrong?

Error details: ${taskDetails.error_messages || 'No specific errors provided'}`,

            refactor_code: `I'd like to refactor this code: ${taskDetails.target_code || 'Code to refactor'}

Let's approach this systematically:
1. First, let's discuss what we want to improve
2. We'll make small, focused improvements iteratively
3. We'll validate each change before proceeding
4. We'll explain the reasoning behind each refactoring decision

What aspects of this code do you think would benefit most from refactoring?`,

            add_testing: `Let's add comprehensive testing for: ${taskDetails.target_functionality || 'Functionality'}

I prefer building tests iteratively:
1. Start with core functionality tests
2. Add edge cases and error conditions progressively
3. Explain test strategy and scenario selection
4. Validate test effectiveness at each step

What testing scenarios do you think are most important to cover first?`
        };

        return prompts[taskType] || `Let's work on: ${taskDetails.description || taskType}

I'll approach this step-by-step and explain my reasoning as we go. Feel free to ask questions or suggest alternatives at any point.`;
    }

    /**
     * Generate GPT-4 workflow strategy (iterative approach)
     */
    generateWorkflowStrategy(complexity, taskType) {
        const strategies = {
            simple: {
                approach: 'conversational-single-step',
                steps: [
                    'Clarify requirements through dialogue',
                    'Implement minimal working solution',
                    'Validate and refine based on feedback'
                ],
                gpt4Features: ['natural_dialogue', 'code_generation', 'iterative_refinement']
            },
            medium: {
                approach: 'iterative-guided-development',
                steps: [
                    'Engage in requirements clarification dialogue',
                    'Break down into manageable iterations',
                    'Implement with continuous validation',
                    'Refine based on feedback and testing'
                ],
                gpt4Features: ['conversational_flow', 'pattern_recognition', 'iterative_development']
            },
            complex: {
                approach: 'collaborative-incremental-development',
                steps: [
                    'Comprehensive requirements analysis through dialogue',
                    'Create detailed implementation plan with stakeholder input',
                    'Incremental development with frequent check-ins',
                    'Continuous refinement and validation'
                ],
                gpt4Features: ['natural_language_processing', 'collaborative_planning', 'incremental_delivery']
            }
        };

        return strategies[complexity] || strategies.simple;
    }

    /**
     * Context discovery optimized for GPT-4's dialogue strengths
     */
    async discoverContext(task, options = {}) {
        console.log('🔍 Discovering context with GPT-4 optimizations...');
        
        try {
            // GPT-4 excels at understanding and processing context sequentially
            const projectStructure = await this._analyzeProjectStructure();
            const relevantFiles = await this._findRelevantFiles(task);
            const patterns = await this._analyzeCodePatterns();
            
            const context = {
                projectStructure,
                relevantFiles: relevantFiles.slice(0, 10), // GPT-4 prefers focused context
                codePatterns: patterns,
                gpt4Optimizations: {
                    useConversationalApproach: true,
                    enableIterativeRefinement: true,
                    focusOnCodeGeneration: true,
                    explainReasoningSteps: true
                },
                dialoguePrompts: this._generateDialoguePrompts(task, projectStructure)
            };

            console.log(`✅ Context discovered: ${relevantFiles.length} files, ${patterns.length} patterns`);
            return context;
        } catch (error) {
            console.error('Context discovery failed:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Generate conversation starters for GPT-4
     */
    _generateDialoguePrompts(task, structure) {
        return {
            requirementsClarification: [
                `What specific aspects of "${task}" are most important to you?`,
                `Are there any constraints or requirements I should be aware of?`,
                `How do you envision this fitting into the existing architecture?`
            ],
            designDiscussion: [
                `I see this is a ${structure.projectType || 'web'} project. Should we follow the existing patterns?`,
                `Would you prefer a simple implementation first, or should we build it comprehensively?`,
                `Are there any specific libraries or approaches you'd like me to use?`
            ],
            implementationQuestions: [
                `Should I start with the core functionality or focus on a specific aspect first?`,
                `Would you like me to explain my implementation approach as I go?`,
                `Are there any edge cases or error conditions I should prioritize?`
            ]
        };
    }

    /**
     * Generate GPT-4 optimized commands
     */
    generateCommands(projectType) {
        return {
            // Conversational commands
            'start-conversation': this._generateConversationCommand(),
            'clarify-requirements': this._generateClarificationCommand(),
            'discuss-approach': this._generateApproachCommand(),
            
            // Iterative development commands
            'implement-iteratively': this._generateIterativeCommand(),
            'refine-implementation': this._generateRefinementCommand(),
            'validate-step': this._generateValidationCommand(),
            
            // Code generation commands
            'generate-code': this._generateCodeCommand(),
            'complete-implementation': this._generateCompletionCommand(),
            'explain-code': this._generateExplanationCommand()
        };
    }

    // Private helper methods

    async _analyzeProjectStructure() {
        try {
            const entries = await fs.readdir(this.projectRoot, { withFileTypes: true });
            const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
            const files = entries.filter(e => e.isFile()).map(e => e.name);
            
            // Determine project type for GPT-4's understanding
            let projectType = 'unknown';
            if (files.includes('package.json')) projectType = 'node';
            if (dirs.includes('src') && files.includes('package.json')) projectType = 'react';
            if (files.includes('next.config.js')) projectType = 'nextjs';
            if (files.includes('Cargo.toml')) projectType = 'rust';
            
            return {
                directories: dirs,
                rootFiles: files,
                projectType,
                hasTests: dirs.some(d => d.includes('test')),
                hasComponents: dirs.some(d => d.includes('component')),
                structure: this._categorizeStructure(dirs)
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async _findRelevantFiles(task) {
        const taskKeywords = task.toLowerCase().split(/\s+/);
        const fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs'];
        
        try {
            const allFiles = await this._getAllFiles(this.projectRoot, fileExtensions);
            const relevantFiles = [];

            // GPT-4 works better with focused, relevant context
            for (const file of allFiles.slice(0, 30)) {
                try {
                    const content = await fs.readFile(file, 'utf8');
                    const score = this._calculateRelevanceScore(content, taskKeywords, file);
                    if (score > 2) { // Higher threshold for GPT-4
                        relevantFiles.push({ file, score, preview: content.slice(0, 200) });
                    }
                } catch (error) {
                    // Skip unreadable files
                }
            }

            return relevantFiles
                .sort((a, b) => b.score - a.score)
                .slice(0, 8) // Limit for focused context
                .map(item => ({ file: item.file, preview: item.preview }));
        } catch (error) {
            return [];
        }
    }

    async _analyzeCodePatterns() {
        const patterns = [];
        
        try {
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            // Identify key patterns for GPT-4's understanding
            const keyDependencies = ['react', 'next', 'typescript', 'jest', 'express', 'fastify'];
            keyDependencies.forEach(dep => {
                if (dependencies[dep]) {
                    patterns.push({ 
                        name: dep, 
                        version: dependencies[dep],
                        implications: this._getPatternImplications(dep)
                    });
                }
            });
            
        } catch (error) {
            // No package.json
        }

        return patterns;
    }

    _getPatternImplications(dependency) {
        const implications = {
            react: 'Component-based architecture, JSX, hooks',
            next: 'Full-stack React, file-based routing, API routes',
            typescript: 'Static typing, interfaces, strict type checking',
            jest: 'Unit testing framework, mocking capabilities',
            express: 'Node.js web framework, middleware pattern',
            fastify: 'Fast Node.js framework, plugin architecture'
        };
        
        return implications[dependency] || 'Framework/library usage';
    }

    _categorizeStructure(dirs) {
        return {
            frontend: dirs.filter(d => ['src', 'components', 'pages', 'app'].includes(d)),
            backend: dirs.filter(d => ['api', 'server', 'services'].includes(d)),
            testing: dirs.filter(d => ['test', 'tests', '__tests__'].includes(d)),
            config: dirs.filter(d => ['.config', 'config'].includes(d))
        };
    }

    async _getAllFiles(dir, extensions) {
        const files = [];
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    files.push(...await this._getAllFiles(fullPath, extensions));
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory not accessible
        }
        
        return files;
    }

    _calculateRelevanceScore(content, keywords, filePath) {
        let score = 0;
        const contentLower = content.toLowerCase();
        const pathLower = filePath.toLowerCase();
        
        keywords.forEach(keyword => {
            const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
            score += matches;
            
            if (pathLower.includes(keyword)) {
                score += 3; // Path matches are valuable for GPT-4
            }
        });
        
        return score;
    }

    // Command generators
    _generateConversationCommand() {
        return `
# Start Conversation (GPT-4 Optimized)
echo "💬 Starting conversational development session..."

node ai-agent-heaven-universal/platforms/gpt4/adapter.js start-conversation "$1"
`;
    }

    _generateIterativeCommand() {
        return `
# Iterative Implementation (GPT-4 Optimized)
echo "🔄 Beginning iterative development approach..."

node ai-agent-heaven-universal/platforms/gpt4/adapter.js implement-iteratively "$1"
`;
    }

    _generateCodeCommand() {
        return `
# Generate Code (GPT-4 Optimized)
echo "💻 Generating code with GPT-4 optimization..."

node ai-agent-heaven-universal/platforms/gpt4/adapter.js generate-code "$1"
`;
    }
}

// CLI interface
if (require.main === module) {
    const adapter = new GPT4Adapter();
    
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    (async () => {
        try {
            switch (command) {
                case 'discover-context':
                    const context = await adapter.discoverContext(args[0] || 'general analysis');
                    console.log(JSON.stringify(context, null, 2));
                    break;
                
                case 'generate-system-prompt':
                    const prompt = adapter.generateSystemPrompt({ 
                        project_type: args[0] || 'web-app',
                        complexity_level: args[1] || 'medium'
                    });
                    console.log(prompt);
                    break;
                    
                case 'generate-task-prompt':
                    const taskPrompt = adapter.generateTaskPrompt(
                        args[0] || 'implement_feature',
                        { feature_description: args[1] || 'New feature' }
                    );
                    console.log(taskPrompt);
                    break;
                    
                case 'generate-workflow':
                    const workflow = adapter.generateWorkflowStrategy(args[0] || 'medium', args[1] || 'implement_feature');
                    console.log(JSON.stringify(workflow, null, 2));
                    break;
                    
                default:
                    console.log('Available commands: discover-context, generate-system-prompt, generate-task-prompt, generate-workflow');
            }
        } catch (error) {
            console.error('GPT-4 adapter error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = GPT4Adapter; 