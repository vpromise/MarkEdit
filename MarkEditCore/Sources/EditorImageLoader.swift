//
//  EditorImageLoader.swift
//
//  Created by cyan on 5/29/25.
//

import WebKit
import UniformTypeIdentifiers
import os.log

/// URL scheme handler to load local images.
///
/// E.g., image-loader://Image.png
public final class EditorImageLoader: NSObject, WKURLSchemeHandler {
  public static let scheme = imageLoaderScheme
  private let getBaseURL: () -> URL?

  public init(getBaseURL: @escaping () -> URL?) {
    self.getBaseURL = getBaseURL
  }

  public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
    guard let url = urlSchemeTask.request.url else {
      urlSchemeTask.didFailWithError(URLError(.badURL))
      return assertionFailure("Invalid url scheme task")
    }

    guard let baseURL = getBaseURL() else {
      urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
      return os_logger.log(level: .error, "Invalid baseURL")
    }

    guard let fileURL = Self.fileURL(for: url, relativeTo: baseURL) else {
      urlSchemeTask.didFailWithError(URLError(.badURL))
      return assertionFailure("Invalid image loader URL")
    }

    if let fileData = try? Data(contentsOf: fileURL) {
      let response = URLResponse(
        url: url,
        mimeType: UTType(filenameExtension: fileURL.pathExtension)?.preferredMIMEType,
        expectedContentLength: fileData.count,
        textEncodingName: nil
      )

      urlSchemeTask.didReceive(response)
      urlSchemeTask.didReceive(fileData)
      urlSchemeTask.didFinish()
    } else {
      let response = HTTPURLResponse(
        url: url,
        statusCode: 404,
        httpVersion: nil,
        headerFields: nil
      )

      if let response {
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didFinish()
      } else {
        urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
        assertionFailure("Failed to create 404 response")
      }
    }
  }

  public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    // no-op
  }

  nonisolated static func fileURL(for url: URL, relativeTo baseURL: URL) -> URL? {
    let prefix = "\(imageLoaderScheme)://"
    guard url.absoluteString.hasPrefix(prefix) else {
      return nil
    }

    let encodedPath = url.absoluteString.dropFirst(prefix.count)
    let pathEnd = encodedPath.firstIndex { $0 == "?" || $0 == "#" } ?? encodedPath.endIndex
    let rawPath = String(encodedPath[..<pathEnd])
    let path = rawPath.removingPercentEncoding ?? rawPath
    guard !path.isEmpty else {
      return nil
    }

    if path.hasPrefix("/") {
      return URL(filePath: path, directoryHint: .notDirectory)
    }

    return baseURL.appending(path: path, directoryHint: .notDirectory)
  }
}

private let imageLoaderScheme = "image-loader"
private let os_logger = os.Logger()
