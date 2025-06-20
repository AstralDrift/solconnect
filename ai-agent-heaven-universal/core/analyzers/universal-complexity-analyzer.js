#!/usr/bin/env node

/**
 * Universal Complexity Analysis Engine
 * 
 * LLM-agnostic analysis system that determines task complexity
 * and routes to appropriate implementation strategies across all models.
 */

const fs = require('fs');
const path = require('path');

class UniversalComplexityAnalyzer {
    constructor(options = {}) {
        this.projectRoot = options.projectRoot || process.cwd();
        this.llmCapabilities = options.llmCapabilities || 'auto-detect';
        this.analysisCache = new Map();
        
        // Universal complexity indicators
        this.complexityIndicators = {
            // File-based indicators
            fileCount: { low: 5, medium: 20, high: 50 },
            fileSize: { low: 1000, medium: 5000, high: 20000 },
            nesting: { low: 3, medium: 6, high: 10 },
            
            // Code-based indicators  
            functions: { low: 10, medium: 50, high: 200 },
            classes: { low: 5, medium: 20, high: 100 },
            imports: { low: 10, medium: 30, high: 100 },
            
            // Architecture indicators
            services: { low: 3, medium: 10, high: 30 },
            components: { low: 10, medium: 30, high: 100 },
            integrations: { low: 2, medium: 5, high: 15 },
            
            // Domain-specific indicators
            cryptoOperations: { low: 2, medium: 5, high: 15 },
            networkOperations: { low: 3, medium: 10, high: 25 },
            stateManagement: { low: 5, medium: 15, high: 40 },
            
            // Cross-cutting concerns
            security: { low: 2, medium: 8, high: 20 },
            performance: { low: 3, medium: 10, high: 30 },
            testing: { low: 5, medium: 20, high: 50 }
        };
    }

