import SwiftUI
import AVKit

@main
struct OTTApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Home grid: sections grouped by genre, cards focusable with the Siri Remote.
struct ContentView: View {
    @StateObject private var service = ContentService.shared
    @State private var selected: ContentItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                if let error = service.errorMessage {
                    Text(error).foregroundStyle(.red).padding()
                }
                ForEach(groupedGenres, id: \.self) { genre in
                    VStack(alignment: .leading) {
                        Text(genre).font(.title2).bold().padding(.horizontal)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 24) {
                                ForEach(items(in: genre)) { item in
                                    Button { selected = item } label: {
                                        VStack(alignment: .leading) {
                                            Text(item.title).font(.headline).lineLimit(2)
                                            Text(item.type.capitalized).font(.caption).foregroundStyle(.secondary)
                                        }
                                        .frame(width: 320, height: 180)
                                        .background(.gray.opacity(0.25))
                                        .cornerRadius(12)
                                    }
                                    .buttonStyle(.card)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .navigationTitle("OTT Starter Kit")
            .task { await service.loadCatalog() }
            .navigationDestination(item: $selected) { item in
                DetailView(item: item)
            }
        }
    }

    private var groupedGenres: [String] {
        Array(Set(service.items.map { $0.genre.isEmpty ? "All Titles" : $0.genre })).sorted()
    }

    private func items(in genre: String) -> [ContentItem] {
        service.items.filter { ($0.genre.isEmpty ? "All Titles" : $0.genre) == genre }
    }
}

/// Details: metadata + Play. The Play button is disabled for titles that
/// have no stream yet (only the Sample Reel ships with HLS in v0.1).
struct DetailView: View {
    let item: ContentItem

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(item.title).font(.largeTitle).bold()
            Text(metaLine).font(.title3).foregroundStyle(.secondary)
            Text(item.description).font(.body)
            if item.hlsPath != nil {
                NavigationLink("▶  Play") {
                    PlayerView(item: item)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Text("No stream attached to this title yet.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(48)
        .navigationTitle(item.title)
    }

    private var metaLine: String {
        var parts = [item.type.capitalized]
        if let year = item.year { parts.append(String(year)) }
        if let seconds = item.durationSeconds { parts.append("\(seconds / 60) min") }
        return parts.joined(separator: "  •  ")
    }
}

/// Full-screen AVPlayer playback of the backend HLS playlist.
struct PlayerView: View {
    let item: ContentItem
    @State private var player: AVPlayer?

    var body: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
                    .onAppear { player.play() }
                    .onDisappear { player.pause() }
            } else {
                ProgressView("Loading stream…")
            }
        }
        .onAppear {
            player = AVPlayer(url: ContentService.shared.streamURL(for: item))
        }
    }
}
