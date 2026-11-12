import Foundation

/// Talks to the ott-starter-kit backend over URLSession.
/// Change `baseURL` to your backend host. Cleartext HTTP is for local
/// development only — ship with HTTPS and an App Transport Security exception removed.
@MainActor
final class ContentService: ObservableObject {
    static let shared = ContentService()

    /// Default: backend on the same Mac as the simulator (use your LAN IP on a real Apple TV).
    var baseURL = URL(string: "http://127.0.0.1:3000")!

    @Published private(set) var items: [ContentItem] = []
    @Published private(set) var errorMessage: String?

    func loadCatalog() async {
        do {
            let url = baseURL.appendingPathComponent("/api/catalog")
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "limit", value: "100")]
            let (data, response) = try await URLSession.shared.data(from: components?.url ?? url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                errorMessage = "Catalog request failed."
                return
            }
            items = try JSONDecoder().decode(CatalogResponse.self, from: data).items
        } catch {
            errorMessage = "Could not load catalog: \(error.localizedDescription)"
        }
    }

    func streamURL(for item: ContentItem) -> URL {
        baseURL.appendingPathComponent("/api/play/\(item.id)/master.m3u8")
    }
}
