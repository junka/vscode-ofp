'use strict'
import * as vscode from 'vscode'

export function activate (context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { scheme: 'file', language: 'ofp' },
      new OfpDocumentSymbolProvider()
    )
  )
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { scheme: 'file', language: 'ofp' },
      new OfpDefinitionProvider()
    )
  )

  // context.subscriptions.push(
  //   vscode.workspace.onDidChangeConfiguration(e => {
  //     if (e.affectsConfiguration('ofp-flowchart') || e.affectsConfiguration('workbench.colorTheme')) {
  //       vscode.commands.executeCommand('ofp.drawtable')
  //     }
  //   })
  // )

  const preprovider = new PreiviewProvider()

  context.subscriptions.push(
    vscode.commands.registerCommand('ofp.drawtable', () => {
      const panel = preprovider.createWebviewPanel(context.extensionUri)
      if (panel !== null) {
        panel.onDidDispose(
          () => {
            // Handle user closing panel before the 5sec have passed
          },
          null,
          context.subscriptions
        )
      }
    })
  )

  // vscode.window.registerWebviewPanelSerializer('flowtablechart', {
  //   async deserializeWebviewPanel (webviewPanel: vscode.WebviewPanel, state: unknown) {
  //     webviewPanel.webview.options = {
  //       enableScripts: true,
  //       localResourceRoots: [
  //         vscode.Uri.joinPath(context.extensionUri, 'mermaid')
  //       ]
  //     }
  //     const mjs = webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'mermaid', 'mermaid.min.js'))
  //     const source = ''
  //     webviewPanel.webview.html = buildHtml(mjs, source)
  //   }
  // })

  vscode.workspace.onDidChangeTextDocument((e) => {
    const ori = preprovider._ori
    if (e.document.uri === ori) {
      const newuri = vscode.Uri.parse('ofp.preview:' + ori.path)
      preprovider.onDidChangeEmitter.fire(newuri)
    }
  })

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('ofp.preview', preprovider)
  )
}

class PreiviewProvider implements vscode.TextDocumentContentProvider {
  private webViewPanel: vscode.WebviewPanel | null = null
  public onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>()
  private _path = vscode.Uri.parse('')
  // private readonly debug = vscode.window.createOutputChannel('flowtable')
  public _ori: vscode.Uri | undefined = undefined

  onDidChange = this.onDidChangeEmitter.event

  public createWebviewPanel (extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn
    if (column === undefined) {
      return null
    }
    this._ori = vscode.window.activeTextEditor?.document.uri
    if (this._ori === undefined) {
      return null
    }

    const newuri = vscode.Uri.parse('ofp.preview:' + this._ori.path)
    const panel = vscode.window.createWebviewPanel(
      'flowtablechart',
      'Flow Tables (' + this._ori.path + ')',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'mermaid')
        ]
      }
    )
    this.webViewPanel = panel
    vscode.workspace.openTextDocument(newuri).then(doc => {
      panel.title = 'Flow Tables(' + doc.fileName + ')'
    }, () => { })
    this._path = extensionUri
    this.update()
    return this.webViewPanel
  }

  public provideTextDocumentContent (uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    if (this.webViewPanel?.webview != null) {
      this.update()
      return this.webViewPanel.webview.html
    } else {
      return ''
    }
  }

  public update () {
    let source = ''
    if (this._ori !== undefined) {
      vscode.workspace.openTextDocument(this._ori).then(doc => {
        source = this.buildSourceFromDocument(doc)
        if (this.webViewPanel !== null) {
          const mjs = this.webViewPanel.webview.asWebviewUri(vscode.Uri.joinPath(this._path, 'mermaid', 'mermaid.esm.min.mjs'))
          this.webViewPanel.webview.html = buildHtml(mjs, source)
        }
      }, () => { })
    }
  }

  private buildSourceFromDocument (document: vscode.TextDocument) {
    let source = 'flowchart TD\n'
    let lasttid = '-1'
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i)
      const tbl = line.text.indexOf(' table=')
      if (tbl !== -1 && (line.text.includes('resubmit') || line.text.includes('goto_table') ||
        line.text.includes('ct('))) {
        if (lasttid !== line.text.slice(tbl + 7).split(',')[0]) {
          lasttid = line.text.slice(tbl + 7).split(',')[0]
          let id = 'EndofFlow'
          if (line.text.includes('goto_table:')) {
            const start = line.text.indexOf('goto_table:') + 11
            id = line.text.slice(start).split(/\r\n,?/)[0]
          } else if (line.text.includes('resubmit')) {
            const match = line.text.match(/resubmit\(.*,(.*)\)/)
            if (match !== null) {
              id = match[1]
            }
          } else if (line.text.includes('ct(')) {
            const match = line.text.match(/ct\([,\w]*table=([\w\d]+)/)
            if (match !== null) {
              id = 'CT((CT))'
              source += 'CT -.-> ' + match[1] + '\n'
            }
          }
          if (id !== 'EndofFlow') {
            source += lasttid + '-->' + id + '\n'
          }
        }
      }
    }
    source += '\n'
    return source
  }

  public dispose () {
    this.webViewPanel?.dispose()
    this.webViewPanel = null
  }
}

