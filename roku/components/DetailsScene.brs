' DetailsScene — fills in the selected title and starts playback on OK.
' The stream URL is the backend HLS endpoint for that title's id.

sub Init()
    m.titleLabel = m.top.FindNode("titleLabel")
    m.metaLabel = m.top.FindNode("metaLabel")
    m.descLabel = m.top.FindNode("descLabel")
    m.top.ObserveField("contentItem", "OnContentItem")
    m.top.SetFocus(true)
end sub

sub OnContentItem()
    item = m.top.contentItem
    if item = invalid then return
    m.titleLabel.Text = item.Title
    meta = item.itemType
    if item.year <> invalid and item.year > 0 then meta = meta + "  •  " + Str(item.year).Trim()
    if item.duration <> invalid and item.duration > 0 then meta = meta + "  •  " + Str(item.duration \ 60).Trim() + " min"
    m.metaLabel.Text = meta
    m.descLabel.Text = item.Description
end sub

function OnKeyEvent(key as String, press as Boolean) as Boolean
    if not press then return false
    if key = "OK" then
        PlaySelected()
        return true
    end if
    if key = "back" then
        m.top.GetScene().RemoveChild(m.top)
        return true
    end if
    return false
end function

sub PlaySelected()
    item = m.top.contentItem
    if item = invalid then return
    video = m.top.CreateScene("VideoScene")
    video.apiBaseUrl = m.top.apiBaseUrl
    video.contentId = item.contentId
    video.title = item.Title
    m.top.GetScene().AppendChild(video)
    video.SetFocus(true)
end sub
