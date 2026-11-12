' ott-starter-kit — Roku channel entry point.
' Creates the SceneGraph screen, shows HomeScene, and keeps the message
' loop alive until the user exits. The API base URL is the only setting
' an operator changes: point it at the machine running the backend.
' NOTE: not compiled or run in the build VM (no Roku SDK here) — see README.

sub Main()
    screen = CreateNode("roSGScreen")
    port = CreateNode("roMessagePort")
    screen.SetMessagePort(port)

    ' Change this to your backend host, e.g. http://192.168.1.10:3000
    apiBaseUrl = "http://127.0.0.1:3000"

    scene = screen.CreateScene("HomeScene")
    scene.apiBaseUrl = apiBaseUrl
    screen.Show()

    while true
        msg = Wait(0, port)
        if Type(msg) = "roSGScreenEvent" and msg.IsScreenClosed() then
            return
        end if
    end while
end sub
