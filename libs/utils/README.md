# @real1ty-obsidian-plugins/utils

Shared utilities for Obsidian plugins - a comprehensive collection of reusable functions and helpers to streamline Obsidian plugin development.

## Installation

```bash
npm install @real1ty-obsidian-plugins/utils
# or
pnpm add @real1ty-obsidian-plugins/utils
# or
yarn add @real1ty-obsidian-plugins/utils
```

## Features

- **Date & Time Utilities**: Recurrence handling, date formatting, and time operations
- **File Operations**: File system helpers, path utilities, and content manipulation
- **String Utilities**: Text processing, sanitization, and formatting functions
- **Async Utilities**: Promise helpers and async operation management
- **Batch Operations**: Efficient bulk processing utilities
- **Settings Store**: Reactive settings management with RxJS
- **Testing Utilities**: Mock factories and test helpers for Obsidian plugins
- **Link Parser**: Markdown link parsing and manipulation
- **Child Reference Utils**: Hierarchical content reference management

## Usage

```typescript
import {
  formatDateTimeForInput,
  generateUniqueFilePath,
  SettingsStore
} from '@real1ty-obsidian-plugins/utils';

// Date utilities
const formattedDate = formatDateTimeForInput('2023-12-25T10:30:00');

// File operations
const uniquePath = await generateUniqueFilePath(app, folder, 'my-file');

// Settings management
const settingsStore = new SettingsStore(defaultSettings);
settingsStore.settings$.subscribe(settings => {
  // React to settings changes
});
```

### Testing Utilities

For testing your Obsidian plugins:

```typescript
import {
  createMockApp,
  createMockFile,
  setupTestEnvironment
} from '@real1ty-obsidian-plugins/utils/testing';

// Set up test environment
setupTestEnvironment();

// Create mock Obsidian instances
const mockApp = createMockApp();
const mockFile = createMockFile('test.md');
```

## API Reference

### Available Modules

The package is organized by domain/module:

**Settings**
- `settings-store` - Reactive settings management with Zod validation
- `settings-ui-builder` - Declarative UI builder for settings tabs

**File Operations**
- `file` - File path utilities, folder notes, and file context
- `file-operations` - File system operations and helpers
- `child-reference` - Hierarchical reference management
- `frontmatter` - Frontmatter parsing and serialization
- `link-parser` - Wiki link parsing utilities
- `templater` - Templater plugin integration

**Date Operations**
- `date` - Date/time formatting and manipulation
- `date-recurrence` - Recurrence pattern handling

**Async Utilities**
- `async` - Promise utilities and async helpers
- `batch-operations` - Bulk processing functions

**String Utilities**
- `string` - String processing functions

**Core Utilities**
- `evaluator-base` - Base evaluator class
- `generate` - ID generation utilities

**Testing**
- `testing` - Testing mocks and utilities

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All utilities are properly typed for the best development experience.

## License

MIT
