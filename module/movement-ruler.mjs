export function registerMovementRuler() {
  const Ruler = CONFIG.Token.rulerClass;
  CONFIG.Token.rulerClass = class WorldsBeyondTokenRuler extends Ruler {
    refresh({ passedWaypoints, pendingWaypoints, plannedMovement }) {
      // Keep live previews and movement history itself. Only omit the recorded
      // route from the display, including behind a new planned route.
      const history = this.token.document.movementHistory;
      return super.refresh({
        passedWaypoints: passedWaypoints.slice(history.length),
        pendingWaypoints,
        plannedMovement: Object.fromEntries(
          Object.entries(plannedMovement).map(([user, movement]) => [user, { ...movement, history: [] }])
        )
      });
    }
  };
}
