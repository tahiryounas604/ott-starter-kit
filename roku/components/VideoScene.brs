' VideoScene — plays {apiBaseUrl}/api/play/{id}/master.m3u8 in the
' built-in Video node. HLS is natively supported on Roku.

sub Init()
    m.video = m.top.FindNode("video")
    m.errorLabel = m.top.FindNode("errorLabel")
    m.video.ObserveField("state", "OnVideoState")
    m.top.ObserveField("contentId", "OnContentId")
    m.top.SetFocus(true)
end sub

sub OnContentId()
    if m.top.contentId <= 0 then return
    content = CreateNode("ContentNode")
    content.Url = m.top.apiBaseUrl + "/api/play/" + Str(m.top.contentId).Trim() + "/master.m3u8"
    content.StreamFormat = "hls"
    content.Title = m.top.title
    m.video.Content = content
    m.video.Control = "play"
end sub

sub OnVideoState(event as Object)
    state = event.GetData()
    if state = "error" then
        m.errorLabel.Text = "Playback failed. This title may have no stream yet (only the Sample Reel ships with HLS in v0.1)."
        m.errorLabel.Visible = true
    end if
end sub

function OnKeyEvent(key as String, press as Boolean) as Boolean
    if press and key = "back" then
        m.video.Control = "stop"
        m.top.GetScene().RemoveChild(m.top)
        return true
    end if
    return false
end function
