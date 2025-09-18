# @real1ty-obsidian-plugins/common-plugin

Abstract Obsidian plugin base providing essential functionality for path mapping, content rendering, and plugin architecture. This package provides reusable components and patterns for building robust Obsidian plugins.

## Installation

```bash
npm install @real1ty-obsidian-plugins/common-plugin
# or
pnpm add @real1ty-obsidian-plugins/common-plugin
# or
yarn add @real1ty-obsidian-plugins/common-plugin
```

## Features

- **Abstract Plugin Base**: Foundation for plugin development with common patterns
- **Settings Management**: Abstract settings tab with standardized UI components
- **Sidebar Management**: Comprehensive sidebar view management with caching
- **DSL Parser**: Domain-specific language parsing capabilities
- **View System**: Mountable and cacheable view components
- **Base Components**: Reusable UI components for plugin interfaces

## Usage

### Abstract Plugin

```typescript
import { AbstractPlugin } from '@real1ty-obsidian-plugins/common-plugin';

export class MyPlugin extends AbstractPlugin {
  async onload() {
    await super.onload();
    // Your plugin initialization
  }

  async onunload() {
    await super.onunload();
    // Your plugin cleanup
  }
}
```

### Abstract Settings Tab

```typescript
import { AbstractSettingsTab } from '@real1ty-obsidian-plugins/common-plugin';

export class MySettingsTab extends AbstractSettingsTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Use built-in setting creation methods
    this.createTextSetting(
      'Setting Name',
      'Description',
      this.plugin.settings.someValue,
      (value) => {
        this.plugin.settings.someValue = value;
        this.plugin.saveSettings();
      }
    );
  }
}
```

### Sidebar Management

```typescript
import { SidebarManager, BaseSidebarView } from '@real1ty-obsidian-plugins/common-plugin';

export class MySidebarView extends BaseSidebarView {
  getViewType(): string {
    return 'my-sidebar-view';
  }

  getDisplayText(): string {
    return 'My Sidebar';
  }

  async onOpen() {
    // Initialize your sidebar content
  }
}

// In your plugin
const sidebarManager = new SidebarManager(this.app, this);
sidebarManager.registerView(MySidebarView);
```

### DSL Parser

```typescript
import { DSLParser } from '@real1ty-obsidian-plugins/common-plugin';

const parser = new DSLParser();
const result = parser.parse('your-dsl-content');
```

## API Reference

### Core Classes

- `AbstractPlugin` - Base plugin class with common functionality
- `AbstractSettingsTab` - Standardized settings interface
- `SidebarManager` - Sidebar view management system
- `BaseSidebarView` - Base class for sidebar views
- `DSLParser` - Domain-specific language parser
- `MountableView` - Mountable view component system
- `ViewCache` - View caching and optimization

### Types

The package includes comprehensive TypeScript definitions for all components, ensuring type safety and excellent developer experience.

## Dependencies

- `obsidian` - Obsidian API
- `@real1ty-obsidian-plugins/utils` - Shared utilities
- `tslib` - TypeScript runtime helpers

## Architecture

This package follows a modular architecture with:

- **Separation of Concerns**: Each component has a specific responsibility
- **Extensibility**: Abstract classes designed for easy extension
- **Reusability**: Common patterns extracted for reuse across plugins
- **Type Safety**: Full TypeScript support with strict typing

## Examples

Check out the test files in the repository for comprehensive examples of how to use each component.

## License

MIT
