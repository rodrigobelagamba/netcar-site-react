// Offline geometry only. No recognition, embeddings, names, or image writes.
// Usage: swiftc -O detect-delivery-faces.swift -o /tmp/delivery-faces
//        /tmp/delivery-faces input.json > detections.jsonl
import Foundation
import ImageIO
import Vision

struct Input: Decodable { let id: String; let path: String }
struct Face: Encodable {
    let x: Double; let y: Double; let width: Double; let height: Double
    let confidence: Double
}
struct Detection: Encodable {
    let id: String; let width: Int; let height: Int
    let faces: [Face]; let error: String?
}

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: delivery-faces input.json\n", stderr)
    exit(2)
}
let input = try JSONDecoder().decode([Input].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
for (index, item) in input.enumerated() {
    let result: Detection = autoreleasepool {
        let url = URL(fileURLWithPath: item.path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let rawWidth = props[kCGImagePropertyPixelWidth] as? Int,
              let rawHeight = props[kCGImagePropertyPixelHeight] as? Int,
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceThumbnailMaxPixelSize: 1600,
              ] as CFDictionary) else {
            return Detection(id: item.id, width: 0, height: 0, faces: [], error: "image_unreadable")
        }
        let orientation = props[kCGImagePropertyOrientation] as? Int ?? 1
        let rotated = [5, 6, 7, 8].contains(orientation)
        let width = rotated ? rawHeight : rawWidth
        let height = rotated ? rawWidth : rawHeight
        do {
            let request = VNDetectFaceRectanglesRequest()
            try VNImageRequestHandler(cgImage: image).perform([request])
            let faces = (request.results ?? []).map { observation in
                let box = observation.boundingBox
                return Face(x: box.minX, y: 1 - box.maxY, width: box.width,
                            height: box.height, confidence: Double(observation.confidence))
            }
            return Detection(id: item.id, width: width, height: height, faces: faces, error: nil)
        } catch {
            return Detection(id: item.id, width: width, height: height, faces: [], error: "detection_failed")
        }
    }
    print(String(data: try encoder.encode(result), encoding: .utf8)!)
    fflush(stdout)
    if (index + 1) % 100 == 0 {
        fputs("Inspected \(index + 1)/\(input.count) local images\n", stderr)
    }
}
