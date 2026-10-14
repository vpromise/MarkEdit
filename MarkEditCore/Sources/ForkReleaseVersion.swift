//
//  ForkReleaseVersion.swift
//  MarkEditCore
//

import Foundation

/// Compares fork release tags without treating their display names as versions.
public struct ForkReleaseVersion: Comparable {
  public let version: String
  public let revision: Int

  public init?(tag: String) {
    let pattern = "^v?([0-9]+\\.[0-9]+\\.[0-9]+)(?:-fork\\.([0-9]+))?$"
    guard let expression = try? NSRegularExpression(pattern: pattern),
          let match = expression.firstMatch(in: tag, range: NSRange(tag.startIndex..., in: tag)),
          let versionRange = Range(match.range(at: 1), in: tag) else {
      return nil
    }

    let components = tag[versionRange].split(separator: ".").compactMap { Int($0) }
    guard components.count == 3 else {
      return nil
    }
    version = components.map(String.init).joined(separator: ".")
    if let revisionRange = Range(match.range(at: 2), in: tag) {
      guard let value = Int(tag[revisionRange]) else {
        return nil
      }
      revision = value
    } else {
      revision = 0
    }
  }

  public init?(version: String, revision: Int) {
    guard let parsed = Self(tag: version), revision >= 0 else {
      return nil
    }
    self.version = parsed.version
    self.revision = revision
  }

  public static func < (lhs: Self, rhs: Self) -> Bool {
    let order = lhs.version.compare(rhs.version, options: .numeric)
    return order == .orderedSame ? lhs.revision < rhs.revision : order == .orderedAscending
  }
}
