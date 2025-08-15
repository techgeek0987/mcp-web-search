#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
import sqlite3 from 'sqlite3';

class WebSearchServer {
  constructor() {
    this.server = new Server(
      {
        name: 'web-search-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  async setupDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('./search_cache.db', (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
          return;
        }
        
        // Create tables and handle migrations
        this.db.serialize(() => {
          // First, create the basic table structure
          this.db.run(`
            CREATE TABLE IF NOT EXISTS search_results (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              query TEXT NOT NULL,
              url TEXT NOT NULL,
              title TEXT,
              snippet TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(query, url)
            )
          `, (err) => {
            if (err) console.error('Table creation error:', err);
          });

          // Add new columns if they don't exist (migration)
          this.db.run(`ALTER TABLE search_results ADD COLUMN search_engine TEXT DEFAULT 'duckduckgo'`, (err) => {
            // Ignore error if column already exists
          });

          this.db.run(`ALTER TABLE search_results ADD COLUMN site_filter TEXT`, (err) => {
            // Ignore error if column already exists
          });

          this.db.run(`ALTER TABLE search_results ADD COLUMN file_type TEXT`, (err) => {
            // Ignore error if column already exists
          });

          this.db.run(`ALTER TABLE search_results ADD COLUMN date_range TEXT`, (err) => {
            // Ignore error if column already exists
          });

          // Create new content table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS extracted_content (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              url TEXT NOT NULL UNIQUE,
              content TEXT,
              content_type TEXT,
              title TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) console.error('Content table creation error:', err);
          });

          // Create indexes
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_query ON search_results(query)`, (err) => {
            if (err && !err.message.includes('already exists')) console.error('Index creation error:', err);
          });

          this.db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON search_results(timestamp)`, (err) => {
            if (err && !err.message.includes('already exists')) console.error('Index creation error:', err);
          });

