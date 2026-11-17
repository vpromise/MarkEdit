//
//  EditorDocument+History.swift
//  MarkEditMac
//

import MarkEditKit

extension EditorDocument {
  var canUndo: Bool {
    get async {
      if isReadOnlyMode {
        return false
      }

      return (try? await hostViewController?.bridge.history.canUndo()) ?? false
    }
  }

  var canRedo: Bool {
    get async {
      if isReadOnlyMode {
        return false
      }

      return (try? await hostViewController?.bridge.history.canRedo()) ?? false
    }
  }

  var lineEndings: LineEndings? {
    get async {
      try? await hostViewController?.bridge.lineEndings.getLineEndings()
    }
  }
}
