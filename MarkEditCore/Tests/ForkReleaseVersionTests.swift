import XCTest
@testable import MarkEditCore

final class ForkReleaseVersionTests: XCTestCase {
  func testComparesForkRevisionsWithinTheSameAppVersion() throws {
    let installed = try XCTUnwrap(ForkReleaseVersion(version: "1.34.0", revision: 2))
    XCTAssertLessThan(try XCTUnwrap(ForkReleaseVersion(tag: "v1.34.0-fork.1")), installed)
    XCTAssertEqual(try XCTUnwrap(ForkReleaseVersion(tag: "v1.34.0-fork.2")), installed)
    XCTAssertGreaterThan(try XCTUnwrap(ForkReleaseVersion(tag: "v1.34.0-fork.10")), installed)
    XCTAssertGreaterThan(try XCTUnwrap(ForkReleaseVersion(tag: "v1.35.0-fork.1")), installed)
  }

  func testRejectsReleaseNamesThatAreNotVersionTags() {
    for tag in ["Markdown Preview", "v1.34.0-fork", "v1.34.0-fork.2-beta", "v1.34", "v1.34.0/other"] {
      XCTAssertNil(ForkReleaseVersion(tag: tag))
    }
  }

  func testNormalizesNumericVersions() {
    XCTAssertEqual(ForkReleaseVersion(tag: "v01.034.0-fork.2"), ForkReleaseVersion(tag: "v1.34.0-fork.2"))
    XCTAssertNil(ForkReleaseVersion(version: "1.34.0", revision: -1))
  }
}