          this.db.run(`CREATE INDEX IF NOT EXISTS idx_search_engine ON search_results(search_engine)`, (err) => {
            if (err && !err.message.includes('already exists')) console.error('Index creation error:', err);
            else resolve();
          });
        });
      });
    });
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'web_search',
            description: 'Search the web using multiple search engines with advanced filtering',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                max_results: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10,
                },
                search_engine: {
                  type: 'string',
                  description: 'Search engine to use: duckduckgo, google, bing (default: duckduckgo)',
                  enum: ['duckduckgo', 'google', 'bing'],
                  default: 'duckduckgo',
                },
                site_filter: {
                  type: 'string',
                  description: 'Filter results to specific domain (e.g., github.com)',
                },
                file_type: {
                  type: 'string',
                  description: 'Filter by file type (pdf, doc, ppt, etc.)',
                },
                date_range: {
                  type: 'string',
                  description: 'Filter by date: day, week, month, year',
                  enum: ['day', 'week', 'month', 'year'],
                },
                use_cache: {
                  type: 'boolean',
                  description: 'Whether to use cached results (default: true)',
                  default: true,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'extract_content',
            description: 'Extract full content from a specific URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to extract content from',
                },
                extract_type: {
                  type: 'string',
                  description: 'Type of content to extract: text, links, images, all',
                  enum: ['text', 'links', 'images', 'all'],
                  default: 'text',
                },
                max_length: {
                  type: 'number',
                  description: 'Maximum content length (default: 5000 chars)',
                  default: 5000,
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'bulk_search',
            description: 'Search multiple queries at once',
            inputSchema: {
              type: 'object',
              properties: {
                queries: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of search queries',
                },
                max_results_per_query: {
                  type: 'number',
                  description: 'Max results per query (default: 5)',
                  default: 5,
                },
                search_engine: {
                  type: 'string',
                  description: 'Search engine to use',
                  enum: ['duckduckgo', 'google', 'bing'],
                  default: 'duckduckgo',
                },
              },
              required: ['queries'],
            },
          },
          {
            name: 'search_analytics',
            description: 'Get analytics and statistics about search history',
            inputSchema: {
              type: 'object',
              properties: {
                days_back: {
                  type: 'number',
                  description: 'Number of days to analyze (default: 30)',
                  default: 30,
                },
              },
            },
          },
          {
            name: 'export_results',
            description: 'Export search results to JSON or CSV format',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query to export (optional - exports all if not specified)',
                },
                format: {
                  type: 'string',
                  description: 'Export format: json or csv',
                  enum: ['json', 'csv'],
                  default: 'json',
                },
                days_back: {
                  type: 'number',
                  description: 'Number of days back to export (default: 7)',
                  default: 7,
                },
              },
            },
          },
          {
            name: 'clear_cache',
            description: 'Clear the search cache',
            inputSchema: {
              type: 'object',
              properties: {
                older_than_days: {
                  type: 'number',
                  description: 'Clear cache entries older than N days (default: clear all)',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'web_search':
            return await this.handleWebSearch(args);
          case 'extract_content':
            return await this.handleExtractContent(args);
          case 'bulk_search':
            return await this.handleBulkSearch(args);
          case 'search_analytics':
            return await this.handleSearchAnalytics(args);
          case 'export_results':
            return await this.handleExportResults(args);
          case 'clear_cache':
            return await this.handleClearCache(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async handleWebSearch(args) {
    const { 
      query, 
      max_results = 10, 
      search_engine = 'duckduckgo',
      site_filter,
      file_type,
      date_range,
      use_cache = true 
    } = args;

    // Build enhanced query
    let enhancedQuery = query;
    if (site_filter) enhancedQuery += ` site:${site_filter}`;
    if (file_type) enhancedQuery += ` filetype:${file_type}`;

    // Check cache first if enabled
    if (use_cache) {
      const cachedResults = await this.getCachedResults(enhancedQuery, max_results, search_engine);
      if (cachedResults.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Found ${cachedResults.length} cached results for "${query}" on ${search_engine}:\n\n` +
                    cachedResults.map((result, i) => 
                      `${i + 1}. **${result.title}**\n   ${result.url}\n   ${result.snippet}\n`
                    ).join('\n'),
            },
          ],
        };
      }
    }

    // Perform fresh search
    const results = await this.performSearch(enhancedQuery, max_results, search_engine, date_range);
    
    // Cache results
    await this.cacheResults(query, results, search_engine, site_filter, file_type, date_range);

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} results for "${query}" on ${search_engine}:\n\n` +
                results.map((result, i) => 
                  `${i + 1}. **${result.title}**\n   ${result.url}\n   ${result.snippet}\n`
                ).join('\n'),
        },
      ],
    };
  }

  async performSearch(query, maxResults, searchEngine = 'duckduckgo', dateRange = null) {
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      let searchUrl;
      let resultsSelector;
      let titleSelector;
      let snippetSelector;

      switch (searchEngine) {
        case 'google':
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          if (dateRange) {
            const dateMap = { day: 'd', week: 'w', month: 'm', year: 'y' };
            searchUrl += `&tbs=qdr:${dateMap[dateRange]}`;
          }
          resultsSelector = '.g';
          titleSelector = 'h3';
          snippetSelector = '.VwiC3b';
          break;
        
        case 'bing':
          searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
          resultsSelector = '.b_algo';
          titleSelector = 'h2 a';
          snippetSelector = '.b_caption p';
          break;
        
        default: // duckduckgo
          searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          resultsSelector = '.result';
          titleSelector = '.result__title a';
          snippetSelector = '.result__snippet';
      }

      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      const results = await page.evaluate((maxResults, resultsSelector, titleSelector, snippetSelector, searchEngine) => {
        const resultElements = document.querySelectorAll(resultsSelector);
        const results = [];

        for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
          const element = resultElements[i];
          let titleElement, snippetElement, url, title, snippet;

          if (searchEngine === 'google') {
            titleElement = element.querySelector(titleSelector);
            snippetElement = element.querySelector(snippetSelector);
            const linkElement = element.querySelector('a[href]');
            
            if (titleElement && linkElement) {
              title = titleElement.textContent.trim();
              url = linkElement.href;
              snippet = snippetElement ? snippetElement.textContent.trim() : '';
            }
          } else if (searchEngine === 'bing') {
            titleElement = element.querySelector(titleSelector);
            snippetElement = element.querySelector(snippetSelector);
            
            if (titleElement) {
              title = titleElement.textContent.trim();
              url = titleElement.href;
              snippet = snippetElement ? snippetElement.textContent.trim() : '';
            }
          } else { // duckduckgo
            titleElement = element.querySelector(titleSelector);
            snippetElement = element.querySelector(snippetSelector);
            
            if (titleElement) {
              title = titleElement.textContent.trim();
              url = titleElement.href;
              snippet = snippetElement ? snippetElement.textContent.trim() : '';
            }
          }

          if (title && url) {
            results.push({ title, url, snippet });
          }
        }

        return results;
      }, maxResults, resultsSelector, titleSelector, snippetSelector, searchEngine);

      return results;
    } finally {
      await browser.close();
    }
  }

  async getCachedResults(query, maxResults, searchEngine = 'duckduckgo') {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT url, title, snippet FROM search_results 
         WHERE query = ? AND search_engine = ? AND timestamp > datetime('now', '-1 day')
         ORDER BY timestamp DESC LIMIT ?`,
        [query, searchEngine, maxResults],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async cacheResults(query, results, searchEngine = 'duckduckgo', siteFilter = null, fileType = null, dateRange = null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO search_results (query, url, title, snippet, search_engine, site_filter, file_type, date_range)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const result of results) {
      stmt.run([query, result.url, result.title, result.snippet, searchEngine, siteFilter, fileType, dateRange]);
    }

    stmt.finalize();
  }

  async getCachedContent(url) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT content, content_type, title FROM extracted_content 
         WHERE url = ? AND timestamp > datetime('now', '-7 days')`,
        [url],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async cacheContent(url, extractedData, contentType, title) {
    const content = JSON.stringify(extractedData);
    
    this.db.run(`
      INSERT OR REPLACE INTO extracted_content (url, content, content_type, title)
      VALUES (?, ?, ?, ?)
    `, [url, content, contentType, title]);
  }

  async handleExtractContent(args) {
    const { url, extract_type = 'text', max_length = 5000 } = args;

    // Check cache first
    const cachedContent = await this.getCachedContent(url);
    if (cachedContent) {
      return {
        content: [
          {
            type: 'text',
            text: `Cached content from ${url}:\n\n${cachedContent.content.substring(0, max_length)}${cachedContent.content.length > max_length ? '...' : ''}`,
          },
        ],
      };
    }

    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      let extractedData = {};

      if (extract_type === 'text' || extract_type === 'all') {
        extractedData.text = await page.evaluate(() => {
          // Remove script and style elements
          const scripts = document.querySelectorAll('script, style');
          scripts.forEach(el => el.remove());
          return document.body.innerText || document.body.textContent || '';
        });
      }

      if (extract_type === 'links' || extract_type === 'all') {
        extractedData.links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href]')).map(link => ({
            text: link.textContent.trim(),
            url: link.href
          })).filter(link => link.text && link.url);
        });
      }

      if (extract_type === 'images' || extract_type === 'all') {
        extractedData.images = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('img[src]')).map(img => ({
            alt: img.alt || '',
            src: img.src
          }));
        });
      }

      const title = await page.title();
      
      // Cache the content
      await this.cacheContent(url, extractedData, extract_type, title);

      let responseText = `Content extracted from ${url}:\n\n`;
      
      if (extractedData.text) {
        responseText += `**Text Content:**\n${extractedData.text.substring(0, max_length)}${extractedData.text.length > max_length ? '...' : ''}\n\n`;
      }
      
      if (extractedData.links) {
        responseText += `**Links (${extractedData.links.length}):**\n`;
        extractedData.links.slice(0, 10).forEach((link, i) => {
          responseText += `${i + 1}. [${link.text}](${link.url})\n`;
        });
        if (extractedData.links.length > 10) responseText += `... and ${extractedData.links.length - 10} more\n`;
        responseText += '\n';
      }
      
      if (extractedData.images) {
        responseText += `**Images (${extractedData.images.length}):**\n`;
        extractedData.images.slice(0, 5).forEach((img, i) => {
          responseText += `${i + 1}. ${img.alt || 'No alt text'}: ${img.src}\n`;
        });
        if (extractedData.images.length > 5) responseText += `... and ${extractedData.images.length - 5} more\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } finally {
      await browser.close();
    }
  }

  async handleBulkSearch(args) {
    const { queries, max_results_per_query = 5, search_engine = 'duckduckgo' } = args;
    
    const allResults = [];
    
    for (const query of queries) {
      try {
        const results = await this.performSearch(query, max_results_per_query, search_engine);
        await this.cacheResults(query, results, search_engine);
        allResults.push({ query, results, count: results.length });
      } catch (error) {
        allResults.push({ query, error: error.message, count: 0 });
      }
    }

    let responseText = `Bulk search completed for ${queries.length} queries:\n\n`;
    
    allResults.forEach((result, i) => {
      responseText += `**Query ${i + 1}: "${result.query}"**\n`;
      if (result.error) {
        responseText += `Error: ${result.error}\n\n`;
      } else {
        responseText += `Found ${result.count} results:\n`;
        result.results.forEach((res, j) => {
          responseText += `${j + 1}. ${res.title}\n   ${res.url}\n`;
        });
        responseText += '\n';
      }
    });

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  async handleSearchAnalytics(args) {
    const { days_back = 30 } = args;

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          COUNT(*) as total_searches,
          COUNT(DISTINCT query) as unique_queries,
          search_engine,
          COUNT(*) as engine_count
        FROM search_results 
        WHERE timestamp > datetime('now', '-${days_back} days')
        GROUP BY search_engine
      `, (err, engineStats) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(`
          SELECT query, COUNT(*) as count
          FROM search_results 
          WHERE timestamp > datetime('now', '-${days_back} days')
          GROUP BY query
          ORDER BY count DESC
          LIMIT 10
        `, (err, topQueries) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.get(`
            SELECT COUNT(*) as total_results
            FROM search_results 
            WHERE timestamp > datetime('now', '-${days_back} days')
          `, (err, totalStats) => {
            if (err) {
              reject(err);
              return;
            }

            let responseText = `Search Analytics (Last ${days_back} days):\n\n`;
            responseText += `**Overall Stats:**\n`;
            responseText += `- Total search results: ${totalStats.total_results}\n`;
            responseText += `- Unique queries: ${topQueries.length}\n\n`;

            responseText += `**Search Engine Usage:**\n`;
            engineStats.forEach(stat => {
              responseText += `- ${stat.search_engine}: ${stat.engine_count} results\n`;
            });

            responseText += `\n**Top Queries:**\n`;
            topQueries.forEach((query, i) => {
              responseText += `${i + 1}. "${query.query}" (${query.count} times)\n`;
            });

            resolve({
              content: [
                {
                  type: 'text',
                  text: responseText,
                },
              ],
            });
          });
        });
      });
    });
  }

  async handleExportResults(args) {
    const { query, format = 'json', days_back = 7 } = args;

    return new Promise((resolve, reject) => {
      let sql = `
        SELECT query, url, title, snippet, search_engine, timestamp
        FROM search_results 
        WHERE timestamp > datetime('now', '-${days_back} days')
      `;
      let params = [];

      if (query) {
        sql += ` AND query = ?`;
        params.push(query);
      }

      sql += ` ORDER BY timestamp DESC`;

      this.db.all(sql, params, (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        let exportData;
        let filename = `search_export_${new Date().toISOString().split('T')[0]}`;

        if (format === 'json') {
          exportData = JSON.stringify(results, null, 2);
          filename += '.json';
        } else if (format === 'csv') {
          const headers = ['Query', 'URL', 'Title', 'Snippet', 'Search Engine', 'Timestamp'];
          const csvRows = [headers.join(',')];
          
          results.forEach(row => {
            const csvRow = [
              `"${row.query.replace(/"/g, '""')}"`,
              `"${row.url.replace(/"/g, '""')}"`,
              `"${row.title.replace(/"/g, '""')}"`,
              `"${row.snippet.replace(/"/g, '""')}"`,
              `"${row.search_engine}"`,
              `"${row.timestamp}"`
            ];
            csvRows.push(csvRow.join(','));
          });
          
          exportData = csvRows.join('\n');
          filename += '.csv';
        }

        resolve({
          content: [
            {
              type: 'text',
              text: `Exported ${results.length} search results to ${format.toUpperCase()} format:\n\n\`\`\`${format}\n${exportData.substring(0, 2000)}${exportData.length > 2000 ? '\n... (truncated)' : ''}\n\`\`\`\n\nSuggested filename: ${filename}`,
            },
          ],
        });
      });
    });
  }

  async handleClearCache(args) {
    const { older_than_days } = args;

    return new Promise((resolve, reject) => {
      let sql, params;
      
      if (older_than_days) {
        sql = `DELETE FROM search_results WHERE timestamp < datetime('now', '-${older_than_days} days')`;
        params = [];
      } else {
        sql = `DELETE FROM search_results`;
        params = [];
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            content: [
              {
                type: 'text',
                text: `Cleared ${this.changes} cached search results.`,
              },
            ],
          });
        }
      });
    });
  }

  async run() {
    try {
      await this.setupDatabase();
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Web Search MCP server running on stdio');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

const server = new WebSearchServer();
server.run().catch(console.error);