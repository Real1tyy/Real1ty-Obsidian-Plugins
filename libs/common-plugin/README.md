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

### MountableView

`MountableView` is a mixin that provides lifecycle management and utility methods for Obsidian views. It handles mounting/unmounting, subscription management, and provides a loading indicator.

```typescript
import { MountableView } from '@real1ty-obsidian-plugins/common-plugin';
import { ItemView } from 'obsidian';

class MyView extends MountableView(ItemView) {
  async mount(): Promise<void> {
    // Initialize your view content
    this.showLoading(this.containerEl, "Loading content…");
    // ... load your content
    this.hideLoading();
  }

  async unmount(): Promise<void> {
    // Cleanup when view closes
  }
}
```

#### Styling the Loading Indicator

The `showLoading()` method creates elements with specific CSS classes that **must be styled in your plugin's `styles.css` file**. The default classes are:

- `.mountable-loading-container` - Container element
- `.mountable-loading-spinner` - Spinner element
- `.mountable-loading-text` - Text element

**Required CSS in your `styles.css`:**

```css
.mountable-loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  min-height: 100px;
}

@keyframes mountable-spin {
  0% { transform: rotate(0); }
  100% { transform: rotate(360deg); }
}

.mountable-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--background-modifier-border);
  border-top: 2px solid var(--interactive-accent);
  border-radius: 50%;
  animation: mountable-spin 1s linear infinite;
  margin: 0 auto 8px;
}

.mountable-loading-text {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9em;
}
```

**Using Custom Class Names:**

You can override the default class names if you prefer your own styling:

```typescript
this.showLoading(this.containerEl, "Loading…", {
  container: "my-plugin-loading",
  spinner: "my-plugin-spinner",
  text: "my-plugin-loading-text"
});
```

Then style these custom classes in your `styles.css` accordingly.

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
