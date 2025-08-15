# MCP Web Search Server

A powerful Model Context Protocol (MCP) server for web searching using Puppeteer and SQLite. No API keys required!

## Features

### 🔍 **Advanced Web Search**
- **Multiple search engines**: DuckDuckGo, Bing, Google
- **Smart filtering**: Site-specific, file type, date range
- **Intelligent caching**: 24-hour result caching for performance

### 📄 **Content Extraction**
- **Full page content**: Extract text, links, images, or everything
- **Smart caching**: Avoids re-scraping the same URLs (7-day cache)
- **Configurable output**: Control content length and extraction type

### ⚡ **Bulk Operations**
- **Bulk search**: Search multiple queries simultaneously
- **Batch processing**: Efficient handling of multiple requests
- **Error resilience**: Continues processing even if some queries fail

### 📊 **Analytics & Insights**
- **Search statistics**: Track usage patterns and popular queries
- **Engine analytics**: Monitor which search engines are used most
- **Historical data**: Analyze trends over configurable time periods

### 💾 **Export Functionality**
- **Multiple formats**: JSON and CSV export
- **Flexible filtering**: Export specific queries or date ranges
- **Ready-to-use data**: Properly formatted for analysis

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mcp-web-search.git
   cd mcp-web-search
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Test the server**
   ```bash
   node index.js
   ```

## MCP Configuration

Add this to your MCP configuration file (`.kiro/settings/mcp.json` for Kiro IDE):

```json
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["./path/to/mcp-web-search/index.js"],
      "env": {},
      "disabled": false,
      "autoApprove": [
        "web_search",
        "extract_content", 
        "bulk_search",
        "search_analytics",
        "export_results",
        "clear_cache"
      ]
    }
  }
}
```

## Available Tools

### `web_search`
Search the web with advanced filtering options.

**Parameters:**
- `query` (required): Search query
- `max_results` (optional): Maximum results to return (default: 10)
- `search_engine` (optional): Engine to use - `duckduckgo`, `bing`, `google` (default: duckduckgo)
- `site_filter` (optional): Filter to specific domain (e.g., "github.com")
- `file_type` (optional): Filter by file type (e.g., "pdf", "doc")
- `date_range` (optional): Filter by date - `day`, `week`, `month`, `year`
- `use_cache` (optional): Use cached results (default: true)

### `extract_content`
Extract full content from a specific URL.

**Parameters:**
- `url` (required): URL to extract content from
- `extract_type` (optional): Type of content - `text`, `links`, `images`, `all` (default: text)
- `max_length` (optional): Maximum content length (default: 5000)

### `bulk_search`
Search multiple queries simultaneously.

**Parameters:**
- `queries` (required): Array of search queries
- `max_results_per_query` (optional): Max results per query (default: 5)
- `search_engine` (optional): Search engine to use (default: duckduckgo)

### `search_analytics`
Get analytics about your search history.

**Parameters:**
- `days_back` (optional): Number of days to analyze (default: 30)

### `export_results`
Export search results to JSON or CSV.

**Parameters:**
- `query` (optional): Specific query to export (exports all if not specified)
- `format` (optional): Export format - `json` or `csv` (default: json)
- `days_back` (optional): Number of days back to export (default: 7)

### `clear_cache`
Clear the search cache.

**Parameters:**
- `older_than_days` (optional): Clear entries older than N days (clears all if not specified)

## Examples

### Basic Search
```javascript
// Search for JavaScript tutorials
{
  "query": "JavaScript tutorials",
  "max_results": 5
}
```

### Advanced Search with Filters
```javascript
// Search GitHub for Python machine learning projects
{
  "query": "machine learning",
  "site_filter": "github.com",
  "search_engine": "bing",
  "max_results": 10
}
```

### Content Extraction
```javascript
// Extract text content from a webpage
{
  "url": "https://example.com/article",
  "extract_type": "text",
  "max_length": 2000
}
```

### Bulk Search
```javascript
// Search multiple frameworks at once
{
  "queries": ["React hooks", "Vue.js composition API", "Angular signals"],
  "max_results_per_query": 3
}
```

## Database

The server uses SQLite to cache search results and extracted content:

- **Search results**: Cached for 24 hours
- **Extracted content**: Cached for 7 days
- **Database file**: `search_cache.db` (created automatically)

## Architecture

- **Puppeteer**: Web scraping and content extraction
- **SQLite**: Local caching and analytics storage
- **MCP SDK**: Model Context Protocol integration
- **Node.js**: Runtime environment

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure all dependencies are installed with `npm install`
2. **Database errors**: Delete `search_cache.db` to reset the database
3. **Search engine blocking**: Try different search engines or add delays between requests
4. **Path issues**: Ensure the MCP configuration points to the correct file path

### Debug Mode

Set the environment variable for more verbose logging:
```bash
NODE_ENV=development node index.js
```

## Roadmap

- [ ] Add more search engines (Yahoo, Startpage)
- [ ] Implement rate limiting and request throttling
- [ ] Add image search capabilities
- [ ] Support for custom user agents and headers
- [ ] Web scraping with JavaScript rendering
- [ ] Search result deduplication
- [ ] Advanced content parsing (markdown, structured data)

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/mcp-web-search/issues) on GitHub.