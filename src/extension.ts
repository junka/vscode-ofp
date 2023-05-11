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
    const preend = pos.start.translate(0, -1)
    let prestart = pos.start.translate(0, -9)

    if (document.getText(new vscode.Range(prestart, preend)) !== 'resubmit') {
      prestart = pos.start.translate(0, -11)
      if (document.getText(new vscode.Range(prestart, preend)) !== 'goto_table') {
        return []
      }
    }

    let targetpos = pos.start
    const context = document.getText(pos).split(/\r\n,?/)[0]
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i)
      const tbl = line.text.indexOf('table=' + context)
      if (tbl !== -1 && line.text.includes('actions=')) {
        targetpos = new vscode.Position(i, tbl + 6)
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
