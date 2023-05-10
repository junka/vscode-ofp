'use strict'
import * as vscode from 'vscode'

export function activate (context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { scheme: 'file', language: 'ofp' },
      new OfpDocumentSymbolProvider()
    )
  )
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

        const tbl = line.text.indexOf('table=')
        if (tbl !== -1 && line.text.includes('actions=')) {
          if (lasttid !== line.text.slice(tbl + 6).split(',')[0]) {
            lasttid = line.text.slice(tbl + 6).split(',')[0]
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
            const pos = line.text.indexOf('type=', idx)
            if (pos === -1) {
              break
            }
            const t = line.text.slice(pos + 5).split(' ')[0]
            const subsymbol = new vscode.DocumentSymbol(
              'type ' + t,
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
          const newsymbol = new vscode.DocumentSymbol(
            'group ' + gid,
            gid,
            symmarker,
            line.range, line.range)

          nodes[nodes.length - 1].push(newsymbol)
        }
      }

      resolve(symbols)
    })
  }
}
