// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OTTSwift",
    platforms: [.tvOS(.17)],
    products: [.executable(name: "OTTSwift", targets: ["OTTSwift"])],
    targets: [.executableTarget(name: "OTTSwift", path: "OTTSwift")]
)
