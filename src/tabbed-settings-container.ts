import { App } from 'obsidian';

/**
 * Definition for a settings tab
 */
export interface TabDefinition {
  id: string;
  label: string;
  icon?: string;
  contentRenderer: (container: HTMLElement) => void;
  isEnabled?: () => boolean;
}

/**
 * State management for tab container
 */
export interface TabContainerState {
  activeTabId: string;
  tabs: Map<string, TabDefinition>;
  containers: Map<string, HTMLElement>;
}

/**
 * Configuration options for the tabbed settings container
 */
export interface TabbedSettingsConfig {
  defaultTabId?: string;
  enableKeyboardNavigation?: boolean;
  enableTabIcons?: boolean;
  tabPosition?: 'top' | 'left' | 'right';
}

/**
 * Main container class for managing tabbed settings interface
 */
export class TabbedSettingsContainer {
  private state: TabContainerState;
  private config: TabbedSettingsConfig;
  private containerEl: HTMLElement;
  private tabHeaderContainer: HTMLElement | null = null;
  private tabContentContainer: HTMLElement | null = null;

  constructor(
    private app: App,
    containerEl: HTMLElement,
    config: Partial<TabbedSettingsConfig> = {}
  ) {
    this.containerEl = containerEl;
    this.config = {
      defaultTabId: 'general',
      enableKeyboardNavigation: true,
      enableTabIcons: false,
      tabPosition: 'top',
      ...config
    };

    this.state = {
      activeTabId: this.config.defaultTabId || 'general',
      tabs: new Map(),
      containers: new Map()
    };
  }

  /**
   * Initialize the tabbed container structure
   */
  initialize(): void {
    this.createContainerStructure();
    this.setupEventListeners();
  }

  /**
   * Add a new tab to the container
   */
  addTab(definition: TabDefinition): void {
    this.state.tabs.set(definition.id, definition);
    
    // Create content container for this tab
    const contentContainer = this.createContentContainer(definition.id);
    this.state.containers.set(definition.id, contentContainer);
    
    // If this is the first tab or the default tab, make it active
    if (this.state.tabs.size === 1 || definition.id === this.config.defaultTabId) {
      this.state.activeTabId = definition.id;
    }
  }

  /**
   * Remove a tab from the container
   */
  removeTab(tabId: string): void {
    if (this.state.tabs.has(tabId)) {
      this.state.tabs.delete(tabId);
      
      // Clean up container
      const container = this.state.containers.get(tabId);
      if (container) {
        container.remove();
        this.state.containers.delete(tabId);
      }
      
      // If we removed the active tab, switch to first available tab
      if (this.state.activeTabId === tabId && this.state.tabs.size > 0) {
        const firstTabId = Array.from(this.state.tabs.keys())[0];
        this.switchToTab(firstTabId);
      }
    }
  }

  /**
   * Switch to a specific tab
   */
  switchToTab(tabId: string): void {
    if (!this.state.tabs.has(tabId)) {
      console.warn(`Tab ${tabId} not found`);
      return;
    }

    // Update active tab state
    const previousTabId = this.state.activeTabId;
    this.state.activeTabId = tabId;

    // Update UI
    this.updateTabHeaders();
    this.updateTabContent(previousTabId, tabId);

    // Trigger custom event for external listeners
    this.containerEl.dispatchEvent(new CustomEvent('tab-changed', {
      detail: { previousTabId, activeTabId: tabId }
    }));
  }

  /**
   * Get the currently active tab ID
   */
  getActiveTabId(): string {
    return this.state.activeTabId;
  }

  /**
   * Get all registered tabs
   */
  getTabs(): TabDefinition[] {
    return Array.from(this.state.tabs.values());
  }

  /**
   * Check if a tab is currently active
   */
  isTabActive(tabId: string): boolean {
    return this.state.activeTabId === tabId;
  }

  /**
   * Render all tabs and their content
   */
  render(): void {
    this.renderTabHeaders();
    this.renderActiveTabContent();
  }

  /**
   * Clean up resources and event listeners
   */
  destroy(): void {
    // Remove event listeners
    this.removeEventListeners();
    
    // Clear containers
    this.state.containers.clear();
    this.state.tabs.clear();
    
    // Clean up DOM
    if (this.tabHeaderContainer) {
      this.tabHeaderContainer.remove();
    }
    if (this.tabContentContainer) {
      this.tabContentContainer.remove();
    }
  }

  /**
   * Create the basic container structure
   */
  private createContainerStructure(): void {
    // Clear existing content
    this.containerEl.empty();
    
    // Add CSS class for styling
    this.containerEl.addClass('retrospect-ai-tabbed-settings');
    
    // Create tab header container
    this.tabHeaderContainer = this.containerEl.createDiv('retrospect-ai-tab-headers');
    
    // Create tab content container
    this.tabContentContainer = this.containerEl.createDiv('retrospect-ai-tab-content');
  }

  /**
   * Create a content container for a specific tab
   */
  private createContentContainer(tabId: string): HTMLElement {
    if (!this.tabContentContainer) {
      throw new Error('Tab content container not initialized');
    }
    
    const container = this.tabContentContainer.createDiv(`retrospect-ai-tab-pane retrospect-ai-tab-${tabId}`);
    container.style.display = 'none'; // Hidden by default
    
    return container;
  }

  /**
   * Update tab header visual states
   */
  private updateTabHeaders(): void {
    if (!this.tabHeaderContainer) return;
    
    const tabElements = this.tabHeaderContainer.querySelectorAll('.retrospect-ai-tab');
    tabElements.forEach((element) => {
      const tabId = element.getAttribute('data-tab-id');
      if (tabId === this.state.activeTabId) {
        element.addClass('active');
        element.setAttribute('aria-selected', 'true');
      } else {
        element.removeClass('active');
        element.setAttribute('aria-selected', 'false');
      }
    });
  }

