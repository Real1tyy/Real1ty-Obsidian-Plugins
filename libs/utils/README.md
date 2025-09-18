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

- `async-utils` - Promise utilities and async helpers
- `batch-operations` - Bulk processing functions
- `child-reference-utils` - Hierarchical reference management
- `date-recurrence-utils` - Recurrence pattern handling
- `date-utils` - Date/time formatting and manipulation
- `file-operations` - File system operations
- `file-utils` - File path and content utilities
- `settings-store` - Reactive settings management
- `string-utils` - String processing functions
- `templater-utils` - Template processing utilities
- `testing` - Testing mocks and utilities

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All utilities are properly typed for the best development experience.

## License

MIT
