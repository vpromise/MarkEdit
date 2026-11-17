import AppKit
import XCTest
@testable import MarkEdit

@MainActor
final class QuickSearchIntegrationTests: XCTestCase {
  func testFileMenuProvidesQuickSearchWithoutPluginSuggestions() throws {
    let delegate = try XCTUnwrap(NSApp.delegate as? AppDelegate)
    let fileMenu = try XCTUnwrap(delegate.mainFileMenu)
    let item = try XCTUnwrap(fileMenu.items.first { $0.action == #selector(AppDelegate.quickSearch(_:)) })
    XCTAssertEqual(item.keyEquivalent.lowercased(), "o")
    XCTAssertTrue(item.keyEquivalentModifierMask.contains(.command))
    XCTAssertTrue(item.keyEquivalent == "O" || item.keyEquivalentModifierMask.contains(.shift))
    XCTAssertNotNil(delegate.openRecentMenu)
    XCTAssertNotNil(delegate.bookmarksMenu)
    XCTAssertFalse(AppDelegate.quickSearchSuggestedActions.contains(sel_getUid("manageExtensions:")))
  }
}
