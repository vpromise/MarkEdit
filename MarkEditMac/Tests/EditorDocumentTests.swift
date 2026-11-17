//
//  EditorDocumentTests.swift
//
//  Created by cyan on 9/23/26.
//

import AppKit
import AppKitExtensions
import ExtensionCore
import MarkEditCore
import MarkEditKit
import PDFKit
import Security
import WebKit
import XCTest
@testable import MarkEdit

@MainActor
final class EditorDocumentTests: XCTestCase {
  override static func setUp() {
    super.setUp()
    precondition(ApplicationEnvironment.isRunningTests, "Hosted tests must bypass normal application startup")
  }

  override static func tearDown() {
    ApplicationEnvironment.preferences.removePersistentDomain(
      forName: ApplicationEnvironment.testIdentifier
    )

    do {
      try FileManager.default.removeItem(at: ApplicationEnvironment.documentsDirectory)
    } catch {
      XCTFail("Unable to remove test customization directory: \(error)")
    }

    super.tearDown()
  }
}

@MainActor
func waitUntilLoaded(_ document: EditorDocument, data: Data) async throws {
    let deadline = ContinuousClock.now + .seconds(5)
    while document.fileData != data, ContinuousClock.now < deadline {
      try await Task.sleep(for: .milliseconds(10))
    }

    XCTAssertEqual(document.fileData, data)
  }
