import Foundation

/// One catalog title, matching the backend's JSON shape.
struct ContentItem: Identifiable, Decodable {
    let id: Int
    let title: String
    let description: String
    let type: String
    let genre: String
    let year: Int?
    let durationSeconds: Int?
    let posterURL: String
    let hlsPath: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, type, genre, year
        case durationSeconds = "duration_seconds"
        case posterURL = "poster_url"
        case hlsPath = "hls_path"
    }
}

struct CatalogResponse: Decodable {
    let items: [ContentItem]
    let total: Int
}
