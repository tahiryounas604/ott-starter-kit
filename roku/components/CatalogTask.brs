' CatalogTask — GET {apiBaseUrl}/api/catalog?limit=100, parses the JSON
' into a ContentNode tree the RowList can render. Runs on a Task thread
' so the UI never blocks on the network.

sub Init()
    m.top.FunctionName = "FetchCatalog"
end sub

sub FetchCatalog()
    transfer = CreateNode("roUrlTransfer")
    transfer.SetUrl(m.top.apiBaseUrl + "/api/catalog?limit=100")
    transfer.AddHeader("Accept", "application/json")
    body = transfer.GetToString()
    if transfer.GetResponseCode() <> 200 or body = "" then
        m.top.error = "Catalog request failed (HTTP " + Str(transfer.GetResponseCode()).Trim() + ")"
        return
    end if
    parsed = ParseJson(body)
    if parsed = invalid or parsed.items = invalid then
        m.top.error = "Catalog response was not valid JSON."
        return
    end if

    root = CreateNode("ContentNode")
    byGenre = {}
    for each item in parsed.items
        genre = item.genre
        if genre = "" then genre = "All Titles"
        if byGenre[genre] = invalid then
            row = CreateNode("ContentNode")
            row.Title = genre
            byGenre[genre] = row
            root.AppendChild(row)
        end if
        node = CreateNode("ContentNode")
        node.Title = item.title
        node.Description = item.description
        node.AddFields({ contentId: item.id, itemType: item.type, year: item.year, duration: item.duration_seconds })
        if item.poster_url <> "" then node.HDPosterUrl = item.poster_url
        byGenre[genre].AppendChild(node)
    end for
    m.top.content = root
end sub
