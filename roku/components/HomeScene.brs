' HomeScene — loads the catalog, shows it as a genre RowList, and opens
' DetailsScene when the user picks a title.

sub Init()
    m.rowList = m.top.FindNode("rowList")
    m.statusLabel = m.top.FindNode("statusLabel")
    m.rowList.ObserveField("rowItemSelected", "OnItemSelected")
    m.top.ObserveField("apiBaseUrl", "OnApiBaseUrl")
end sub

sub OnApiBaseUrl()
    if m.top.apiBaseUrl = "" then return
    task = CreateNode("CatalogTask")
    task.apiBaseUrl = m.top.apiBaseUrl
    task.ObserveField("content", "OnCatalogLoaded")
    task.ObserveField("error", "OnCatalogError")
    task.Control = "RUN"
    m.catalogTask = task
end sub

sub OnCatalogLoaded(event as Object)
    content = event.GetData()
    if content = invalid then return
    m.rowList.Content = content
    m.rowList.Visible = true
    m.rowList.SetFocus(true)
    m.statusLabel.Text = ""
end sub

sub OnCatalogError(event as Object)
    m.statusLabel.Text = event.GetData()
end sub

sub OnItemSelected(event as Object)
    index = event.GetData() ' [row, item]
    item = m.rowList.Content.GetChild(index[0]).GetChild(index[1])
    details = m.top.CreateScene("DetailsScene")
    details.apiBaseUrl = m.top.apiBaseUrl
    details.contentItem = item
    m.top.GetScene().AppendChild(details)
    details.SetFocus(true)
end sub
