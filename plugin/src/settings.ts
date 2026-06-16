import { App, PluginSettingTab, Setting } from "obsidian"
import type NodepadPlugin from "./main"
import { AI_PROVIDER_PRESETS, type AIProvider } from "@/lib/ai-settings"

export interface NodepadSettings {
  provider: AIProvider
  apiKey: string
  modelId: string
  customBaseUrl: string
}

export const DEFAULT_SETTINGS: NodepadSettings = {
  provider: "openrouter",
  apiKey: "",
  modelId: "openai/gpt-4o",
  customBaseUrl: "",
}

export class NodepadSettingTab extends PluginSettingTab {
  plugin: NodepadPlugin

  constructor(app: App, plugin: NodepadPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display() {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl("h2", { text: "Nodepad" })

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("AI provider to use for enrichment and ghost synthesis")
      .addDropdown((drop) => {
        AI_PROVIDER_PRESETS.forEach((p) => drop.addOption(p.id, p.label))
        drop.setValue(this.plugin.settings.provider)
        drop.onChange(async (value) => {
          this.plugin.settings.provider = value as AIProvider
          await this.plugin.saveSettings()
        })
      })

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Your API key for the selected provider")
      .addText((text) => {
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value
            await this.plugin.saveSettings()
          })
        text.inputEl.type = "password"
        text.inputEl.style.width = "100%"
      })

    new Setting(containerEl)
      .setName("Model ID")
      .setDesc("Model to use (e.g. openai/gpt-4o, claude-sonnet-4-6)")
      .addText((text) =>
        text
          .setPlaceholder("openai/gpt-4o")
          .setValue(this.plugin.settings.modelId)
          .onChange(async (value) => {
            this.plugin.settings.modelId = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName("Custom base URL")
      .setDesc("Override the provider base URL (optional)")
      .addText((text) =>
        text
          .setPlaceholder("https://api.example.com/v1")
          .setValue(this.plugin.settings.customBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.customBaseUrl = value
            await this.plugin.saveSettings()
          })
      )
  }
}
