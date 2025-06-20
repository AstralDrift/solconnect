#!/usr/bin/env node

/**
 * Claude Platform Adapter for Universal AI Agent Heaven
 * 
 * Optimizes the universal framework for Claude's specific capabilities:
 * - Parallel tool execution
 * - Deep file analysis
 * - Comprehensive context handling
 * - Advanced reasoning capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ClaudeAdapter {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.universalTemplates = null;
        this.claudeOptimizations = {
            useParallelExecution: true,
            maxContextSize: 200000, // Claude's large context window
            preferComprehensiveAnalysis: true,
            enableDeepFileAnalysis: true
        };
    }

    /**
     * Initialize Claude adapter with universal templates
     */
    async initialize() {
        try {
            const templatesPath = path.join(__dirname, '../../core/templates/universal-prompts.yaml');
            const templatesContent = await fs.readFile(templatesPath, 'utf8');
            this.universalTemplates = yaml.load(templatesContent);
            
            console.log('Claude adapter initialized with universal templates');
            return true;
        } catch (error) {
            console.error('Failed to initialize Claude adapter:', error.message);
            return false;
        }
    }

    /**
     * Generate Claude-optimized system prompt
     */
    generateSystemPrompt(context = {}) {
        return `You are a Claude-based AI development agent in the AI Agent Heaven framework.
You excel at parallel reasoning, comprehensive analysis, and tool-based development.

Your Claude-Specific Strengths:
- Parallel execution of multiple development tasks
- Deep file analysis and comprehensive context understanding  
- Advanced architectural reasoning and decision making
- Sophisticated error handling and edge case consideration

Use your parallel thinking capabilities to coordinate multiple aspects of development
simultaneously while maintaining high code quality and architectural integrity.

Available Context: ${context.context_summary || 'Will be provided'}
Project Type: ${context.project_type || 'Unknown'}
Complexity Level: ${context.complexity_level || 'Medium'}

CLAUDE OPTIMIZATION INSTRUCTIONS:
- Use parallel tool execution whenever possible
- Gather comprehensive context upfront with parallel searches  
- Analyze multiple implementation approaches simultaneously
- Generate comprehensive test cases covering all aspects
- Validate architectural impact across multiple system components`;
    }

    /**
     * Generate Claude-specific task prompt
     */
    generateTaskPrompt(taskType, taskDetails, context = {}) {
        const taskTemplate = this.universalTemplates.task_templates[taskType];
        if (!taskTemplate) {
            throw new Error(`Unknown task type: ${taskType}`);
        }

        const basePrompt = taskTemplate.base;
        const claudeEnhancement = taskTemplate.claude_enhancement || '';
        
        const fullPrompt = basePrompt + '\n\n## Claude-Specific Optimizations\n' + claudeEnhancement;
        
        return this._formatPrompt(fullPrompt, {
            ...context,
            ...taskDetails
        });
    }

    /**
     * Optimize context discovery for Claude's parallel capabilities
     */
    async discoverContext(task, options = {}) {
        console.log('🔍 Discovering context with Claude optimizations...');
        
        // Claude can handle multiple parallel operations efficiently
        const contextTasks = [
            this._analyzeProjectStructure(),
            this._findRelevantFiles(task),
            this._analyzeCodePatterns(),
            this._identifyIntegrationPoints()
        ];

        try {
            const [structure, relevantFiles, patterns, integrations] = await Promise.all(contextTasks);

            const context = {
                projectStructure: structure,
                relevantFiles: relevantFiles.slice(0, 15),
                codePatterns: patterns,
                integrationPoints: integrations,
                claudeOptimizations: {
                    useParallelAnalysis: true,
                    enableDeepContextGathering: true,
                    performComprehensiveValidation: true
                }
            };

            console.log(`✅ Context discovered: ${relevantFiles.length} files, ${patterns.length} patterns`);
            return context;
        } catch (error) {
            console.error('Context discovery failed:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Generate Claude-specific workflow strategy
     */
    generateWorkflowStrategy(complexity, taskType) {
        const strategies = {
            simple: {
                approach: 'parallel-single-agent',
                steps: [
                    'Parallel context gathering and analysis',
                    'Simultaneous implementation and test creation',
                    'Concurrent validation and documentation'
                ],
                claudeFeatures: ['parallel_tool_execution', 'comprehensive_analysis']
            },
            medium: {
                approach: 'parallel-guided-implementation', 
                steps: [
                    'Multi-dimensional analysis (architecture, code, tests)',
                    'Parallel implementation with continuous validation',
                    'Comprehensive integration testing and review'
                ],
                claudeFeatures: ['parallel_tool_execution', 'deep_file_analysis', 'architectural_reasoning']
            },
            complex: {
                approach: 'coordinated-parallel-development',
                steps: [
                    'Comprehensive system analysis across all dimensions',
                    'Parallel multi-component implementation', 
                    'Concurrent testing, documentation, and validation',
                    'Integration coordination and quality assurance'
                ],
                claudeFeatures: ['parallel_tool_execution', 'comprehensive_analysis', 'architectural_reasoning', 'advanced_error_handling']
            }
        };

        return strategies[complexity] || strategies.simple;
    }

    /**
     * Execute Claude-optimized development workflow
     */
    async executeWorkflow(workflow, task, context) {
        console.log(`🚀 Executing Claude-optimized ${workflow.approach} workflow...`);
        
        const results = {
            implementation: null,
            tests: null,
            documentation: null,
            validation: null
        };

        switch (workflow.approach) {
            case 'parallel-single-agent':
                results = await this._executeParallelSingleAgent(task, context);
                break;
            case 'parallel-guided-implementation':
                results = await this._executeParallelGuided(task, context);
                break;
            case 'coordinated-parallel-development':
                results = await this._executeCoordinatedParallel(task, context);
                break;
            default:
                throw new Error(`Unknown workflow approach: ${workflow.approach}`);
        }

        return results;
    }

    /**
     * Generate Claude-specific commands
     */
    generateCommands(projectType) {
        return {
            // Context discovery commands
            'discover-context': this._generateContextCommand(),
            'analyze-architecture': this._generateArchitectureCommand(),
            'map-integrations': this._generateIntegrationCommand(),
            
            // Implementation commands  
            'implement-feature': this._generateImplementationCommand(),
            'refactor-code': this._generateRefactorCommand(),
            'debug-issue': this._generateDebugCommand(),
            
            // Testing commands
            'generate-tests': this._generateTestCommand(),
            'validate-implementation': this._generateValidationCommand(),
            
            // Claude-specific commands
            'parallel-analysis': this._generateParallelAnalysisCommand(),
            'comprehensive-review': this._generateComprehensiveReviewCommand()
        };
    }

    // Private methods for Claude-specific optimizations

    async _analyzeProjectStructure() {
        try {
            const entries = await fs.readdir(this.projectRoot, { withFileTypes: true });
            const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
            const files = entries.filter(e => e.isFile()).map(e => e.name);
            
            return {
                directories: dirs,
                rootFiles: files,
                hasPackageJson: files.includes('package.json'),
                hasCargoToml: files.includes('Cargo.toml'),
                structure: this._categorizeStructure(dirs)
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async _findRelevantFiles(task) {
        const taskKeywords = task.toLowerCase().split(/\s+/);
        const fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.rs', '.py'];
        
        try {
            const allFiles = await this._getAllFiles(this.projectRoot, fileExtensions);
            const scoredFiles = [];

            for (const file of allFiles.slice(0, 50)) { // Limit for performance
                try {
                    const content = await fs.readFile(file, 'utf8');
                    const score = this._calculateRelevanceScore(content, taskKeywords, file);
                    if (score > 0) {
                        scoredFiles.push({ file, score });
                    }
                } catch (error) {
                    // Skip unreadable files
                }
            }

            return scoredFiles
                .sort((a, b) => b.score - a.score)
                .map(item => item.file);
        } catch (error) {
            return [];
        }
    }

    async _analyzeCodePatterns() {
        const patterns = [];
        
        try {
            // Analyze package.json for framework patterns
            const packageJsonPath = path.join(this.projectRoot, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            if (dependencies.react) patterns.push({ type: 'React', version: dependencies.react });
            if (dependencies.next) patterns.push({ type: 'Next.js', version: dependencies.next });
            if (dependencies.typescript) patterns.push({ type: 'TypeScript', version: dependencies.typescript });
            
        } catch (error) {
            // No package.json or error reading it
        }

        return patterns;
    }

    async _identifyIntegrationPoints() {
        const integrations = [];
        const integrationDirs = ['api', 'services', 'hooks', 'components'];

        for (const dirName of integrationDirs) {
            const dirPath = path.join(this.projectRoot, 'src', dirName);
            try {
                const files = await fs.readdir(dirPath);
                integrations.push({
                    type: dirName,
                    location: dirPath,
                    fileCount: files.length
                });
            } catch (error) {
                // Directory doesn't exist
            }
        }

        return integrations;
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
        
        // Score based on keyword matches
        keywords.forEach(keyword => {
            const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
            score += matches;
            
            if (pathLower.includes(keyword)) {
                score += 5; // Path matches are more valuable
            }
        });
        
        return score;
    }

    // Generate command implementations
    _generateContextCommand() {
        return `
# Discover Context (Claude Optimized)
echo "🔍 Discovering comprehensive context with Claude parallel analysis..."

# Parallel context discovery
node ai-agent-heaven-universal/platforms/claude/adapter.js discover-context "$1"
`;
    }

    _generateImplementationCommand() {
        return `
# Implement Feature (Claude Optimized)
echo "🚀 Implementing feature with Claude parallel execution..."

# Use Claude's parallel capabilities for comprehensive implementation
node ai-agent-heaven-universal/platforms/claude/adapter.js implement-feature "$1" --parallel
`;
    }

    _generateParallelAnalysisCommand() {
        return `
# Claude Parallel Analysis
echo "🧠 Performing parallel analysis across multiple dimensions..."

# Leverage Claude's unique parallel processing capabilities
node ai-agent-heaven-universal/platforms/claude/adapter.js parallel-analysis "$1"
`;
    }

    // Placeholder implementations for demonstration
    async _generateImplementation(task, context, analysis = null) {
        return { 
            code: `// Implementation for: ${task}`,
            files: ['src/feature.ts'],
            approach: 'claude-optimized'
        };
    }

    async _generateTests(task, context, dependencies = null) {
        return {
            tests: `// Tests for: ${task}`,  
            coverage: '95%',
            approach: 'comprehensive-parallel'
        };
    }

    async _generateDocumentation(task, context, dependencies = null) {
        return {
            docs: `# Documentation for: ${task}`,
            files: ['README.md'],
            approach: 'auto-generated'
        };
    }

    async _performValidation(task, context, dependencies = null) {
        return {
            passed: true,
            checks: ['functionality', 'integration', 'performance'],
            approach: 'claude-comprehensive'
        };
    }
}

// CLI interface
if (require.main === module) {
    const adapter = new ClaudeAdapter();
    
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    adapter.initialize().then(async () => {
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
                
            case 'generate-workflow':
                const workflow = adapter.generateWorkflowStrategy(args[0] || 'medium', args[1] || 'implement_feature');
                console.log(JSON.stringify(workflow, null, 2));
                break;
                
            default:
                console.log('Available commands: discover-context, generate-system-prompt, generate-workflow');
        }
    }).catch(error => {
        console.error('Claude adapter error:', error.message);
        process.exit(1);
    });
}

module.exports = ClaudeAdapter; 