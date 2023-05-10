'use strict';

import * as vscode from 'vscode';


export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            {scheme: "file", language: "ofp"}, 
            new ofpDocumentSymbolProvider()
        )
    );
}

class ofpDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    private format(cmd: string):string {
        return cmd.substr(1).toLowerCase().replace(/^\w/, c => c.toUpperCase())
    }


    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentSymbol[]> 
        {
        return new Promise((resolve, reject) => 
        {
            const symbols: vscode.DocumentSymbol[] = [];
            const nodes = [symbols]
            let lasttid = '-1'

            const kind_marker = vscode.SymbolKind.Field
            const kind_run = vscode.SymbolKind.Event
            const kind_cmd = vscode.SymbolKind.Function

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);

                let tbl = line.text.indexOf("table=");
                if (tbl != -1 && line.text.indexOf("actions=") != -1) {
                    if (lasttid != line.text.slice(tbl+6).split(",")[0]) {
                        lasttid = line.text.slice(tbl+6).split(",")[0];
                        const marker_symbol = new vscode.DocumentSymbol(
                            "table " + lasttid,
                            lasttid,
                            kind_marker,
                            line.range, line.range)

                        nodes[nodes.length-1].push(marker_symbol)
                    }
                } else if (line.text.indexOf("meter=") != -1) {
                    let mid = line.text.slice(line.text.indexOf("meter=")+6).split(" ")[0]
                    const marker_symbol = new vscode.DocumentSymbol(
                            "meter " + mid,
                            mid,
                            kind_marker,
                            line.range, line.range)

                    nodes[nodes.length-1].push(marker_symbol)
                    let idx = 0
                    while (idx < line.text.length) {
                        let pos = line.text.indexOf("type=", idx)
                        if (pos === -1) {
                            break
                        }
                        let t = line.text.slice(pos+5).split(" ")[0]
                        const sub_symbol = new vscode.DocumentSymbol(
                                "type " + t,
                                t,
                                kind_run,
                                line.range, line.range)
                        marker_symbol.children.push(sub_symbol)
                        idx = pos + 1
                    }
                    nodes.push(marker_symbol.children)
                    nodes.pop()

                } else if (line.text.indexOf("group_id=") != -1) {
                    var gid = line.text.slice(line.text.indexOf("group_id=")+9).split(",")[0]
                    const marker_symbol = new vscode.DocumentSymbol(
                            "group " + gid,
                            gid,
                            kind_marker,
                            line.range, line.range)

                    nodes[nodes.length-1].push(marker_symbol)
                }
            }

            resolve(symbols);
        });
    }
}