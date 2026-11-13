// Jarvis.app — janela nativa do macOS para o Jarvis Local.
// Compilado automaticamente pelo instalador com: swiftc -O main.swift -o Jarvis
import Cocoa
import WebKit

let jarvisURL = URL(string: "http://localhost:8080/")!
let darkBG = NSColor(red: 0.043, green: 0.043, blue: 0.051, alpha: 1)

func page(_ title: String, _ text: String) -> String {
    return """
    <html><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:#0b0b0d;color:#f2efe9;font-family:-apple-system,sans-serif;text-align:center">
    <h2 style="color:#ffb15c">\(title)</h2><p style="color:#a39f97;max-width:420px">\(text)</p></body></html>
    """
}

@discardableResult
func run(_ path: String, _ args: [String]) -> Int32 {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: path)
    p.arguments = args
    p.standardOutput = FileHandle.nullDevice
    p.standardError = FileHandle.nullDevice
    do { try p.run(); p.waitUntilExit(); return p.terminationStatus } catch { return -1 }
}

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 780),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Jarvis"
        window.backgroundColor = darkBG
        window.minSize = NSSize(width: 380, height: 500)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("JarvisMainWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        webView.loadHTMLString(page("Iniciando o Jarvis…", "Preparando o cérebro do Jarvis. Isso leva só alguns segundos."), baseURL: nil)
        DispatchQueue.global().async {
            self.ensureServices()
            DispatchQueue.main.async { self.loadWhenReady(attempt: 0) }
        }
    }

    func ensureServices() {
        // Abre o Ollama (motor de IA) em segundo plano, se não estiver aberto.
        run("/usr/bin/open", ["-g", "-a", "Ollama"])
        // Garante que o servidor do Jarvis está rodando.
        let uid = getuid()
        run("/bin/launchctl", ["kickstart", "gui/\(uid)/com.jarvis.server"])
    }

    func loadWhenReady(attempt: Int) {
        var req = URLRequest(url: jarvisURL.appendingPathComponent("api/health"))
        req.timeoutInterval = 2
        URLSession.shared.dataTask(with: req) { _, resp, _ in
            DispatchQueue.main.async {
                if (resp as? HTTPURLResponse)?.statusCode == 200 {
                    self.webView.load(URLRequest(url: jarvisURL))
                } else if attempt < 90 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.loadWhenReady(attempt: attempt + 1) }
                } else {
                    self.webView.loadHTMLString(page("Não consegui iniciar o Jarvis",
                        "Abra o Terminal e digite <b>jarvis status</b> para ver o que aconteceu, ou <b>jarvis reiniciar</b>."), baseURL: nil)
                }
            }
        }.resume()
    }

    // Links externos abrem no navegador padrão.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, let host = url.host,
           !(host == "localhost" || host == "127.0.0.1"), action.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        retryLater()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        retryLater()
    }

    func retryLater() {
        webView.loadHTMLString(page("Reconectando…", "O Jarvis está reiniciando. Aguarde um instante."), baseURL: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.loadWhenReady(attempt: 0) }
    }

    // alert(), confirm() e prompt() da página
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = "Jarvis"; a.informativeText = message
        a.addButton(withTitle: "OK"); a.runModal(); completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = "Jarvis"; a.informativeText = message
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancelar")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = "Jarvis"; a.informativeText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        field.stringValue = defaultText ?? ""
        a.accessoryView = field
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancelar")
        completionHandler(a.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    @objc func reload() { loadWhenReady(attempt: 0) }

    func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Sobre o Jarvis", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Ocultar Jarvis", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Sair do Jarvis", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Editar")
        edit.addItem(withTitle: "Desfazer", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Refazer", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Recortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Colar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Selecionar Tudo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit

        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "Visualizar")
        let r = NSMenuItem(title: "Recarregar", action: #selector(reload), keyEquivalent: "r")
        r.target = self
        view.addItem(r)
        view.addItem(withTitle: "Tela Cheia", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        viewItem.submenu = view

        let winItem = NSMenuItem(); main.addItem(winItem)
        let win = NSMenu(title: "Janela")
        win.addItem(withTitle: "Minimizar", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Fechar", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        winItem.submenu = win

        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
