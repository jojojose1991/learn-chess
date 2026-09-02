# A Goal is a predicate over board state, never a stored solution

A Puzzle's Goal ("mate in 2") is evaluated by inspecting the game after each
move — did checkmate occur, within N of the Student's moves — not by comparing
the Student's moves against an authored solution line. This was decided because
a Coach stated that two different routes to the same checkmate must both be
accepted; storing a line would require either authoring every acceptable line
or rejecting valid play.

## Consequences

Authoring a Puzzle is picking a Goal type and a number — a Coach never enters
moves, and no solution data exists to go stale when a Position is edited.
Alternative Goal types must be expressible the same way: "win material worth
≥ V within N moves" is a comparison of material before and after, so it fits.
A Goal that genuinely needs a specific move order would not fit this model, and
would be the signal to revisit this decision rather than to bolt a move list
onto the schema.
