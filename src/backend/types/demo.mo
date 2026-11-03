import Common "common";

/// Demo-mode types. The canonical definitions live in `types/common.mo`; this
/// module re-exports them so demo code can import a single `Demo` namespace
/// without creating a second, structurally-equal-but-distinct type identity.
module {
  public type DemoRole = Common.DemoRole;
  public type DemoShift = Common.DemoShift;
  public type PretendDate = Common.PretendDate;
  public type DemoState = Common.DemoState;
  public type DemoStateView = Common.DemoStateView;
  public type DemoDataSummary = Common.DemoDataSummary;
  public type DemoActionResult = Common.DemoActionResult;
};
