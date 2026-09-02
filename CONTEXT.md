# Learn Chess

A board for setting up a chess position — from a photo, a screenshot, or by
hand — and then playing it out. Built for a Coach demonstrating and a Student
solving, not for playing full games from the opening.

## People

Coach and Student are perspectives on the same single interface, not account
types or separate apps. Nothing in the product asks which one you are.

**Coach**:
A chess teacher, assumed strong. Sets up and shares Puzzles, and demonstrates
them live to a Student.
_Avoid_: Teacher, tutor, grandmaster, master

**Student**:
A child aged 5–10 learning chess. Solves Puzzles the Coach shared, or sets up
Puzzles they found themselves.
_Avoid_: Kid, child, player, user, pupil

**Student Profile**:
A Student as the Coach records them — a name the Coach owns, with no
credentials and no login. Children never authenticate. Parent-held accounts
are a later stage, not part of this.
_Avoid_: Student account, child account, member, roster entry

**Attempt**:
One recorded try by a Student Profile at a Puzzle, and whether it reached the
Goal.
_Avoid_: Session, try, submission, result

## The board

**Position**:
The complete state of a board at a moment: where every piece stands, whose turn
it is, remaining castling rights, and any available en-passant capture. A
Position is legal or it is not; an illegal one cannot be played.
_Avoid_: Layout, board state, setup, FEN, arrangement

**Puzzle**:
A starting Position paired with a Goal. What a Coach shares and a Student
solves.
_Avoid_: Problem, exercise, drill, position, challenge

**Goal**:
The condition a Student must bring about to solve a Puzzle. A Goal is a
condition on the board, never a prescribed sequence of moves — so any line of
play that brings it about solves the Puzzle.
_Avoid_: Objective, solution, answer, target, win condition

**Mate in N**:
The Goal type: deliver checkmate within N of the Student's own moves. The
first and, for now, only Goal.

**Scan**:
Deriving a Position from an image of a board. Always produces a draft for a
person to check, never a Position that goes straight into play.
_Avoid_: Import, OCR, recognition, upload, detect

**Puzzle Link**:
A short unlisted URL that opens one Puzzle straight into play, with no sign-in
and no editing. Revocable by the Coach who minted it.
_Avoid_: Share link, public link, permalink, slug

## Playing

**Guidance**:
The assist that marks a selected piece's legal destination squares. Switched
off, the Student must find legal moves unaided.
_Avoid_: Hints, help mode, training wheels, assist, highlighting
