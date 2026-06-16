import { Plugin, TFolder } from "obsidian"
import { NodepadView, VIEW_TYPE } from "./view"
import { NodepadSettingTab, type NodepadSettings, DEFAULT_SETTINGS } from "./settings"

export default class NodepadPlugin extends Plugin {
  settings!: NodepadSettings

  async onload() {
    await this.loadSettings()

    this.registerView(VIEW_TYPE, (leaf) => new NodepadView(leaf, this))
    this.registerExtensions(["nodepad"], VIEW_TYPE)

    this.addRibbonIcon("layout-dashboard", "New Nodepad Space", () => this.createNewSpace())

    this.addCommand({
      id: "new-nodepad-space",
      name: "New Nodepad Space",
      callback: () => this.createNewSpace(),
    })

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, item) => {
        if (!(item instanceof TFolder)) return
        const folder = item
        menu.addItem((menuItem) => {
          menuItem
            .setTitle("New Nodepad Space")
            .setIcon("layout-dashboard")
            .onClick(() => this.createNewSpace(folder.path))
        })
      })
    )

    this.addSettingTab(new NodepadSettingTab(this.app, this))
  }

  async createNewSpace(folderPath?: string) {
    const filename = `Untitled Space ${Date.now()}.nodepad`
    const path = folderPath ? `${folderPath}/${filename}` : filename
    const spaceName = filename.replace(/\.nodepad$/, "")
    const initialData = JSON.stringify(
      {
        version: 1,
        exportedAt: Date.now(),
        project: {
          id: Math.random().toString(36).substring(2, 10),
          name: spaceName,
          blocks: [],
          collapsedIds: [],
          ghostNotes: [],
          viewMode: "tiling",
        },
      },
      null,
      2
    )
    const file = await this.app.vault.create(path, initialData)
    const leaf = this.app.workspace.getLeaf("tab")
    await leaf.openFile(file)
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  onunload() {}
}