function buildHtml (mjs: vscode.Uri, source: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none';
    img-src data: blob: vscode-webview-resource: https:;
    script-src 'unsafe-inline' vscode-webview-resource: https:;
    style-src 'unsafe-inline' vscode-webview-resource: https:;"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Tables</title>
  <style>
      div.mermaid {
        font-family: 'Courier New', Courier, monospace !important;
      }
  </style>
  <script type=module>
      import mermaid from "${mjs}"
      mermaid.initialize({
        startOnLoad: true,
        theme: 'forest',
        securityLevel: 'loose',
        flowchart: { curve: 'basis' },
      })
  </script>
</head>
<body>
    <h1>Flow Table</h1>
    <hr/>
    <div class="mermaid">${source}</div>
</body>
</html>`
}

class OfpDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols (
    document: vscode.TextDocument,
    token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    return new Promise((resolve, reject) => {
      const symbols: vscode.DocumentSymbol[] = []
      const nodes = [symbols]
      let lasttid = '-1'

      const symmarker = vscode.SymbolKind.Field
      const submarker = vscode.SymbolKind.Event

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i)

        const tbl = line.text.indexOf(' table=')
        if (tbl !== -1 && line.text.includes('actions=')) {
          if (lasttid !== line.text.slice(tbl + 7).split(',')[0]) {
            lasttid = line.text.slice(tbl + 7).split(',')[0]
            const newsymbol = new vscode.DocumentSymbol(
              'table ' + lasttid,
              lasttid,
              symmarker,
              line.range, line.range)

            nodes[nodes.length - 1].push(newsymbol)
          }
        } else if (line.text.includes('meter=')) {
          const mid = line.text.slice(line.text.indexOf('meter=') + 6).split(' ')[0]
          const newsymbol = new vscode.DocumentSymbol(
            'meter ' + mid,
            mid,
            symmarker,
            line.range, line.range)

          nodes[nodes.length - 1].push(newsymbol)
          let idx = 0
          while (idx < line.text.length) {
            let pos = line.text.indexOf('type=', idx)
            if (pos === -1) {
              break
            }
            const t = line.text.slice(pos + 5).split(' ')[0]
            pos = line.text.indexOf('rate=', idx)
            const rt = line.text.slice(pos + 5).split(' ')[0]
            pos = line.text.indexOf('burst_size=', idx)
            const bs = line.text.slice(pos + 11).split(' ')[0]
            const subsymbol = new vscode.DocumentSymbol(
              'type ' + t + ' rate ' + rt + ' busrt ' + bs,
              t,
              submarker,
              line.range, line.range)
            newsymbol.children.push(subsymbol)
            idx = pos + 1
          }
          nodes.push(newsymbol.children)
          nodes.pop()
        } else if (line.text.includes('group_id=')) {
          const gid = line.text.slice(line.text.indexOf('group_id=') + 9).split(',')[0]
          const pos = line.text.indexOf('type=')
          if (pos === -1) {
            break
          }
          const tp = line.text.slice(pos + 5).split(',')[0]
          const newsymbol = new vscode.DocumentSymbol(
            'group ' + gid,
            tp,
            symmarker,
            line.range, line.range)

          nodes[nodes.length - 1].push(newsymbol)
        }
      }

      resolve(symbols)
    })
  }
}

class OfpDefinitionProvider implements vscode.DefinitionProvider {
  public provideDefinition (document: vscode.TextDocument, position: vscode.Position,
    token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    const pos = document.getWordRangeAtPosition(position)
    if (pos === undefined) {
      return []
    }
    if (pos.start.character < 9) {
      return []
    }
    let preend = pos.start.translate(0, -1)
    let prestart = pos.start.translate(0, -11)

    if (document.getText(new vscode.Range(prestart, preend)) !== 'goto_table') {
      preend = pos.start.translate(0, -2)
      prestart = pos.start.translate(0, -15)
      if (document.getText(new vscode.Range(prestart, preend)).includes('resubmit')) {
        return []
      }
    }

    let targetpos = pos.start
    const context = document.getText(pos).split(/\r\n,?/)[0]
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i)
      const tbl = line.text.indexOf(' table=' + context)
      if (tbl !== -1 && line.text.includes('actions=')) {
        targetpos = new vscode.Position(i, tbl + 7)
        break
      }
    }

    const origionposstart = new vscode.Position(pos.start.line, pos.start.character)
    const origionposend = new vscode.Position(pos.end.line, pos.end.character)
    const origionpos = new vscode.Range(origionposstart, origionposend)

    const target = new vscode.Range(targetpos, targetpos)
    const shortcut: vscode.LocationLink = {
      originSelectionRange: origionpos,
      targetUri: document.uri,
      targetRange: target
    }
    return [shortcut]
  }
}
