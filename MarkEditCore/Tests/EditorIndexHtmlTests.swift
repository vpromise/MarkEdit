import XCTest
@testable import MarkEditCore

final class EditorIndexHtmlTests: XCTestCase {
  func testSharedContainerWriteFailureDoesNotCrashTheEditor() throws {
    let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let occupied = directory.appending(path: "file")
    try Data("existing file".utf8).write(to: occupied)

    XCTAssertFalse(EditorIndexHtml.copySharedData(Data("html".utf8), to: occupied.appending(path: "index.html")))
    XCTAssertEqual(try Data(contentsOf: occupied), Data("existing file".utf8))
  }

  func testCopiesAndUpdatesTheSharedEditor() throws {
    let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let target = directory.appending(path: "Shared/index.html")
    XCTAssertTrue(EditorIndexHtml.copySharedData(Data("first".utf8), to: target))
    XCTAssertTrue(EditorIndexHtml.copySharedData(Data("second".utf8), to: target))
    XCTAssertEqual(try Data(contentsOf: target), Data("second".utf8))
  }
}
