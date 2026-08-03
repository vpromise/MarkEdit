//
//  EditorImageLoaderTests.swift
//

@testable import MarkEditCore
import XCTest

final class EditorImageLoaderTests: XCTestCase {
  private let baseURL = URL(filePath: "/Users/example/Documents/Notes", directoryHint: .isDirectory)

  func testRelativeImageURL() throws {
    let requestURL = try XCTUnwrap(URL(string: "image-loader://assets/diagram.png"))
    let fileURL = EditorImageLoader.fileURL(for: requestURL, relativeTo: baseURL)
    XCTAssertEqual(fileURL?.path(percentEncoded: false), "/Users/example/Documents/Notes/assets/diagram.png")
  }

  func testParentRelativeImageURL() throws {
    let requestURL = try XCTUnwrap(URL(string: "image-loader://../diagram.png"))
    let fileURL = EditorImageLoader.fileURL(for: requestURL, relativeTo: baseURL)
    XCTAssertEqual(fileURL?.standardizedFileURL.path(percentEncoded: false), "/Users/example/Documents/diagram.png")
  }

  func testAbsoluteImageURL() throws {
    let requestURL = try XCTUnwrap(URL(string: "image-loader:///Volumes/Data/diagram.png"))
    let fileURL = EditorImageLoader.fileURL(for: requestURL, relativeTo: baseURL)
    XCTAssertEqual(fileURL?.path(percentEncoded: false), "/Volumes/Data/diagram.png")
  }

  func testEncodedImageURLIgnoresQueryAndFragment() throws {
    let requestURL = try XCTUnwrap(URL(string: "image-loader://assets/a%20b.png?raw=1#preview"))
    let fileURL = EditorImageLoader.fileURL(for: requestURL, relativeTo: baseURL)
    XCTAssertEqual(fileURL?.path(percentEncoded: false), "/Users/example/Documents/Notes/assets/a b.png")
  }

  func testInvalidImageURL() throws {
    let requestURL = try XCTUnwrap(URL(string: "https://example.com/image.png"))
    XCTAssertNil(EditorImageLoader.fileURL(for: requestURL, relativeTo: baseURL))
  }
}
