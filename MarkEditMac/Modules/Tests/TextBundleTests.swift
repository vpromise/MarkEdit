//
//  TextBundleTests.swift
//
//  Created by cyan on 3/23/23.
//

import TextBundle
import XCTest

final class TextBundleTests: XCTestCase {
  func testPreservesImagesAddedAfterTheBundleWasOpened() throws {
    let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    let sourceURL = directory.appending(path: "source.textbundle")
    let exportedURL = directory.appending(path: "saved.textbundle")
    defer { try? FileManager.default.removeItem(at: directory) }

    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let initial = FileWrapper(directoryWithFileWrappers: [:])
    initial.addRegularFile(withContents: Data("# Original".utf8), preferredFilename: "text.markdown")
    try initial.write(to: sourceURL, options: .atomic, originalContentsURL: nil)
    let bundle = try TextBundleWrapper(fileWrapper: FileWrapper(url: sourceURL))

    let assetsURL = sourceURL.appending(path: "assets")
    try FileManager.default.createDirectory(at: assetsURL, withIntermediateDirectories: true)
    let image = Data("pasted image bytes".utf8)
    try image.write(to: assetsURL.appending(path: "image.png"))

    let saved = try bundle.fileWrapper(with: Data("![Image](assets/image.png)".utf8), assetsFrom: sourceURL)
    try saved.write(to: exportedURL, options: .atomic, originalContentsURL: nil)
    XCTAssertEqual(try Data(contentsOf: exportedURL.appending(path: "assets/image.png")), image)
  }

  func testTextBundleParsing() {
    // swiftlint:disable:next force_unwrapping
    let url = Bundle.module.url(forResource: "sample.textbundle", withExtension: nil)!
    let textBundle = try? TextBundleWrapper(fileWrapper: FileWrapper(url: url))

    let textContent = String(data: textBundle?.data ?? Data(), encoding: .utf8)
    XCTAssertEqual(textContent?.hasPrefix("# Textbundle Example"), true)
  }
}