    /**
     * Analyze task complexity using universal patterns
     */
    async analyzeComplexity(task, context = {}) {
        const cacheKey = `${task}-${JSON.stringify(context)}`;
        
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey);
        }

        const analysis = await this._performAnalysis(task, context);
        this.analysisCache.set(cacheKey, analysis);
        
        return analysis;
    }

    async _performAnalysis(task, context) {
        // Multi-dimensional analysis
        const dimensions = await Promise.all([
            this._analyzeFileComplexity(context),
            this._analyzeCodeComplexity(context),
            this._analyzeArchitecturalComplexity(context),
            this._analyzeDomainComplexity(task, context),
            this._analyzeCrossCuttingComplexity(task, context)
        ]);

        const [fileScore, codeScore, archScore, domainScore, crossScore] = dimensions;
        
        // Weighted complexity calculation
        const weights = {
            file: 0.15,
            code: 0.25, 
            architecture: 0.25,
            domain: 0.20,
            crossCutting: 0.15
        };

        const totalScore = 
            fileScore * weights.file +
            codeScore * weights.code +
            archScore * weights.architecture + 
            domainScore * weights.domain +
            crossScore * weights.crossCutting;

        // Determine complexity level
        const complexityLevel = this._determineComplexityLevel(totalScore);
        
        // Generate LLM-specific recommendations
        const recommendations = this._generateRecommendations(complexityLevel, {
            fileScore, codeScore, archScore, domainScore, crossScore
        });

        return {
            complexity: complexityLevel,
            score: totalScore,
            dimensions: {
                file: fileScore,
                code: codeScore,
                architecture: archScore,
                domain: domainScore,
                crossCutting: crossScore
            },
            recommendations,
            llmStrategy: this._determineLLMStrategy(complexityLevel),
            estimatedTime: this._estimateImplementationTime(complexityLevel),
            riskFactors: this._identifyRiskFactors(dimensions)
        };
    }

    async _analyzeFileComplexity(context) {
        if (!context.files) return 0;
        
        const fileMetrics = await Promise.all(
            context.files.map(async (file) => {
                try {
                    const content = await fs.promises.readFile(file, 'utf8');
                    return {
                        size: content.length,
                        lines: content.split('\n').length,
                        nesting: this._calculateNesting(content)
                    };
                } catch (error) {
                    return { size: 0, lines: 0, nesting: 0 };
                }
            })
        );

        const totalFiles = fileMetrics.length;
        const avgSize = fileMetrics.reduce((sum, m) => sum + m.size, 0) / totalFiles;
        const maxNesting = Math.max(...fileMetrics.map(m => m.nesting));

        return this._scoreMetric('file', {
            count: totalFiles,
            avgSize,
            maxNesting
        });
    }

    async _analyzeCodeComplexity(context) {
        if (!context.files) return 0;

        let totalFunctions = 0;
        let totalClasses = 0;
        let totalImports = 0;

        for (const file of context.files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                totalFunctions += this._countPatterns(content, [
                    /function\s+\w+/g,
                    /const\s+\w+\s*=\s*\(/g,
                    /\w+\s*:\s*\(/g, // method signatures
                    /=>\s*{/g // arrow functions
                ]);
                
                totalClasses += this._countPatterns(content, [
                    /class\s+\w+/g,
                    /interface\s+\w+/g,
                    /type\s+\w+/g
                ]);
                
                totalImports += this._countPatterns(content, [
                    /import\s+.*from/g,
                    /require\(/g,
                    /use\s+/g // Rust use statements
                ]);
            } catch (error) {
                // Skip inaccessible files
            }
        }

        return this._scoreMetric('code', {
            functions: totalFunctions,
            classes: totalClasses,
            imports: totalImports
        });
    }

    async _analyzeArchitecturalComplexity(context) {
        const projectStructure = await this._analyzeProjectStructure();
        
        return this._scoreMetric('architecture', {
            services: projectStructure.services,
            components: projectStructure.components,
            integrations: projectStructure.integrations
        });
    }

    async _analyzeDomainComplexity(task, context) {
        const taskLower = task.toLowerCase();
        
        // Count domain-specific keywords
        const cryptoKeywords = ['encrypt', 'decrypt', 'key', 'crypto', 'security', 'hash', 'sign'];
        const networkKeywords = ['websocket', 'http', 'api', 'relay', 'connection', 'sync'];
        const stateKeywords = ['redux', 'state', 'store', 'context', 'management'];

        const cryptoScore = cryptoKeywords.filter(k => taskLower.includes(k)).length;
        const networkScore = networkKeywords.filter(k => taskLower.includes(k)).length;
        const stateScore = stateKeywords.filter(k => taskLower.includes(k)).length;

        return this._scoreMetric('domain', {
            crypto: cryptoScore,
            network: networkScore,
            state: stateScore
        });
    }

    async _analyzeCrossCuttingComplexity(task, context) {
        const taskLower = task.toLowerCase();
        
        const securityKeywords = ['auth', 'permission', 'validate', 'secure', 'protect'];
        const performanceKeywords = ['optimize', 'cache', 'performance', 'speed', 'memory'];
        const testingKeywords = ['test', 'mock', 'spec', 'coverage', 'e2e'];

        const securityScore = securityKeywords.filter(k => taskLower.includes(k)).length;
        const performanceScore = performanceKeywords.filter(k => taskLower.includes(k)).length;
        const testingScore = testingKeywords.filter(k => taskLower.includes(k)).length;

        return this._scoreMetric('crossCutting', {
            security: securityScore,
            performance: performanceScore,
            testing: testingScore
        });
    }

    _calculateNesting(content) {
        let maxNesting = 0;
        let currentNesting = 0;
        
        for (const char of content) {
            if (char === '{' || char === '[' || char === '(') {
                currentNesting++;
                maxNesting = Math.max(maxNesting, currentNesting);
            } else if (char === '}' || char === ']' || char === ')') {
                currentNesting--;
            }
        }
        
        return maxNesting;
    }

    _countPatterns(content, patterns) {
        return patterns.reduce((total, pattern) => {
            const matches = content.match(pattern) || [];
            return total + matches.length;
        }, 0);
    }

    async _analyzeProjectStructure() {
        const structure = {
            services: 0,
            components: 0,
            integrations: 0
        };

        try {
            // Count service-like directories
            const dirs = await fs.promises.readdir(this.projectRoot, { withFileTypes: true });
            structure.services = dirs.filter(d => 
                d.isDirectory() && 
                ['services', 'api', 'backend', 'server'].some(s => d.name.includes(s))
            ).length;

            // Count component directories
            structure.components = dirs.filter(d =>
                d.isDirectory() && 
                ['components', 'ui', 'widgets', 'views'].some(s => d.name.includes(s))
            ).length;

            // Count integration points
            const packageFiles = ['package.json', 'Cargo.toml', 'requirements.txt'];
            const hasPackageFile = await Promise.all(
                packageFiles.map(async (file) => {
                    try {
                        await fs.promises.access(path.join(this.projectRoot, file));
                        return true;
                    } catch {
                        return false;
                    }
                })
            );
            structure.integrations = hasPackageFile.filter(Boolean).length;

        } catch (error) {
            // Use defaults if analysis fails
        }

        return structure;
    }

    _scoreMetric(category, values) {
        const indicators = this.complexityIndicators[category] || this.complexityIndicators.fileCount;
        
        let score = 0;
        let count = 0;

        for (const [key, value] of Object.entries(values)) {
            const indicator = this.complexityIndicators[key] || indicators;
            
            if (value <= indicator.low) {
                score += 1;
            } else if (value <= indicator.medium) {
                score += 2;
            } else {
                score += 3;
            }
            count++;
        }

        return count > 0 ? score / count : 0;
    }

    _determineComplexityLevel(score) {
        if (score <= 1.5) return 'simple';
        if (score <= 2.5) return 'medium';
        return 'complex';
    }

    _generateRecommendations(complexity, dimensions) {
        const recommendations = {
            simple: {
                approach: 'Single agent implementation',
                llmRequirements: 'Any model (including local)',
                workflow: 'Direct implementation',
                testing: 'Basic validation'
            },
            medium: {
                approach: 'Guided implementation with review',
                llmRequirements: 'GPT-3.5+ or equivalent',
                workflow: 'Plan → Implement → Validate',
                testing: 'Comprehensive unit testing'
            },
            complex: {
                approach: 'Multi-agent coordination',
                llmRequirements: 'GPT-4, Claude 3.5, or Gemini Pro',
                workflow: 'Analyze → Plan → Parallel Implementation → Integration → Testing',
                testing: 'Full test suite with integration tests'
            }
        };

        return recommendations[complexity];
    }

    _determineLLMStrategy(complexity) {
        return {
            simple: {
                claude: 'single-agent',
                gpt4: 'single-agent', 
                gemini: 'single-agent',
                local: 'template-guided'
            },
            medium: {
                claude: 'agent-with-review',
                gpt4: 'iterative-development',
                gemini: 'planning-first',
                local: 'step-by-step'
            },
            complex: {
                claude: 'parallel-coordination',
                gpt4: 'sequential-specialization',
                gemini: 'analysis-heavy',
                local: 'simplified-breakdown'
            }
        }[complexity];
    }

    _estimateImplementationTime(complexity) {
        const timeEstimates = {
            simple: '15-30 minutes',
            medium: '1-3 hours', 
            complex: '4-8 hours'
        };
        
        return timeEstimates[complexity];
    }

    _identifyRiskFactors(dimensions) {
        const risks = [];
        
        if (dimensions[2] > 2.5) { // architecture
            risks.push('High architectural complexity - consider breaking into phases');
        }
        
        if (dimensions[3] > 2.0) { // domain
            risks.push('Domain-specific expertise required - use specialized agents');
        }
        
        if (dimensions[4] > 2.0) { // cross-cutting
            risks.push('Cross-cutting concerns - ensure comprehensive testing');
        }
        
        return risks;
    }

    /**
     * Export analysis results in universal format
     */
    exportAnalysis(analysis, format = 'json') {
        switch (format) {
            case 'markdown':
                return this._toMarkdown(analysis);
            case 'yaml':
                return this._toYAML(analysis);
            default:
                return JSON.stringify(analysis, null, 2);
        }
    }

    _toMarkdown(analysis) {
        return `# Complexity Analysis

## Overall Assessment
- **Complexity**: ${analysis.complexity}
- **Score**: ${analysis.score.toFixed(2)}
- **Estimated Time**: ${analysis.estimatedTime}

## Dimensional Breakdown
- **File Complexity**: ${analysis.dimensions.file.toFixed(2)}
- **Code Complexity**: ${analysis.dimensions.code.toFixed(2)}
- **Architecture**: ${analysis.dimensions.architecture.toFixed(2)}
- **Domain Specific**: ${analysis.dimensions.domain.toFixed(2)}
- **Cross-cutting**: ${analysis.dimensions.crossCutting.toFixed(2)}

## Recommendations
- **Approach**: ${analysis.recommendations.approach}
- **LLM Requirements**: ${analysis.recommendations.llmRequirements}
- **Workflow**: ${analysis.recommendations.workflow}
- **Testing**: ${analysis.recommendations.testing}

## Risk Factors
${analysis.riskFactors.map(risk => `- ${risk}`).join('\n')}

## LLM Strategy
${Object.entries(analysis.llmStrategy).map(([llm, strategy]) => `- **${llm}**: ${strategy}`).join('\n')}
`;
    }

    _toYAML(analysis) {
        // Simple YAML conversion - could use a library for more complex cases
        return `complexity: ${analysis.complexity}
score: ${analysis.score}
estimatedTime: "${analysis.estimatedTime}"
dimensions:
  file: ${analysis.dimensions.file}
  code: ${analysis.dimensions.code}
  architecture: ${analysis.dimensions.architecture}
  domain: ${analysis.dimensions.domain}
  crossCutting: ${analysis.dimensions.crossCutting}
recommendations:
  approach: "${analysis.recommendations.approach}"
  llmRequirements: "${analysis.recommendations.llmRequirements}"
  workflow: "${analysis.recommendations.workflow}"
  testing: "${analysis.recommendations.testing}"
riskFactors:
${analysis.riskFactors.map(risk => `  - "${risk}"`).join('\n')}
llmStrategy:
${Object.entries(analysis.llmStrategy).map(([llm, strategy]) => `  ${llm}: "${strategy}"`).join('\n')}
`;
    }
}

// CLI Interface
if (require.main === module) {
    const analyzer = new UniversalComplexityAnalyzer();
    
    const task = process.argv[2] || 'Analyze current project';
    const contextFiles = process.argv.slice(3);
    
    analyzer.analyzeComplexity(task, { files: contextFiles })
        .then(analysis => {
            console.log(analyzer.exportAnalysis(analysis, 'markdown'));
        })
        .catch(error => {
            console.error('Analysis failed:', error.message);
            process.exit(1);
        });
}

module.exports = UniversalComplexityAnalyzer; 