  /**
   * Update tab content visibility
   */
  private updateTabContent(previousTabId: string, activeTabId: string): void {
    // Hide previous tab content
    const previousContainer = this.state.containers.get(previousTabId);
    if (previousContainer) {
      previousContainer.style.display = 'none';
    }
    
    // Show active tab content
    const activeContainer = this.state.containers.get(activeTabId);
    if (activeContainer) {
      activeContainer.style.display = 'block';
      
      // Render content if not already rendered
      if (activeContainer.children.length === 0) {
        const tabDef = this.state.tabs.get(activeTabId);
        if (tabDef) {
          tabDef.contentRenderer(activeContainer);
        }
      }
    }
  }

  /**
   * Render tab headers
   */
  private renderTabHeaders(): void {
    if (!this.tabHeaderContainer) return;
    
    this.tabHeaderContainer.empty();
    
    // Create tab list with ARIA support
    const tabList = this.tabHeaderContainer.createDiv('retrospect-ai-tab-list');
    tabList.setAttribute('role', 'tablist');
    
    this.state.tabs.forEach((tab, tabId) => {
      // Check if tab should be enabled
      if (tab.isEnabled && !tab.isEnabled()) {
        return; // Skip disabled tabs
      }
      
      const tabElement = tabList.createDiv('retrospect-ai-tab');
      tabElement.setAttribute('data-tab-id', tabId);
      tabElement.setAttribute('role', 'tab');
      tabElement.setAttribute('tabindex', tabId === this.state.activeTabId ? '0' : '-1');
      tabElement.setAttribute('aria-selected', tabId === this.state.activeTabId ? 'true' : 'false');
      tabElement.setAttribute('aria-controls', `retrospect-ai-tab-${tabId}`);
      
      // Add icon if enabled and provided
      if (this.config.enableTabIcons && tab.icon) {
        const iconEl = tabElement.createSpan('retrospect-ai-tab-icon');
        iconEl.innerHTML = tab.icon;
      }
      
      // Add tab label
      const labelEl = tabElement.createSpan('retrospect-ai-tab-label');
      labelEl.textContent = tab.label;
      
      // Add active class if this is the active tab
      if (tabId === this.state.activeTabId) {
        tabElement.addClass('active');
      }
      
      // Add click handler
      tabElement.addEventListener('click', () => {
        this.switchToTab(tabId);
      });
    });
  }

  /**
   * Render the active tab's content
   */
  private renderActiveTabContent(): void {
    const activeContainer = this.state.containers.get(this.state.activeTabId);
    if (activeContainer) {
      // Show active container
      activeContainer.style.display = 'block';
      
      // Render content if empty
      if (activeContainer.children.length === 0) {
        const tabDef = this.state.tabs.get(this.state.activeTabId);
        if (tabDef) {
          tabDef.contentRenderer(activeContainer);
        }
      }
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (this.config.enableKeyboardNavigation) {
      this.containerEl.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
    }
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners(): void {
    if (this.config.enableKeyboardNavigation) {
      this.containerEl.removeEventListener('keydown', this.handleKeyboardNavigation.bind(this));
    }
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyboardNavigation(event: KeyboardEvent): void {
    if (!this.tabHeaderContainer?.contains(event.target as Node)) {
      return; // Only handle keyboard events within tab headers
    }
    
    const tabs = Array.from(this.state.tabs.keys());
    const currentIndex = tabs.indexOf(this.state.activeTabId);
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        this.switchToTab(tabs[prevIndex]);
        this.focusActiveTab();
        break;
      }
        
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        this.switchToTab(tabs[nextIndex]);
        this.focusActiveTab();
        break;
      }
        
      case 'Home':
        event.preventDefault();
        this.switchToTab(tabs[0]);
        this.focusActiveTab();
        break;
        
      case 'End':
        event.preventDefault();
        this.switchToTab(tabs[tabs.length - 1]);
        this.focusActiveTab();
        break;
    }
  }

  /**
   * Focus the active tab element
   */
  private focusActiveTab(): void {
    if (!this.tabHeaderContainer) return;
    
    const activeTabElement = this.tabHeaderContainer.querySelector(`[data-tab-id="${this.state.activeTabId}"]`) as HTMLElement;
    if (activeTabElement) {
      activeTabElement.focus();
    }
  }
}

/**
 * Example usage showing how to define tabs for the RetrospectAI plugin
 * Following Obsidian's guideline: avoid "settings" in tab names since we're already in settings
 */
export const RETROSPECT_AI_TABS: TabDefinition[] = [
  {
    id: 'general',
    label: 'General',
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Core plugin controls and debug options' });
    }
  },
  {
    id: 'ai-models',
    label: 'AI Models', 
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Provider configuration, testing, and parameters' });
    }
  },
  {
    id: 'privacy',
    label: 'Privacy',
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Privacy controls, tags, and compliance' });
    }
  },
  {
    id: 'folders',
    label: 'Folders',
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Folder selection, patterns, and exclusions' });
    }
  },
  {
    id: 'summary',
    label: 'Summary',
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Summary formatting, templates, and writing style' });
    }
  },
  {
    id: 'schedule',
    label: 'Schedule',
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Automation, recurring tasks, and conditions' });
    }
  },
  {
    id: 'advanced',
    label: 'Advanced',
    contentRenderer: (container) => {
      container.createEl('p', { text: 'Import/export, performance, and experimental features' });
    }
  }
]; 